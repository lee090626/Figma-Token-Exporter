# @lee090626/core

`@lee090626/core` normalizes Figma Variables data and renders design token files. It has no Figma API or file-system dependency.

## Install

```bash
npm install @lee090626/core
```

## Basic usage

```ts
import { normalizeFigmaVariables, renderTheme } from "@lee090626/core";

const tokens = normalizeFigmaVariables(figmaVariables);
const theme = renderTheme(tokens);
```

## Exports

- `normalizeFigmaVariables` and `isDesignTokenArray` validate and normalize Figma Variables input.
- `diffTokens` compares normalized token arrays.
- `renderTokensJson`, `renderTheme`, `renderCssVariables`, `renderScssVariables`, `renderTailwindTheme`, and `renderDtcgJson` render export files.
- `generateVariableName` creates CSS-compatible variable names.

Supported token types are `color`, `spacing`, `radius`, `borderWidth`, `size`, `fontSize`, and `opacity`.

The renderers produce `tokens.json`, `theme.ts`, `variables.css`, `tokens.scss`, `tailwind.css`, and `tokens.dtcg.json` content.
