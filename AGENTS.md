# Repository Guidelines

## 기본 원칙

추측하지 마세요.

저장소 구조, 기술 스택, 명령어, 테스트 방식은 실제 파일을 확인한 뒤 판단하세요.

작업 전에는 관련 파일, 설정 파일, 주변 코드를 먼저 읽으세요.

## 토큰 절약

셸 명령은 가능한 한 `rtk`를 붙여 실행하세요.

먼저 요약 명령으로 범위를 좁히세요.

```bash
rtk ls
rtk find . -maxdepth 2 -type f
rtk git status --short
rtk git diff --stat
rtk git diff --name-only
rtk rg "keyword" .
```

큰 로그, 전체 diff, 큰 파일 전체를 바로 출력하지 마세요.

## 프로젝트 확인

명령어는 설정 파일에서 확인하세요.

JavaScript 또는 TypeScript 프로젝트라면 `package.json`을 먼저 확인하세요.

```bash
rtk cat package.json 2>/dev/null || true
```

존재하지 않는 `npm run build`, `npm test`, `make test` 같은 명령어를 만들어내지 마세요.

`figma-token` 관련 작업은 먼저 관련 문서와 스펙 파일을 찾아 읽은 뒤 판단하세요.

## 코드 수정

기존 코드 스타일, import 방식, 파일 배치, 네이밍을 따르세요.

요청과 관련 없는 파일을 수정하거나 포맷팅하지 마세요.

파일을 생성하거나 수정하기 전에는 이미 존재하는지 확인하세요.

명시적인 지시 없이 기존 작업물을 덮어쓰거나 삭제하지 마세요.

## 이슈, PR, 커밋

이슈와 PR을 작성할 때는 먼저 `.github/ISSUE_TEMPLATE/`와 `.github/pull_request_template.md`가 있는지 확인하세요.

템플릿이 있으면 반드시 해당 양식을 따르세요.

커밋 메시지는 기존 커밋 스타일을 먼저 확인한 뒤 맞추세요.

기존 규칙이 없으면 다음 형식을 사용하세요.

```text
feat: add token parsing
fix: handle missing token config
docs: update spec notes
refactor: simplify sync logic
chore: update config
```

원인이 확실하지 않은 작업의 제목은 단정적으로 쓰지 마세요.

자세한 작업 흐름은 `CONTRIBUTING.md`를 확인하세요.

## 테스트와 보고

테스트 방식은 설정 파일과 기존 테스트 코드를 보고 판단하세요.

가능하면 관련 테스트를 실행하고 결과를 보고하세요.

작업 후에는 다음 내용을 간단히 보고하세요.

* 읽은 파일
* 변경한 파일
* 실행한 검증
* 검증하지 못했다면 이유
