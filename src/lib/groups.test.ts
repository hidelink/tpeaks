import { describe, it, expect } from "vitest";
import { memberIdsOfGroups, isGroupFullySelected, type GroupSummary } from "./groups";

const avanzados: GroupSummary = { id: "g1", name: "Avanzados", memberIds: ["a", "b"] };
const trail: GroupSummary = { id: "g2", name: "Trail", memberIds: ["b", "c"] };
const vacio: GroupSummary = { id: "g3", name: "Nuevo", memberIds: [] };
const ALL = [avanzados, trail, vacio];

describe("memberIdsOfGroups", () => {
  it("junta los socios de los grupos elegidos", () => {
    expect(memberIdsOfGroups(ALL, ["g1"]).sort()).toEqual(["a", "b"]);
  });

  // Lo que motiva que exista esta función: sin deduplicar, asignar a los dos
  // grupos le crearía dos entrenamientos idénticos a quien está en ambos.
  it("no repite a quien está en dos grupos", () => {
    expect(memberIdsOfGroups(ALL, ["g1", "g2"]).sort()).toEqual(["a", "b", "c"]);
  });

  it("ignora ids de grupos que no existen", () => {
    expect(memberIdsOfGroups(ALL, ["g1", "fantasma"]).sort()).toEqual(["a", "b"]);
  });

  it("sin grupos elegidos, no devuelve a nadie", () => {
    expect(memberIdsOfGroups(ALL, [])).toEqual([]);
  });

  it("un grupo vacío no aporta socios", () => {
    expect(memberIdsOfGroups(ALL, ["g3"])).toEqual([]);
  });
});

describe("isGroupFullySelected", () => {
  it("es verdadero solo cuando están todos sus miembros", () => {
    expect(isGroupFullySelected(avanzados, ["a", "b"])).toBe(true);
    expect(isGroupFullySelected(avanzados, ["a"])).toBe(false);
  });

  it("no le molesta que haya seleccionados de fuera del grupo", () => {
    expect(isGroupFullySelected(avanzados, ["a", "b", "z"])).toBe(true);
  });

  it("un grupo vacío nunca cuenta como seleccionado", () => {
    // Si no, el chip de un grupo recién creado se vería activo sin que el
    // coach haya elegido a nadie.
    expect(isGroupFullySelected(vacio, [])).toBe(false);
    expect(isGroupFullySelected(vacio, ["a"])).toBe(false);
  });
});
