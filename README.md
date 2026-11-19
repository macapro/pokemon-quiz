# 포켓몬 초성 퀴즈 (Cloudflare Pages)

일반 포켓몬과 메가진화 포켓몬이 함께 출제되는 반응형 웹 퀴즈입니다.

## 기능
- 개인 플레이: 문제 풀이, 힌트, 2분 제한, 정답 후 5초 뒤 자동 출제, 브라우저에 점수/최고 기록 저장
- 실시간 멀티플레이: 방 생성/참가 코드, 숫자 비밀번호(4~8자리), 방장 비밀번호 변경, 실시간 문제/정답/점수/순위, 2분 제한과 자동 다음 문제
- 힌트: 타입, 세대/지방, 첫·끝 글자, 도감 설명
- 기본 정답 점수 14점, 힌트 1회당 2점 차감
- 모바일/PC 반응형 화면

## 배포 전 참고
이 프로젝트는 사용자가 제공한 `포켓몬+메가.txt`의 `pokemonTypes`, `pokemonGenerations`, `customPokemonDescriptions` 데이터를 추출해 사용합니다. 파일의 타입/세대 데이터는 950종, 직접 작성된 도감 설명은 220종입니다. 파일에 직접 작성된 220개 설명을 우선 사용하고, 나머지는 PokéAPI의 한국어 전국도감 설명을 조회합니다. 메가진화 등 API에 별도 종 번호가 없는 이름은 직접 작성된 설명이 있을 때 표시됩니다.

멀티플레이 방과 점수는 별도 Cloudflare Durable Objects Worker에 저장됩니다. 개인 플레이 점수는 현재 브라우저의 localStorage에 저장되므로 다른 기기와 동기화되지 않습니다. 계정 로그인/기기 간 동기화는 별도 인증 및 데이터베이스 연동이 필요합니다.

## Cloudflare Pages 배포

Cloudflare 공식 안내에 따라 Durable Object는 Pages 프로젝트 안에서 직접 생성하지 않고, 별도 Worker로 배포한 뒤 Pages에 바인딩합니다.

1. 이 폴더 전체를 GitHub 저장소에 업로드합니다.
2. Cloudflare 로그인 후 프로젝트 폴더에서 `npx wrangler deploy --config room-worker/wrangler.toml`을 실행해 `pokemon-quiz-rooms` Durable Objects Worker를 먼저 배포합니다. 첫 배포에서 SQLite migration `v1`이 생성됩니다.
3. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git에서 같은 저장소를 연결합니다.
4. Framework preset은 `None`, Build command는 비워두고 Build output directory는 `public`으로 지정합니다.
5. Pages 프로젝트의 Wrangler 설정(`wrangler.toml`)에서 `ROOMS` 바인딩이 `pokemon-quiz-rooms` 스크립트를 참조하는지 확인합니다. 대시보드에서 수동 설정할 경우 Pages 프로젝트 → Settings → Bindings → Add → Durable Object에서 변수 이름 `ROOMS`, Durable Object namespace `PokemonRoom`을 선택한 뒤 재배포합니다.
6. 배포 후 `https://프로젝트이름.pages.dev`에서 접속합니다.

Pages 프로젝트 생성 후 CLI 배포를 원하면 `npx wrangler pages deploy public --project-name pokemon-initial-quiz`를 사용할 수 있습니다. Pages 프로젝트에 `wrangler.toml`을 연결할 때는 대시보드 설정과 파일 설정이 일치하는지 먼저 확인하세요.

## 데이터/동작 관련
- 현재 제공된 코드에서 `pokemonTypes` 및 `pokemonGenerations`에 실제로 존재하는 1121개 키를 출제 대상으로 사용합니다. 누락된 타입/세대 정보는 임의로 채우지 않습니다.
- Mega 포켓몬 첫 글자 힌트는 `메가`, 이름 끝이 X/Y인 경우 마지막 글자 힌트는 X 또는 Y로 표시합니다.
- 개인 점수는 동일 브라우저에 저장됩니다. 멀티플레이 점수는 방 단위로 유지되며, 방 코드를 알고 있는 참가자끼리 공유됩니다.
- 이 프로젝트는 팬메이드 퀴즈이며 Pokémon 상표/저작권은 각 권리자에게 있습니다.


## 방장 권한
- 게임방을 만든 주최자가 자동으로 방장이 됩니다.
- 방장은 실시간 순위에 👑 방장으로 표시됩니다.
- 방장만 방 비밀번호를 변경할 수 있습니다.
- 방장이 게임을 종료하거나 나가면 방이 초기화되고, 일반 참가자가 나가면 방은 유지됩니다.
