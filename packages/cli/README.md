# figma-token

`figma-token` applies a Figma Plugin `tokens.json` export to a project directory.

## Install

```bash
npm install -D figma-token
```

The Figma Plugin can download a ZIP or all six formats directly. Use this optional CLI when a project needs those files written to a predictable folder and checked for changes.

## Apply Plugin Tokens

```bash
npx figma-token
```

Without an input path, the CLI reads `./tokens.json` from the current project and creates the following files in `./figma-token-output/`:

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
npx figma-token --out ./src/tokens
npx figma-token ./figma-export.json
```

Preview all generated files without writing anything:

```bash
npx figma-token --dry-run
```

Check whether generated files are current:

```bash
npx figma-token --check
npx figma-token --check --out ./src/tokens
```

`--check` and `--dry-run` cannot be used together. The old `check` subcommand is not supported.

## Advanced Sync

The hidden `sync` command retains the previous single-format, snapshot, and Figma REST API flow for advanced users. It accepts `--input`, `--output`, `--snapshot`, `--format`, `--export-name`, `--figma-token`, `--file-key`, and `--dry-run`.

For Plugin usage and project-wide documentation, see <https://github.com/lee090626/Project-F>.
