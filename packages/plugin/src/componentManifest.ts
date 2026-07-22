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
  const variants = component.variants.map(normalizeVariant);
  return {
    component: { ...component, variants, variantProperties: collectVariantProperties(variants) },
    variables: uniqueSorted(variables)
  };
}

export function createFrameManifest(frame: string, tokenUsages: Array<{ name: string; usedBy: string[] }>): FrameManifest {
  const usageByToken = new Map<string, string[]>();
  for (const { name, usedBy } of tokenUsages) {
    const paths = usageByToken.get(name) ?? [];
    paths.push(...usedBy.map((path) => relativePath(frame, path)));
    usageByToken.set(name, paths);
  }
  return {
    frame,
    tokens: Object.fromEntries(sortedEntries(usageByToken).map(([name, paths]) => [name, paths.sort()]))
  };
}

function normalizeVariant(variant: ComponentVariant): ComponentVariant {
  return {
    ...variant,
    properties: Object.fromEntries(sortedEntries(variant.properties)),
    variables: uniqueSorted(variant.variables)
  };
}

function collectVariantProperties(variants: ComponentVariant[]) {
  const valuesByProperty = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.properties)) {
      const values = valuesByProperty.get(name) ?? new Set<string>();
      values.add(value);
      valuesByProperty.set(name, values);
    }
  }
  return Object.fromEntries(sortedEntries(valuesByProperty).map(([name, values]) => [name, uniqueSorted(values)]));
}

function relativePath(frame: string, path: string) {
  if (path === frame) return ".";
  const prefix = `${frame} / `;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set(values)].sort();
}

function sortedEntries<T>(values: Map<string, T> | Record<string, T>) {
  return [...(values instanceof Map ? values.entries() : Object.entries(values))].sort(([a], [b]) => a.localeCompare(b));
}
