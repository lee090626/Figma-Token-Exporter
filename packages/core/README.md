# Core workspace package

This internal package normalizes Figma Variables data and renders design token files for the CLI and Figma Plugin. Install `figma-token` to use the public CLI.

## Exports

- `normalizeFigmaVariables` and `isDesignTokenArray` validate and normalize Figma Variables input.
- `diffTokens` compares normalized token arrays.
- `renderTokensJson`, `renderTheme`, `renderCssVariables`, `renderScssVariables`, `renderTailwindTheme`, and `renderDtcgJson` render export files.
- `generateVariableName` creates CSS-compatible variable names.

Supported token types are `color`, `spacing`, `radius`, `borderWidth`, `size`, `fontSize`, and `opacity`.

The renderers produce `tokens.json`, `theme.ts`, `variables.css`, `tokens.scss`, `tailwind.css`, and `tokens.dtcg.json` content.
