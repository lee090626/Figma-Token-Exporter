export interface ComponentVariant {
  name: string;
  nodeId: string;
  properties: Record<string, string>;
  variables: string[];
}

export interface ComponentManifest {
  component: {
    name: string;
    nodeId: string;
    type: "COMPONENT" | "COMPONENT_SET";
    variantProperties: Record<string, string[]>;
    variants: ComponentVariant[];
  };
  variables: string[];
}

export interface FrameManifest {
  frame: {
    name: string;
    nodeId: string;
    type: "FRAME";
  };
  tokens: Array<{
    name: string;
    usedBy: Array<{
      nodeId: string;
      name: string;
      type: string;
      path: string;
    }>;
  }>;
}

export function variableIdsFromBindings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(variableIdsFromBindings);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.type === "VARIABLE_ALIAS" && typeof record.id === "string") return [record.id];
  return Object.values(record).flatMap(variableIdsFromBindings);
}

export function createComponentManifest(
  component: Omit<ComponentManifest["component"], "variantProperties">,
  variables: string[]
): ComponentManifest {
  const variants = component.variants.map((variant) => ({ ...variant, properties: Object.fromEntries(Object.entries(variant.properties).sort()), variables: [...new Set(variant.variables)].sort() }));
  const variantProperties = Object.fromEntries(Object.entries(variants.reduce<Record<string, Set<string>>>((all, variant) => {
    for (const [name, value] of Object.entries(variant.properties)) (all[name] ??= new Set()).add(value);
    return all;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([name, values]) => [name, [...values].sort()]));
  return { component: { ...component, variantProperties, variants }, variables: [...new Set(variables)].sort() };
}

export function createFrameManifest(frame: FrameManifest["frame"], tokens: FrameManifest["tokens"]): FrameManifest {
  return {
    frame,
    tokens: tokens.map((token) => ({
      ...token,
      usedBy: [...new Map(token.usedBy.map((usage) => [usage.nodeId, usage])).values()]
        .sort((a, b) => a.path.localeCompare(b.path) || a.nodeId.localeCompare(b.nodeId))
    })).sort((a, b) => a.name.localeCompare(b.name))
  };
}
