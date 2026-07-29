import { headers } from "next/headers";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";
import {
  resolveInitialRole,
  upsertMembership,
  upsertTeamFromClerkOrg,
  upsertUserFromClerk,
} from "@/lib/clerk-sync";

/**
 * Sincroniza identidad (Clerk) -> nuestra base de datos relacional.
 * Clerk es la fuente de verdad de auth/organización; nosotros solo
 * espejamos lo mínimo para poder hacer joins (Prisma) contra
 * TeamMembership, WorkoutTemplate, etc.
 *
 * Esta es la fuente de verdad "normal"; src/lib/clerk-sync.ts también se usa
 * desde getCurrentMembership() como fallback de sync-on-read cuando este
 * webhook no está configurado (ej. local sin túnel) o llega con retraso.
 *
 * Configurar en el Clerk Dashboard -> Webhooks -> endpoint
 * `${APP_URL}/api/webhooks/clerk`, eventos: user.created,
 * organization.created, organizationMembership.created,
 * organizationMembership.updated, organizationMembership.deleted.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Falta CLERK_WEBHOOK_SECRET en las variables de entorno.");
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Faltan encabezados svix.", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Firma de webhook inválida.", { status: 400 });
  }

  switch (event.type) {
    case "user.created": {
      const { id, email_addresses, first_name, last_name, image_url } = event.data;
      const email = email_addresses?.[0]?.email_address;
      if (!email) break;
      await upsertUserFromClerk(
        id,
        email,
        [first_name, last_name].filter(Boolean).join(" ") || email,
        image_url,
      );
      break;
    }

    case "organization.created": {
      const { id, name, slug } = event.data;
      await upsertTeamFromClerkOrg(id, name, slug);
      break;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const { organization, public_user_data, role } = event.data;

      // Antes esto era `if (!team || !user) break`, y ahí se perdía la
      // membresía en silencio: Clerk no garantiza el orden de los eventos, así
      // que `organizationMembership.created` puede llegar antes que
      // `user.created` (o este último puede haber fallado). El evento se daba
      // por atendido y nadie lo reintentaba — pasó de verdad con un coach
      // invitado, que aceptó y se quedó sin membresía.
      //
      // Ahora el manejador se basta a sí mismo: el payload trae lo necesario
      // para crear a la persona, y la organización se puede pedir a Clerk.
      const user =
        (await prisma.user.findUnique({ where: { clerkUserId: public_user_data.user_id } })) ??
        (public_user_data.identifier
          ? await upsertUserFromClerk(
              public_user_data.user_id,
              public_user_data.identifier,
              [public_user_data.first_name, public_user_data.last_name]
                .filter(Boolean)
                .join(" ") || public_user_data.identifier,
              public_user_data.image_url,
            )
          : null);

      let team = await prisma.team.findUnique({ where: { clerkOrgId: organization.id } });
      if (!team) {
        team = await upsertTeamFromClerkOrg(organization.id, organization.name, organization.slug);
      }

      if (!team || !user) break;

      // El rol sale de la invitación del club si existe (ahí quedó lo que
      // eligió quien invitó); si no, del rol de Clerk. Ver clerk-sync.ts.
      await upsertMembership(team.id, user.id, await resolveInitialRole(team.id, user.email, role));
      break;
    }

    case "organizationMembership.deleted": {
      const { organization, public_user_data } = event.data;
      const team = await prisma.team.findUnique({ where: { clerkOrgId: organization.id } });
      const user = await prisma.user.findUnique({ where: { clerkUserId: public_user_data.user_id } });
      if (!team || !user) break;

      // La membresía se marca REMOVED en vez de borrarse: su historial de
      // entrenamientos y asistencia sigue siendo del club.
      await prisma.teamMembership.updateMany({
        where: { teamId: team.id, userId: user.id },
        data: { status: "REMOVED" },
      });

      // La pertenencia a grupos SÍ se borra. Si se queda, el grupo sigue
      // contando y seleccionando a alguien que ya no está en el club: el chip
      // dice "Avanzados (8)" cuando solo 7 son visibles, y al guardar el grupo
      // la acción rechaza el id que la propia pantalla mandó.
      const memberships = await prisma.teamMembership.findMany({
        where: { teamId: team.id, userId: user.id },
        select: { id: true },
      });
      await prisma.trainingGroupMember.deleteMany({
        where: { membershipId: { in: memberships.map((m) => m.id) } },
      });
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
