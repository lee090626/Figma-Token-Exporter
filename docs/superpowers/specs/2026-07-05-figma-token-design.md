# figma-token MVP Design

## 목표와 범위

`figma-token`은 별도 서버 없이 Figma Variables를 로컬 디자인 토큰 파일로 동기화한다. 일반 사용자는 `packages/plugin`에서 현재 Figma 파일의 Variables를 JSON으로 내보낸 뒤 CLI에 전달한다. Enterprise 사용자는 기존 REST API 경로도 사용할 수 있다. 웹 서비스, 백엔드 서버, GitHub Action, PR 자동 생성은 범위에서 제외한다.

> 2026-07-07 변경: Variables REST API가 Enterprise 전용임을 확인해 일반 사용자용 Plugin export 경로를 MVP에 추가했다.

사용자는 `npx figma-token sync` 또는 workspace 개발 명령으로 Figma Variables를 가져오고, 이전 snapshot과 비교한 뒤 `tokens.json`이나 `theme.ts`를 생성할 수 있다.

root workspace package 이름은 publish 대상과 충돌하지 않는 private package `figma-token-monorepo`다. core는 CLI와 Plugin이 공유하는 private workspace package이며, publish 대상은 CLI `figma-token`뿐이다. CLI package는 `figma-token` binary를 노출해 npm 배포 후 `npx figma-token sync`와 일치시킨다.

## 패키지 경계

### `packages/core`

core는 런타임 외부 상태를 참조하지 않는 순수 TypeScript 라이브러리다.

- Figma API 응답 형태의 `unknown` 값을 `DesignToken[]`로 정규화한다.
- 이전 토큰과 현재 토큰을 안정적으로 비교한다.
- pretty JSON과 중첩 TypeScript theme 문자열을 생성한다.
- API 호출, 파일 I/O, 환경변수 접근, 로깅을 하지 않는다.

### `packages/cli`

CLI는 외부 경계와 실행 흐름을 담당한다.

- commander로 `sync` 명령과 옵션을 제공한다.
- dotenv를 통해 `.env`를 로드하고 CLI 옵션, 환경변수, 기본값 순으로 설정을 결정한다.
- `X-Figma-Token` 헤더와 `fetch`를 사용해 Figma Variables API를 호출한다.
- `--input <path>`가 있으면 API 대신 로컬 Figma Variables 응답 JSON을 읽는다.
- snapshot을 읽고 결과물과 현재 snapshot을 저장한다.
- diff 개수와 변경 경로를 출력하되 Figma token은 어떤 로그에도 출력하지 않는다.
- 설정, API, 파일 오류를 이해하기 쉬운 메시지로 변환하고 exit code 1을 설정한다.

## 데이터 모델과 정규화

core의 공개 타입은 `TokenType`, `DesignToken`, `TokenDiff`다. 각 normalized token은 이름, slash 기준 path, 값 타입과 값, 선택적인 collection 이름, mode 이름, 설명을 가진다.

정규화기는 Figma 응답의 일반적인 `meta.variables`/`meta.variableCollections` 구조와 최상위 `variables`/`variableCollections` 구조를 모두 탐색한다. 객체와 필드를 런타임에서 확인하고 잘못된 항목은 전체 실행을 중단시키지 않는다.

- `color/brand/primary`는 `["color", "brand", "primary"]`가 된다.
- Figma `COLOR`, `FLOAT`, `STRING`, `BOOLEAN` resolved type을 각각 `color`, `number`, `string`, `boolean`으로 매핑한다.
- RGBA의 0~1 채널은 `#rrggbb`로 변환하며 alpha가 1 미만이면 `#rrggbbaa`를 사용한다.
- collection의 mode ID를 mode name으로 해석한다.
- `deletedButReferenced`가 `true`인 variable은 삭제된 토큰이 결과에 남지 않도록 output과 snapshot의 기반이 되는 normalized tokens에서 제외한다.
- VariableAlias는 실행을 중단시키지 않고 `unknown`과 `null`로 보존한다. alias ID가 문자열이면 기존 설명을 유지하면서 `Alias to <variableId>` 정보를 description에 추가해 디버깅할 수 있게 한다.
- 그 밖에 직접 표현할 수 없는 값은 `unknown`과 `null`로 보존한다.
- 결과는 collection, mode, path 기준으로 결정적으로 정렬한다.

## Diff

