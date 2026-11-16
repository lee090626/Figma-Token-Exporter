import type { DesignToken, TokenDiff } from "./index.js";

export const compareTokens = (a: DesignToken, b: DesignToken) =>
  (a.collection ?? "").localeCompare(b.collection ?? "") ||
  (a.mode ?? "").localeCompare(b.mode ?? "") ||
  a.path.join("/").localeCompare(b.path.join("/"));

const identity = (token: DesignToken) => `${token.path.join("/")}\0${token.collection ?? ""}\0${token.mode ?? ""}`;

export function diffTokens(previous: DesignToken[], current: DesignToken[]): TokenDiff[] {
  const before = new Map(previous.map((token) => [identity(token), token]));
  const after = new Map(current.map((token) => [identity(token), token]));
  const diffs: TokenDiff[] = [];
  for (const [key, token] of after) {
    const old = before.get(key);
    if (!old) diffs.push({ type: "added", token });
    else if (JSON.stringify(old) !== JSON.stringify(token)) diffs.push({ type: "changed", token });
  }
  for (const [key, token] of before) if (!after.has(key)) diffs.push({ type: "removed", token });
  const order = { added: 0, changed: 1, removed: 2 };
  return diffs.sort((a, b) => compareTokens(a.token, b.token) || order[a.type] - order[b.type]);
}
