export type RecordValue = Record<string, unknown>;

export const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const words = (value: string): string[] => value
  .replace(/%/g, " percent ")
  .replace(/(^|[^A-Za-z0-9])-([0-9])/g, "$1 negative $2")
  .replace(/([0-9])\.([0-9])/g, "$1 dot $2")
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .match(/[A-Za-z0-9]+/g) ?? [];

export const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));
