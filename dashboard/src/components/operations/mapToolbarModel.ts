import type { EnvironmentDefinition } from "../../domain/types.ts";

export function getFloorOptions(definition: EnvironmentDefinition): Array<{ value: string; label: string }> {
  if (definition.floors.length < 2) return [];
  return [
    { value: "all", label: "All Floors" },
    ...definition.floors.map((floor) => ({ value: floor.id, label: floor.name })),
  ];
}
