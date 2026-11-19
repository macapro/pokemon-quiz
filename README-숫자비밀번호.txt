포켓몬 초성 퀴즈 - 숫자 멀티 비밀번호 패치

적용 내용
- 방 생성 시 방장이 숫자 비밀번호(4~8자리)를 직접 설정
- 방 참가 시 숫자 비밀번호 확인
- 비밀번호 입력칸은 모바일 숫자 키패드(inputmode=numeric)를 사용하고 숫자 외 문자는 자동 제거
- 방장만 게임 화면에서 비밀번호 변경 가능
- 비밀번호는 Durable Object에 PBKDF2-SHA-256 해시와 임의 salt로 저장
- 비밀번호 인증 전에는 멀티플레이 상태/문제 데이터에 접근할 수 없음

파일 적용 위치
1) public/index.html       -> Pages 프로젝트의 public/index.html 교체
2) public/app.js           -> Pages 프로젝트의 public/app.js 교체
3) public/style.css        -> Pages 프로젝트의 public/style.css 교체
4) public/_worker.js       -> Pages 프로젝트의 public/_worker.js 교체
5) room-worker/index.js    -> pokemon-quiz-rooms Durable Object Worker의 index.js 교체

wrangler 설정 파일은 참고용으로 함께 넣었습니다.
- wrangler.toml: Pages 프로젝트 설정
- room-worker/wrangler.toml: pokemon-quiz-rooms Worker 설정

배포 순서
1. pokemon-quiz-rooms Worker의 index.js를 교체하고 기존 방식대로 배포합니다.
2. Pages 프로젝트의 public 파일 4개를 교체하고 Pages를 배포합니다.
3. 배포 후 새 방을 만들어 테스트합니다.

주의
- 업데이트 전에 만들어진 기존 방은 비밀번호 정보가 없으므로 새 방을 만들어 사용하세요.
- 방 코드는 기존처럼 영문 대문자/숫자 6자리이며, 숫자만 입력하는 것은 방 비밀번호입니다.
- 비밀번호 길이는 4~8자리 숫자입니다.
