import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appUrl, absoluteUrl } from "./app-url";

const original = { app: process.env.NEXT_PUBLIC_APP_URL, vercel: process.env.VERCEL_PROJECT_PRODUCTION_URL };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  if (original.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = original.app;
  if (original.vercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  else process.env.VERCEL_PROJECT_PRODUCTION_URL = original.vercel;
});

describe("appUrl", () => {
  it("prefiere la variable explícita: es el dominio que la gente de verdad usa", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://tpeaks.vercel.app";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tpeaks-abc123.vercel.app";

    expect(appUrl()).toBe("https://tpeaks.vercel.app");
  });

  it("cae al dominio de producción que inyecta Vercel, para no configurar nada", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tpeaks-abc123.vercel.app";
    expect(appUrl()).toBe("https://tpeaks-abc123.vercel.app");
  });

  it("Vercel entrega el dominio sin protocolo y se le agrega https", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "ejemplo.vercel.app";
    expect(appUrl()).toBe("https://ejemplo.vercel.app");
  });

  it("respeta el protocolo si ya venía", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://mi-dominio.test";
    expect(appUrl()).toBe("http://mi-dominio.test");
  });

  it("quita la diagonal final, para no armar urls con doble slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://tpeaks.vercel.app/";
    expect(appUrl()).toBe("https://tpeaks.vercel.app");
  });

  it("ignora una variable vacía o de puros espacios", () => {
    process.env.NEXT_PUBLIC_APP_URL = "   ";
    expect(appUrl()).toBe("http://localhost:3000");
  });

  it("sin nada configurado, localhost", () => {
    expect(appUrl()).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://tpeaks.vercel.app";
  });

  // El correo de invitación se abre fuera de la app: una ruta relativa no sirve.
  it("devuelve una url absoluta", () => {
    expect(absoluteUrl("/coach")).toBe("https://tpeaks.vercel.app/coach");
  });

  it("tolera que la ruta venga sin diagonal inicial", () => {
    expect(absoluteUrl("coach")).toBe("https://tpeaks.vercel.app/coach");
  });

  it("la raíz no queda con doble diagonal", () => {
    expect(absoluteUrl("/")).toBe("https://tpeaks.vercel.app/");
  });
});
