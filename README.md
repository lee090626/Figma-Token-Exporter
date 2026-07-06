# figma-token-pr

Figma Plugin으로 현재 파일의 Variables를 내보내고, CLI로 `tokens.json` 또는 `theme.ts`를 생성합니다. Enterprise 사용자는 기존 REST API 방식도 사용할 수 있습니다.

## 설치와 실행

```bash
pnpm install
pnpm build
node packages/cli/dist/index.js sync --input fixtures/figma-variables.json --dry-run
```

## 일반 사용자: Plugin + CLI

1. `pnpm build`를 실행합니다.
2. Figma 데스크톱 앱에서 `Plugins > Development > Import plugin from manifest...`를 선택합니다.
3. `packages/plugin/manifest.json`을 선택하고 플러그인을 실행합니다.
4. `figma-tokens.json`을 다운로드합니다.
5. CLI로 변환합니다.

```bash
node packages/cli/dist/index.js sync --input ~/Downloads/figma-tokens.json
node packages/cli/dist/index.js sync --input ~/Downloads/figma-tokens.json --format theme-ts --output theme.ts
```

## Enterprise 사용자: REST API

`.env.example`을 `.env`로 복사하고 `FIGMA_TOKEN`, `FIGMA_FILE_KEY`를 설정합니다. CLI 옵션은 환경변수보다 우선합니다.

```bash
npx figma-token-pr sync --format tokens-json --output ./tokens.json
npx figma-token-pr sync --format theme-ts --output ./theme.ts --export-name theme
```

`tokens-json`은 normalized token 배열을, `theme-ts`는 값만 중첩한 `export const theme = ... as const`를 만듭니다. `--dry-run`은 입력과 snapshot을 읽고 diff를 출력하지만 파일은 쓰지 않습니다.

REST API에는 Enterprise 조직의 Full seat, file 접근 권한과 `file_variables:read` scope가 필요합니다. 일반 사용자는 Plugin 방식을 사용합니다. 서로 다른 collection이 동일한 mode/path를 만들면 theme 생성은 데이터 손실 대신 오류로 종료합니다.

웹 서비스, 백엔드, GitHub Action, PR 자동 생성, collection 경로 포함과 포맷 커스터마이징은 범위에서 제외합니다.
