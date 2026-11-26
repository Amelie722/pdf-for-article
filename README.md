# 논문 리더 (pdf-for-article)

논문을 내려받으면 바로 열어서 읽고, 하이라이트·메모하고, 정리하는 Windows용 PDF 리더.

## 설치

1. 이 저장소의 **Releases**에서 `PaperReader-Setup-x.y.z.exe`를 내려받아 실행합니다.
2. Windows가 "알 수 없는 게시자" 경고를 띄우면 **추가 정보 → 실행**을 누릅니다. (코드 서명 인증서가 없어서 나오는 경고입니다.)
3. PDF를 더블클릭하면 이 앱이 열리게 하려면:
   PDF 파일 우클릭 → **연결 프로그램 → 다른 앱 선택** → **논문 리더** 선택 → **항상 이 앱 사용** 체크.
   (Windows 10/11은 앱이 스스로 기본 프로그램이 될 수 없어서 한 번은 직접 골라야 합니다.)

## 지금 되는 기능 (1단계, v0.1.0)

- PDF 열기: 더블클릭, 끌어다 놓기, Ctrl+O, 최근 문서 목록
- 확대·축소: 버튼, Ctrl+휠, Ctrl+= / Ctrl+- / Ctrl+0(폭 맞춤)
- 하이라이트: 글자를 드래그 → 색(노랑·초록·파랑·분홍) 선택
- 메모: 글자를 드래그 → "메모" → 입력 (Ctrl+Enter 저장)
- 오른쪽 목록: 현재 문서의 하이라이트·메모, 색 변경, 메모 편집, 삭제, 클릭하면 해당 위치로 이동
- 모아보기 (Ctrl+Shift+A): 전체 문서의 하이라이트·메모를 문서별로 모아 보기, 종류·색·검색 필터, Markdown으로 복사
- 파일 이름을 바꾸거나 옮겨도 하이라이트가 유지됨 (파일 내용으로 문서를 식별)

데이터 위치: `%APPDATA%\PaperReader\library.sqlite`

## 앞으로 할 일

- **2단계** 논문 자동 감지 → 논문 모드, `제1저자(연도)_제목.pdf`로 이름 변경, 논문 폴더 이동, 컬렉션별 정리
- **3단계** 영어 논문 → 한국어 `(KO)` 번역본 생성 (그림·표 안 글자 포함, 학술 용어 원문 유지, Claude API 사용)

## 개발

```bash
npm install
npm start          # 빌드 후 앱 실행
npm run typecheck  # 타입 검사
npm run dist:win   # Windows 설치 파일 (Windows에서 실행)
```

설치 파일은 GitHub Actions(`.github/workflows/build-windows.yml`)가 Windows 서버에서 만듭니다. main에 올라가면 `package.json`의 버전으로 Releases에 자동으로 올라갑니다.

### 구조

```
src/
  shared/types.ts          main·화면이 함께 쓰는 타입, IPC 채널 이름
  main/                    Electron 메인 프로세스 (파일, DB)
    main.ts                시작점, 창, "PDF로 열기" 처리
    preload.ts             화면에 노출하는 함수 (window.api)
    db.ts                  SQLite(sql.js) + 스키마 마이그레이션
    modules/               기능 모듈 (documents, annotations, …)
  renderer/                화면
    app.ts                 시작점, 모듈 연결
    bus.ts                 모듈 간 이벤트
    modules/               기능 모듈 (viewer, annotations, collection, home, …)
```

새 기능은 `main/modules/`와 `renderer/modules/`에 모듈을 추가하고 각 `index.ts`에 등록합니다. 모듈끼리는 직접 부르지 않고 이벤트(`bus.ts`)로 연결합니다.
