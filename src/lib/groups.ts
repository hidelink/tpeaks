export type GroupSummary = {
  id: string;
  name: string;
  /** TeamMembership.id de cada socio del grupo. */
  memberIds: string[];
};

/**
 * Socios de los grupos dados, sin repetir. Importa porque un socio puede estar
 * en varios grupos a la vez ("avanzados" y "trail"): al asignar a los dos
 * grupos no debe recibir el entrenamiento dos veces.
 */
export function memberIdsOfGroups(groups: GroupSummary[], groupIds: string[]): string[] {
  const wanted = new Set(groupIds);
  const result = new Set<string>();
  for (const group of groups) {
    if (!wanted.has(group.id)) continue;
    for (const id of group.memberIds) result.add(id);
  }
  return [...result];
}

/**
 * Si todos los miembros del grupo ya están seleccionados. Un grupo vacío no
 * cuenta como "seleccionado": si no, el chip se vería activo sin haber elegido
 * a nadie.
 */
export function isGroupFullySelected(group: GroupSummary, selectedIds: string[]): boolean {
  if (group.memberIds.length === 0) return false;
  const selected = new Set(selectedIds);
  return group.memberIds.every((id) => selected.has(id));
}
