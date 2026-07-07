# Contributing Guide

## 작업 흐름

기본 작업 흐름은 다음 순서를 따릅니다.

```text
이슈 확인 또는 생성
→ 브랜치 생성
→ 코드 수정
→ 테스트 실행
→ 커밋
→ 푸쉬
→ PR 생성
```

## 1. 이슈 확인 또는 생성

작업 전 관련 이슈가 있는지 확인하세요.

관련 이슈가 없다면 `.github/ISSUE_TEMPLATE/`의 양식을 사용해 이슈를 작성하세요.

문제 원인이나 해결 방법이 확실하지 않다면 제목을 단정적으로 쓰지 마세요.

## 2. 브랜치 생성

브랜치 이름은 작업 내용을 짧고 명확하게 작성하세요.

예시:

```text
feat/token-parser
fix/missing-token-config
docs/update-spec-notes
refactor/sync-logic
```

## 3. 코드 수정

작업 전 관련 파일과 주변 코드를 먼저 확인하세요.

기존 코드 스타일, 파일 배치, 네이밍을 따르세요.

요청과 관련 없는 파일은 수정하지 마세요.

## 4. 테스트 실행

프로젝트 설정 파일에서 실제 테스트 명령어를 확인한 뒤 실행하세요.

존재하지 않는 테스트 명령어를 만들어내지 마세요.

테스트를 실행하지 못했다면 이유를 PR에 작성하세요.

## 5. 커밋

커밋 메시지는 기존 커밋 스타일을 우선 따르세요.

기존 규칙이 없다면 다음 형식을 사용하세요.

```text
feat: add token parsing
fix: handle missing token config
docs: update spec notes
refactor: simplify sync logic
chore: update config
```

## 6. 푸쉬

작업 브랜치를 원격 저장소에 푸쉬하세요.

```bash
git push origin <branch-name>
```

## 7. PR 생성

PR은 `.github/pull_request_template.md` 양식을 따르세요.

PR에는 변경 요약, 변경 이유, 테스트 결과, 관련 이슈를 포함하세요.

UI 변경이 있을 때만 스크린샷을 첨부하세요.
