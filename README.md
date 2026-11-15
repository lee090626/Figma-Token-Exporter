# figma-token

Figma Plugin에서 현재 파일의 Variables를 읽어 개발자가 바로 쓰는 코드 파일로 다운로드합니다. 토큰 생성/편집/저장소 동기화는 하지 않는 lightweight exporter입니다.

Figma에서 바뀐 토큰이 코드에 반영되지 않았으면 PR 단계에서 막습니다.

```bash
npx figma-token sync --check --format variables-css --output ./src/tokens/variables.css
```

```text
Added: 0
Changed: 1
Removed: 0
changed color/primary
Out of date with Figma: ./src/tokens/variables.css (changed)
Fix: npx figma-token sync --format variables-css --output ./src/tokens/variables.css
```

GitHub Actions 설정은 [CI drift check](#ci-drift-check)를 참고하세요. Plugin의 "workflow 복사" 버튼으로도 받을 수 있습니다.

모든 기능은 무료입니다. PR 코멘트 리포트, 여러 형식 한 번에 검사, 알림 같은 팀 기능이 필요하면 [대기 명단](https://github.com/lee090626/Figma-Token-Exporter/issues/new?template=team-waitlist.yml)에 남겨 주세요.

Phase 1 export:

- `tokens.json`
- `theme.ts`
- `variables.css`
- `tokens.scss`
- `tailwind.css` (Tailwind v4 `@theme`)
- `tokens.dtcg.json`

## 설치와 실행

```bash
npm install -D figma-token
npx figma-token
npx figma-token --check
npx figma-token --dry-run
npx figma-token --out src/tokens
npx figma-token ./figma-export.json
```

입력 파일을 생략하면 현재 프로젝트의 `./tokens.json`을 사용합니다.

## 일반 사용자: Plugin

1. `pnpm build`를 실행합니다.
2. Figma 데스크톱 앱에서 `Plugins > Development > Import plugin from manifest...`를 선택합니다.
3. `packages/plugin/manifest.json`을 선택하고 플러그인을 실행합니다.
4. 전체 파일 ZIP 또는 필요한 개별 포맷을 다운로드합니다.

터미널이나 Personal Access Token은 필요하지 않습니다.

## 개발자 자동화: CLI

Plugin은 ZIP 또는 6개 포맷을 직접 다운로드할 수 있습니다. CLI는 Plugin의 `tokens.json`을 프로젝트의 정해진 폴더에 적용하고 최신 상태를 확인할 때 사용하는 선택 도구입니다.

```bash
npx figma-token --out ./src/tokens
npx figma-token --check --out ./src/tokens
```

## Enterprise 사용자: REST API

`.env.example`을 `.env`로 복사하고 `FIGMA_TOKEN`, `FIGMA_FILE_KEY`를 설정합니다. 이 경로는 숨김 고급 `sync` 명령으로 유지됩니다. CLI 옵션은 환경변수보다 우선합니다.

```bash
npx figma-token sync --format tokens-json --output ./tokens.json
npx figma-token sync --format theme-ts --output ./theme.ts --export-name theme
npx figma-token sync --format variables-css --output ./variables.css
npx figma-token sync --format tokens-scss --output ./tokens.scss
npx figma-token sync --format tailwind-css --output ./tailwind.css
npx figma-token sync --format tokens-dtcg-json --output ./tokens.dtcg.json
```

### CI drift check

`sync --check`는 Figma 최신 Variables로 만든 결과와 저장소의 출력 파일을 비교합니다. 파일을 쓰지 않으며, 다르거나 파일이 없으면 snapshot 대비 변경 토큰 목록을 출력하고 exit code 1로 끝납니다. 고치는 명령(`Fix: …`)도 함께 출력합니다. GitHub Actions에서는 같은 내용을 Job Summary에 표로 남깁니다.

```bash
npx figma-token sync --check --format variables-css --output ./src/tokens/variables.css
```

```yaml
# .github/workflows/figma-token.yml
on: [pull_request]
jobs:
  figma-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx figma-token sync --check --format variables-css --output ./src/tokens/variables.css
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ secrets.FIGMA_FILE_KEY }}
```

`tokens-json`은 normalized token 배열을, 나머지 포맷은 이 배열만 입력으로 변환합니다. `--dry-run`은 입력과 snapshot을 읽고 diff를 출력하지만 파일은 쓰지 않습니다.

Phase 1 지원 타입은 `color`, `spacing`, `radius`, `borderWidth`, `size`, `fontSize`, `opacity`입니다. Figma `FLOAT` 변수는 이름의 첫 경로 segment로 타입을 판정합니다. 예: `spacing/small`, `borderWidth/thin`, `fontSize/body`. 그 외 타입은 export하지 않고 skip 로그만 남깁니다.

REST API에는 Enterprise 조직의 Full seat, file 접근 권한과 `file_variables:read` scope가 필요합니다. 일반 사용자는 Plugin 방식을 사용합니다. Phase 1은 default mode 하나만 export하고 alias는 최종 값으로 치환합니다. Alias target에 선택된 mode 값이 없으면 다른 mode로 대체하지 않고 skip하며 warning을 출력합니다.

Android/iOS export, typography/shadow/fontWeight/lineHeight, multi-mode 분기, alias 참조 유지, 토큰 편집 UI, GitHub/원격 저장소 동기화는 범위에서 제외합니다.
