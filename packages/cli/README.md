# figma-token

`figma-token` exports Figma Variables to design token files.

## Install

```bash
npm install --global figma-token
```

## Help

```bash
figma-token --help
figma-token sync --help
```

## Basic usage

Export a local Figma Variables JSON file:

```bash
figma-token sync --input ./figma-variables.json --format theme-ts --output ./theme.ts
```

Preview token changes without writing output or snapshot files:

```bash
figma-token sync --input ./figma-variables.json --dry-run
```

`--input` accepts a Figma Variables JSON response or a normalized `tokens.json` array. Without `--input`, provide `--figma-token` and `--file-key`, or set `FIGMA_TOKEN` and `FIGMA_FILE_KEY`.

## Options

`sync` supports `--input`, `--output`, `--snapshot`, `--format`, `--export-name`, `--figma-token`, `--file-key`, and `--dry-run`.

Supported formats are `tokens-json`, `theme-ts`, `variables-css`, `tokens-scss`, `tailwind-css`, and `tokens-dtcg-json`.

For Plugin usage and project-wide documentation, see <https://github.com/lee090626/Project-F>.