토큰 identity는 `path + collection + mode` 조합이다. 이전/현재 배열을 map으로 변환해 추가, 삭제, 변경을 찾는다. 변경 여부는 사용자에게 의미 있는 token payload 전체를 비교하되 identity 자체는 key로 사용한다. 결과는 path, collection, mode, diff type 순으로 정렬해 입력 순서와 무관하게 항상 동일하다.

## 출력 형식

`tokens.json`은 normalized `DesignToken[]`를 2-space pretty JSON과 마지막 개행으로 출력한다. 이 형식은 snapshot과 동일한 공개 데이터 모델을 유지해 자동화에서 다시 읽기 쉽다.

`theme.ts`는 값만 포함하는 plain object를 `export const <exportName> = ... as const;` 형태로 출력한다.

normalized token의 value가 `null`이면 `theme.ts`에서 제외한다. 따라서 해석되지 않은 VariableAlias와 지원하지 않는 값은 executable theme에 들어가지 않지만, `tokens.json`과 snapshot에는 `unknown/null` 상태로 보존된다.

- mode가 없거나 collection에서 해석되지 않으면 내부적으로 `default` mode로 간주한다.
- 전체 normalized tokens에서 최종 mode set을 만든다. set이 `default` 하나뿐이거나 다른 단일 mode 하나뿐이면 mode key를 생략하고 `theme.color.brand.primary`처럼 만든다.
- mode set에 둘 이상의 mode가 있으면 정규화한 mode key를 최상위에 둔다. `light`와 `dark`이면 `theme.light.color.brand.primary`와 `theme.dark.color.brand.primary`가 되고, `default`와 `dark`이면 `theme.default.color.brand.primary`와 `theme.dark.color.brand.primary`가 된다.
- mode 이름은 기호와 공백을 단어 경계로 처리한 camelCase로 변환한다. `Light`는 `light`, `Dark`는 `dark`, `Light Mode`는 `lightMode`가 된다.
- 비어 있거나 알 수 없는 mode는 `default`가 된다.
- 숫자로 시작하거나 TypeScript 식별자에 안전하지 않은 key는 안전한 camelCase key로 보정한다.
- 정규화된 mode key가 충돌하면 정렬 순서에 따라 `Mode2`, `Mode3` 형태의 결정적인 접미사를 붙인다.
- 같은 출력 경로가 중복되면 데이터 손실을 피하기 위해 명확한 오류를 발생시킨다.

`exportName`도 TypeScript 식별자로 검증하며 유효하지 않으면 생성 단계에서 명확한 오류를 발생시킨다.

## CLI 실행 흐름

`figma-token sync`는 다음 순서로 실행한다.

1. `.env`를 로드한다.
2. CLI 옵션, 환경변수, 기본값 순으로 설정을 결정한다.
3. format을 허용된 값으로 제한한다. `--input`이 없을 때만 Figma token과 file key를 필수값으로 검증한다.
4. `--input <path>`가 있으면 해당 JSON 파일을 Figma Variables API 응답으로 읽는다. input이 없을 때만 격리된 API client에서 Variables 응답을 가져온다. `--input`, `--figma-token`, `--file-key`가 함께 있어도 input을 우선하며 API를 호출하지 않는다.
5. core 정규화기로 `DesignToken[]`를 만든다.
6. snapshot이 있으면 JSON을 읽고 최소 형태 검증 후 이전 토큰으로 사용한다. 없으면 빈 배열로 처리한다.
7. diff를 계산하고 Added/Changed/Removed 개수와 경로 중심 상세를 출력한다. 사용자의 실제 Figma 인증 token은 절대 출력하지 않는다.
8. `--dry-run`이면 여기서 종료하고 어떤 파일도 쓰지 않는다.
9. dry run이 아니면 format에 맞는 결과 파일과 pretty JSON snapshot을 저장한다. 부모 디렉터리는 필요할 때 생성한다.
10. 성공 시 0, 실패 시 이해 가능한 오류 메시지와 함께 1로 종료한다.

기본 설정은 output `./tokens.json`, format `tokens-json`, snapshot `.figma-token/snapshot.json`, export name `theme`이다.

`--dry-run`도 선택된 입력 소스에 따라 Figma API 호출 또는 input JSON 읽기, 정규화, snapshot 읽기, diff 계산과 터미널 출력까지 수행한다. 단지 output과 snapshot 파일 쓰기만 금지한다.

## API와 변경 용이성

