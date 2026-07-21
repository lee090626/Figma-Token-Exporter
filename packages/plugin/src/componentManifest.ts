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
  frame: string;
  tokens: Record<string, string[]>;
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

export function createFrameManifest(frame: string, tokenUsages: Array<{ name: string; usedBy: string[] }>): FrameManifest {
  const tokens = new Map<string, string[]>();
  const prefix = `${frame} / `;
  for (const { name, usedBy } of tokenUsages) {
    const paths = tokens.get(name) ?? [];
    paths.push(...usedBy.map((path) => path === frame ? "." : path.startsWith(prefix) ? path.slice(prefix.length) : path));
    tokens.set(name, paths);
  }
  return {
    frame,
    tokens: Object.fromEntries([...tokens].sort(([a], [b]) => a.localeCompare(b)).map(([name, paths]) => [name, paths.sort()]))
  };
}
