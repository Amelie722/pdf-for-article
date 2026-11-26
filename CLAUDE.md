# 개발 규칙 (Claude용)

- 사용자는 개발 경험이 없다. 설명은 비개발자 기준, 한국어, 개조식.
- 대상 OS: Windows. 설치 파일은 GitHub Actions(windows-latest)에서 만든다. 리눅스 컨테이너에서는 wine 문제로 NSIS 빌드가 안 된다.
- 확장성이 요구사항이다:
  - 기능은 `src/main/modules/*`, `src/renderer/modules/*`의 모듈 단위로 추가하고 `index.ts`에 등록한다.
  - 모듈 간 연결은 `src/renderer/bus.ts` 이벤트로 한다. 이벤트를 추가하면 `BusEvents`에 타입을 적는다.
  - IPC 채널은 `src/shared/types.ts`의 `Channels`에 `모듈:동작` 형식으로 추가하고 `Api`·`preload.ts`를 함께 고친다.
  - DB 스키마 변경은 `src/main/db.ts`의 `MIGRATIONS` 끝에 추가만 한다. 기존 항목은 고치지 않는다.
- 문서 ID는 파일 내용의 SHA-256. 이름 변경·이동 후에도 주석이 유지되는 근거이므로 바꾸지 않는다.
- 주석 좌표는 페이지 대비 비율(0~1). 확대 배율에 의존하는 값을 저장하지 않는다.
- 확인: `npm run typecheck`, `npm run build` 후 Playwright `_electron`으로 xvfb에서 실제 앱 조작.

## 로드맵
1. (완료 v0.1.0) 리더, 하이라이트·메모, 모아보기
2. 논문 감지 → 논문 모드, `제1저자(연도)_제목.pdf` 이름 변경, 논문 폴더 이동, 컬렉션
3. `(KO)` 번역본: 그림·표 안 글자 포함, 학술·고유 용어 원문 유지, 사용자 Claude API 키