Figma endpoint는 `packages/cli/src/figma/fetchFigmaVariables.ts` 한 파일에 상수로 격리한다. 현재 Variables REST endpoint를 사용하되, Figma API 변경 시 이 파일만 수정하면 된다는 주석을 둔다. 응답 status가 성공이 아니면 status를 포함하되 응답 본문이나 token은 노출하지 않는 오류를 던진다.

- status 403: `Figma Variables API 접근이 거부되었습니다. Figma plan, 해당 file 접근 권한, token scope(file_variables:read)를 확인해 주세요.`
- status 429: `Figma API rate limit에 도달했습니다. 잠시 후 다시 실행해 주세요.`

MVP에서는 자동 재시도를 하지 않는다. 공식 Figma 문서상 Variables scope와 endpoint 사용 가능 여부는 계정/조직 plan 및 권한의 영향을 받으므로, 403은 일반 API 오류와 분리한다.

향후 GitHub Action은 core를 그대로 재사용하고 CLI 실행 환경만 감싸는 방식으로 추가할 수 있다.

## 패키징과 binary

CLI entry인 `packages/cli/src/index.ts` 첫 줄에는 `#!/usr/bin/env node` shebang을 둔다. tsup의 banner 설정으로 build된 `dist/index.js`에도 shebang이 정확히 하나 유지되게 하고, CLI package의 `bin.figma-token`은 `dist/index.js`를 가리킨다. build 후 파일 실행 권한과 Node 실행 가능 여부를 확인한다.

`.env`는 `.gitignore`에 포함해 절대 커밋하지 않는다. 필요한 key와 비어 있는 예시값만 담은 `.env.example`을 추적한다.

## 테스트와 검증

Vitest로 다음 동작을 검증한다.

- variable name의 slash path 변환
- RGBA의 hex 변환과 alpha 처리
- number, string, boolean 및 방어적 입력 처리
- VariableAlias의 unknown/null 변환과 alias ID 보존
- `deletedButReferenced` variable 제외
- added, removed, changed diff 감지
- 입력 순서와 무관한 diff 안정 정렬
- 단일 mode의 중첩 theme 생성
- 여러 mode의 최상위 mode key 및 mode 이름 정규화
- `theme.ts`의 null token 제외와 `tokens.json`/snapshot 보존
- CLI 설정 우선순위, input의 API 우선 규칙, dry-run 파일 쓰기 금지
- API 403 권한 안내와 429 rate limit 전용 오류

구현은 테스트를 먼저 실패시키고 최소 구현으로 통과시키는 순서로 진행한다. 마지막에 `pnpm install`, `pnpm build`, `pnpm test`와 CLI help/dry-run 경로를 실행해 TypeScript, 번들, 테스트, binary 진입점을 확인한다. 전역 `figma-token --help`를 직접 실행할 수 없는 환경이면 `pnpm --filter figma-token exec figma-token --help`, workspace dev 명령, 또는 `node packages/cli/dist/index.js --help`로 동등하게 검증한다.

## 문서

한국어 README에는 프로젝트 목적, 제외 범위, 설치와 build, `.env` 설정, CLI와 dry-run 예시, 두 출력 형식 예시, 향후 GitHub Action/PR 자동 생성/Figma Plugin/포맷 커스터마이징 계획을 포함한다.

또한 다음 제약을 명시한다.

- Figma Personal Access Token이 필요하며 파일 접근 권한이 없거나 Variables API를 사용할 수 없는 환경에서는 동기화가 실패할 수 있다.
- Figma Variables REST API는 계정/조직 plan에 따라 사용할 수 없을 수 있다. API 사용 시 해당 file 접근 권한과 token의 `file_variables:read` scope를 확인해야 한다.
- 서로 다른 collection이 같은 path와 mode를 만들어도 theme 출력에서는 collection을 자동으로 포함하거나 병합하지 않는다. 동일한 theme 출력 경로가 여러 토큰에서 생성되면 명확한 오류가 발생한다.
- collection을 출력 경로에 포함하는 `--include-collection` 같은 기능은 향후 확장 범위이며 MVP에는 포함하지 않는다.

실제 API 없이 개발, 테스트, 시연할 수 있도록 `fixtures/figma-variables.json` 예제와 다음 명령을 문서화한다.

```bash
figma-token sync \
  --input ./fixtures/figma-variables.json \
  --output ./tokens.json \
  --format tokens-json \
  --dry-run
```
