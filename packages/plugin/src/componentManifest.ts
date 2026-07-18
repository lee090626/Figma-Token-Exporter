export interface ComponentManifest {
  component: {
    name: string;
    nodeId: string;
    type: "COMPONENT" | "COMPONENT_SET";
    variants: string[];
  };
  variables: string[];
}

export function variableIdsFromBindings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(variableIdsFromBindings);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.type === "VARIABLE_ALIAS" && typeof record.id === "string") return [record.id];
  return Object.values(record).flatMap(variableIdsFromBindings);
}

export function createComponentManifest(component: ComponentManifest["component"], variables: string[]): ComponentManifest {
  return { component, variables: [...new Set(variables)].sort() };
}
