# figma-token

`figma-token` applies a Figma Plugin `tokens.json` export to a project directory.

## Install

```bash
npm install --global figma-token
```

The Figma Plugin can download all six formats directly. Use this CLI when a project needs those files written to a predictable folder and checked for changes.

## Apply Plugin Tokens

```bash
figma-token ./figma-tokens.json
```

This creates the following files in `./figma-token-output/`:

```text
tokens.json
theme.ts
variables.css
tokens.scss
tailwind.css
tokens.dtcg.json
```

Choose a project directory with `--out`:

```bash
figma-token ./figma-tokens.json --out ./src/tokens
```

Preview all generated files without writing anything:

```bash
figma-token ./figma-tokens.json --dry-run
```

Check whether generated files are current:

```bash
figma-token check ./figma-tokens.json --out ./src/tokens
```

## Advanced Sync

The hidden `sync` command retains the previous single-format, snapshot, and Figma REST API flow for advanced users. It accepts `--input`, `--output`, `--snapshot`, `--format`, `--export-name`, `--figma-token`, `--file-key`, and `--dry-run`.

For Plugin usage and project-wide documentation, see <https://github.com/lee090626/Project-F>.
