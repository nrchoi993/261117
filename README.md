# 오늘의 식탁

Vanilla JavaScript와 Vite로 만든 저녁 메뉴 상담 및 Google Form 연동 예시입니다. 코드 변경 전 [DEVELOPMENT.md](./DEVELOPMENT.md)의 작업 규칙을 확인하세요.

## 실행과 배포

```sh
npm install
npm run dev
npm run build
npm run preview
```

PowerShell 실행 정책이 `npm.ps1`을 차단하면 `npm.cmd run dev`, `npm.cmd run build`를 사용할 수 있습니다.

Netlify의 **Build command**는 `npm run build`, **Publish directory**는 `dist`입니다. Vite의 기본 루트 진입점 `index.html`과 기본 출력 폴더를 사용합니다. 별도 서버나 빌드 환경 변수는 필요하지 않습니다.

## 사용 방법

1. 학번과 이름을 입력하고 좋아하는 음식을 한 가지 이상 선택합니다. 음식은 다중 선택할 수 있습니다.
2. 설문 전송 안내에 동의하고, 본인의 OpenAI API Key를 입력한 뒤 **연결 확인**을 누릅니다. 실제 Responses API 호출에 성공해야 정상 작동으로 표시됩니다. 확인 요청에도 소량의 사용료가 발생합니다.
3. **채팅하기**를 누르고 질문을 보냅니다. 최초 안내 메시지는 대화 횟수에 포함하지 않으며, 사용자 질문과 API 답변이 두 쌍 이상 완료되면 **상담 종료하기** 버튼이 표시됩니다.
4. **상담 종료하기**를 누르면 학생 정보, 선택한 음식, 화면에 표시한 전체 대화를 Google Form으로 전송합니다.

## OpenAI 연결

- [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)를 `fetch`로 호출합니다. 외부 JavaScript 라이브러리나 CDN은 사용하지 않습니다.
- GPT 4 계열 경량 모델인 [`gpt-4.1-mini`](https://developers.openai.com/api/docs/models/gpt-4.1-mini)를 사용합니다. 호출과 모델 상수는 `src/openai.js`에 있습니다.
- 매 요청에 앞선 대화를 전달해 맥락을 유지하고 `store: false`를 설정합니다. 애플리케이션은 API Key나 대화를 localStorage, 쿠키, 서버에 저장하지 않으며 새로고침하면 사라집니다.
- 키는 OpenAI 인증 요청에만 사용하고 설문에는 포함하지 않습니다. 애플리케이션이 학번과 이름을 OpenAI 요청에 자동으로 첨부하지는 않습니다. 사용자가 메시지에 입력한 내용은 OpenAI로 전달됩니다.
- 프런트에서 개인 키를 입력하는 실습 구조입니다. 공용 키를 소스나 `VITE_*` 환경 변수에 넣지 마세요. 공용 키로 서비스를 운영할 때는 서버에서 인증 요청을 처리해야 합니다.

## Google Form 연결

연동 주소와 전송 함수는 `src/survey.js`에 있습니다.

| 항목 | Entry | 전송 내용 |
| --- | --- | --- |
| 학번 | `entry.70833716` | 입력한 학번 (문자열) |
| 이름 | `entry.1623743240` | 입력한 이름 |
| 좋아하는 음식 | `entry.1317938242` | 선택값을 쉼표로 연결, 예: `한식,양식` |
| 챗봇 대화 내용 | `entry.976474171` | 최초 안내와 모든 질문 및 답변, 역할 구분 포함 |

지정한 `formResponse` 주소에 `POST`, `mode: 'no-cors'`, `URLSearchParams` 본문으로 전송합니다. `no-cors`의 응답은 opaque이므로 HTTP 상태와 Google의 실제 저장 결과를 읽을 수 없습니다. 화면의 **전송 요청을 보냈어요**는 저장 확인을 의미하지 않습니다. 자동 재전송하지 않으며, 네트워크 오류가 발생하면 현재 대화를 유지하고 재시도 버튼을 제공합니다. 시간 초과 등으로 응답을 받지 못했어도 저장됐을 수 있어 재시도 전에 응답 목록을 확인해야 합니다.

Google Form은 응답 수집이 열려 있고 로그인 없이 제출할 수 있어야 합니다. 음식 질문은 쉼표로 연결된 텍스트를 받을 수 있는 단답형 또는 장문형으로 설정하고, 긴 대화를 받을 질문은 장문형으로 설정하세요. 실제 제출 후 Google Form의 **응답** 탭에서 네 항목이 저장되는지 확인하세요.

## 검증 범위

Vite 빌드와 Chrome의 모의 API 검증을 진행했습니다. API 연결 성공 및 실패, 키 변경 후 재확인, 실패한 메시지 복원, 대화 맥락 유지, 두 차례 대화 후 종료 버튼 표시, HTML 텍스트 처리, 설문 실패 후 재시도, 전송 항목과 전체 대화, 중복 전송 방지, 종료 후 키 삭제, 새 상담 초기화를 확인했습니다. 화면 폭 320, 375, 768, 1280, 1440, 1920px에서 가로 넘침이 없음을 확인했습니다.

실제 API Key가 제공되지 않아 OpenAI의 실제 응답은 검증하지 않았고, 테스트 데이터를 Google Form에 제출하지 않았습니다. 실제 설문 저장 여부는 위 사용 절차를 진행한 뒤 Google Form 응답 화면에서 확인해야 합니다.
