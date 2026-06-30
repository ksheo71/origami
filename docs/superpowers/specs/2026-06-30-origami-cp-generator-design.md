# Origami CP Generator — 설계 문서

- **상태**: Draft (브레인스토밍 완료, 사용자 리뷰 대기)
- **작성일**: 2026-06-30
- **저장소(예정)**: `ksheo71/origami`
- **운영 URL(예정)**: `https://origami.myazit.kr`
- **참조 인프라**: `/opt/stack/CLAUDE.md` (kyle-mini 자가호스팅 구조)

## 1. 시스템 개요 및 사용자 흐름

### 1.1 한 줄 정의

사용자가 동물 이름을 입력하면 → LLM이 동물의 스틱 피겨(트리)를 만들고 → TreeMaker 엔진이 그 트리에서 종이 한 장으로 접을 수 있는 전개도(CP)를 생성하고 → Origami Simulator가 그 CP가 실제로 어떻게 접히는지 3D로 보여주는 웹 앱.

### 1.2 핵심 흐름

```
1. 사용자: "도마뱀" 입력 → Enter
2. (1~3초) LLM이 트리(스틱 피겨) JSON 생성 → 작은 미리보기 표시
3. (2~10초) TreeMaker 엔진(브라우저, Web Worker)이 트리 → CP(FOLD) 변환
4. 화면 분할
   - 왼쪽: 2D CP (산접기 빨강, 골접기 파랑)
   - 오른쪽: 3D 모델 (Origami Simulator iframe)
5. 사용자 컨트롤: 접기 진행도 슬라이더(0~100%), 재시도, 다른 동물, 다운로드, URL 공유
```

### 1.3 범위

**MVP에 포함**
- 동물 이름 텍스트 한 줄 입력
- LLM이 자동으로 스틱 피겨 생성 (사용자 편집 없음)
- TreeMaker 핵심 알고리즘(uniaxial base + circle-river packing + universal molecule)을 자체 TypeScript로 구현
- 2D CP 표시 + 3D 접기 시뮬레이션
- URL로 결과 공유

**비목표 (이번 버전 제외)**
- 사용자 인증, 갤러리, 댓글, 저장소
- 트리 직접 편집 UI (LLM 결과 그대로 사용)
- 임의 3D 메쉬 → CP (Origamizer 류)
- 사진 입력
- 인쇄용 단계별 다이어그램 (Yoshizawa-Randlett)

### 1.4 성공 기준

- "학", "도마뱀", "사자", "물고기", "거북이" 5종이 15초 이내에 *접을 수 있는* CP를 생성
- 생성된 CP가 Origami Simulator에서 발산 없이 접힘
- URL 공유 시 다른 브라우저에서 동일 결과 (결정성)

## 2. 아키텍처

### 2.1 트래픽 hop (외부 노출)

```
사용자 브라우저
  └─ HTTPS ─▶ Cloudflare Edge (TLS 종단)
       └─ Tunnel ─▶ cloudflared 컨테이너
            └─ HTTP ─▶ caddy 컨테이너 (:80)
                 └─ reverse_proxy ─▶ origami-app:3150
```

`*.myazit.kr` 와일드카드가 이미 잡혀 있어 Cloudflare 대시보드 수정 불필요. Caddyfile에 한 줄 추가하면 끝.

```caddy
http://origami.myazit.kr {
    import common
    reverse_proxy origami-app:3150
}
```

### 2.2 컨테이너 (단일)

`origami-app` 하나의 Node.js 컨테이너가 다음 모두를 담당:

- 정적 SPA 서빙 (`/`, `/assets/*`)
- LLM 프록시 API (`POST /api/tree-from-name`)
- 헬스체크 (`GET /api/health`)

API endpoint가 1~2개라 별도 backend 컨테이너로 분리할 이득이 없음. 추후 backend 워크로드가 무거워지면 `api.origami.myazit.kr` 로 분리 가능.

### 2.3 운영 트리 / 도메인 / 포트

| 항목 | 값 |
|------|-----|
| 도메인 | `origami.myazit.kr` |
| 운영 디렉터리 | `/opt/stack/services/public/myazit.kr/origami/` |
| GitHub repo | `ksheo71/origami` |
| 컨테이너 이름 | `origami-app` |
| 컨테이너 포트 | `3150` (Phase 0에서 4500=hikers·4600=gold·3100=art-galleries 충돌 → 3150 확정) |
| 시크릿 | `../.env`에 `ANTHROPIC_API_KEY` (0600) |
| Docker 네트워크 | `edge_shared` (external: true) |

### 2.4 컴포넌트 책임

| 계층 | 책임 | 기술 |
|------|------|------|
| 프론트엔드 SPA | UI, 상태, 오케스트레이션, 2D 렌더, 3D 임베드 | React + TypeScript + Vite |
| TreeMaker 엔진 | 트리 → CP(FOLD), 브라우저(Worker) 실행 | 순수 TypeScript |
| 2D 뷰어 | FOLD → SVG | 직접 그리기 |
| 3D 뷰어 | FOLD → 접기 시뮬레이션 | Origami Simulator (Ghassaei) 임베드 |
| 백엔드 API | LLM 호출, 키 보호, 검증 | Node.js + Hono |
| 컨테이너화 | multi-stage Dockerfile | Dockerfile + docker-compose.yml |
| 배포 | self-hosted 러너로 자동 빌드/재기동 | GitHub Actions self-hosted runner |

### 2.5 핵심 결정과 근거

- **백엔드는 LLM 프록시 역할만**. 알고리즘은 클라이언트에서. 서버 CPU 부담·왕복 지연 회피.
- **단일 컨테이너**. API가 작음. 분리 이득 없음.
- **Hono 선택**. 작고 빠르며 Cloudflare Workers와 코드 호환 (나중에 옮길 일 생겨도 비용 낮음).
- **DB 없음**. 저장이 비목표. 결과 공유는 URL 직렬화.
- **TreeMaker는 순수 TS 자체 구현**. 원본은 GPLv2 C++ + 오래된 GUI 코드와 깊게 얽혀 있음. 알고리즘만 참조(Lang의 *Origami Design Secrets* 11~13장), 코드 직접 차용 금지.
- **Origami Simulator는 1단계엔 iframe 임베드**. 동작 검증 후 통합 방식 재평가.

## 3. 핵심 컴포넌트

### 3.1 LLM 트리 생성기 (백엔드)

```
POST /api/tree-from-name
Body: { "name": "도마뱀" }
→ Anthropic SDK로 Claude 호출, structured output (tool 호출)
Response: { tree: Tree, rationale: string }
```

**시스템 프롬프트 골자**: "동물 이름을 받아 종이접기용 스틱 피겨 트리로 변환. 잎 노드(머리·꼬리·다리·날개)와 내부 노드(척추 분기점), 엣지는 상대적 길이(1.0이 기준). 잎 수 ≤ 6으로 단순화. 좌우 대칭 권장."

**검증** (백엔드, LLM 응답 직후):
- 트리 무결성: 사이클 없음, 연결됨
- 잎 개수 1~6, 노드 총수 ≤ 12
- 모든 엣지 길이 > 0

검증 실패 시 1회 재시도 → 또 실패면 400 응답.

### 3.2 트리 데이터 모델

```typescript
type TreeNode = { id: string; label?: string };  // 예: "head", "tail", "leg_FL"
type TreeEdge = { from: string; to: string; length: number };
type Tree     = { nodes: TreeNode[]; edges: TreeEdge[] };
// 잎 = degree 1 노드. 그래프에서 도출. 플래그 불필요.
```

### 3.3 TreeMaker 엔진 (브라우저, 순수 TS)

가장 어려운 컴포넌트. 참조 자료: Robert Lang, *Origami Design Secrets* (2nd ed., 2011), 11~13장.

**처리 단계**:
1. 잎 추출 + 잎 간 그래프 거리 (Floyd-Warshall, O(n³))
2. **Circle packing 최적화**
   - 변수: 각 잎의 `(x_i, y_i)` + 스케일 `s`
   - 제약: `|p_i − p_j| ≥ s · d_tree(i, j)` for all leaf pairs
   - 목적: `maximize s`
   - 방법: augmented Lagrangian 또는 작은 NLP 라이브러리. 시드 고정으로 결정성 확보.
3. **Universal molecule** — 각 polygonal face 안에서 각도 이등분선 기반 CP 생성 (Lang). 가장 구현 난이도 높음.
4. FOLD 어셈블리

**라이센스 메모**: 오픈소스 TreeMaker는 GPLv2. 알고리즘만 참조, 코드 직접 차용 금지. 본 프로젝트는 MIT 또는 Apache-2.0 라이센스로 배포.

**현실적 단계 분할**:
- Phase A: 잎 3개 대칭 트리(학) — Phase 1 범위
- Phase B: 잎 4~6개 + 비대칭 — Phase 3 범위
- Phase C: river 처리, 회전 대칭 — v2 후보

### 3.4 FOLD 데이터 모델

학계 표준 포맷 ([spec](https://github.com/edemaine/fold)). 주요 필드:

```
vertices_coords:  [[x, y], ...]
edges_vertices:   [[v1, v2], ...]
edges_assignment: ["M", "V", "B", ...]   // 산/골/경계
faces_vertices:   [[v1, v2, v3, ...], ...]
```

TreeMaker 엔진 출력 = Origami Simulator 입력. 컴포넌트 간 데이터 흐름의 허리.

### 3.5 2D CP 렌더러

FOLD → SVG. 산접기 빨강 실선, 골접기 파랑 점선 (`stroke-dasharray`), 경계 검정. 뷰포트는 종이 좌표계(0~1) 기준. 줌·팬은 단순 transform. 다운로드: `.svg`, `.fold`, `.png`.

### 3.6 3D 뷰어 통합

Origami Simulator(Ghassaei)는 통합 웹앱이라 npm 패키지 없음. 두 옵션:

- **(a) iframe 임베드** — 빠르고 안전, postMessage로 FOLD 전달, 스타일 통합 떨어짐
- **(b) 소스 추출 → 우리 번들 합침** — 통합도 높음, MIT 라이센스 명시 필요, 빌드 작업 더 많음

Phase 1은 (a)로 검증. Phase 4에서 (b) 채택 여부 결정. **TBD: 통합 방식 (Phase 1 끝에 확정)**

## 4. 데이터 흐름 (end-to-end)

```
사용자 → SPA → POST /api/tree-from-name → Claude → tree JSON 응답
        ↓
        Web Worker로 TreeMaker 엔진 실행
        ↓
        FOLD 객체
        ↓
        ├─ 2D CP 렌더 (SVG)
        └─ postMessage(FOLD) → Origami Simulator (iframe) → 3D 시뮬레이션
```

### 4.1 핵심 포인트

- **상태는 URL이 SoT**. 트리 JSON을 base64url로 인코딩해 쿼리스트링에 (`?tree=...`). 새로고침·공유·뒤로가기가 자연스럽게 작동. 서버 저장소 불필요.
- **TreeMaker는 Web Worker에서 실행**. UI freeze 방지. 진행률은 `postMessage`로 메인 스레드에 보고 → 진행 표시줄.
- **3D 임베드 통신은 postMessage**. FOLD JSON 1회 전달, 그 후 슬라이더 값(접기 진행도)만 추가 전달.
- **재시도/공유 시나리오**:
  - 같은 동물 이름이라도 LLM 출력은 비결정적 → "다시 시도" = 새 트리
  - URL을 받은 사람은 LLM을 거치지 않고 트리에서 바로 TreeMaker만 실행 → 항상 같은 결과
- **캐싱**: 동일 트리 JSON의 FOLD를 메모리에 메모이즈. 슬라이더만 움직일 때 재계산 없음.

## 5. 에러 처리

| 실패 지점 | 처리 |
|---|---|
| Claude API 호출 실패/타임아웃 | 백엔드에서 1회 재시도, 실패 시 502 + 사용자에 "트리 생성 실패, 다시 시도" |
| LLM이 깨진 트리 반환 (사이클·잎 0 등) | 1회 재시도, 실패 시 400 + "이 동물은 단순화에 실패했어요" |
| 잎 수 > 6 / 노드 > 12 | 검증 실패로 동일 처리 |
| TreeMaker NLP 발산 | 최대 반복 도달 시 부분 결과 + 경고. 사용자가 "다시 시도"로 다른 시드 |
| Universal molecule 실패 (수치 edge case) | 해당 face만 빨간 마스크 + "이 트리는 현재 알고리즘이 처리 못함". 자동 로깅 |
| Origami Simulator 시뮬레이션 발산 | 3D 패널에 "시뮬레이션 실패", 2D CP는 정상 유지 |
| 잘못된 URL `?tree=` | 기본 화면 리다이렉트 + 토스트 |
| API 키 미설정 | 서버 부팅 시 fatal → `deploy.sh` 헬스체크에서 잡힘 → 배포 실패 |
| 레이트 리밋 (Claude/자체) | 429 → "잠시 후 다시 시도" |

### 5.1 관측 가능성

- 백엔드 구조화 로그: 요청 ID, 입력 동물명, LLM latency, 결과 코드 → stdout → `docker logs`
- `GET /api/health` → `{"ok":true, "version":"<git-sha>"}`. deploy.sh 헬스체크 대상.

## 6. 테스트 전략

### 6.1 단위 테스트 (vitest)

- 트리 검증기: 사이클·고립 노드·잎 수 경계값
- 그래프 거리 계산: 알려진 트리의 골든 값
- Circle packing: 잎 3개 대칭 트리(학) → 알려진 정답 좌표와 ε 이내 매치
- Universal molecule: 정삼각형·이등변삼각형 face의 골든 CP
- FOLD 직렬화/역직렬화 round-trip

### 6.2 통합 테스트

- 트리 → TreeMaker → FOLD 가 항상 valid FOLD (스키마 검증)
- 같은 트리 입력에 대해 결정적 출력
- 예제 트리 10종에 대한 회귀 스냅샷

### 6.3 E2E (Playwright, optional)

- "학" 입력 → 결과 화면 → 2D 렌더 보임 → 3D iframe 로드 — 1개 정도

### 6.4 LLM 출력은 별도 트랙

- 비결정적이라 단위 테스트로 묶기 부적합
- **계약 테스트**만: "잎 수 ≤ 6, 트리 유효" 등 구조 검증
- 의미 검증("도마뱀 다리가 4개")은 사람이 가끔 샘플링
- 10종 정도를 매주 자동 호출 → 구조 검증 통과율 로그

## 7. 단계별 마일스톤

총 ~3~4개월 목표. 각 phase는 그 끝에 손에 잡히는 결과물.

### Phase 0 — 인프라 & 빈 스켈레톤 (~1주)

**목표**: `origami.myazit.kr` 에 빈 화면이 뜸.

- GitHub repo `ksheo71/origami` 생성, deploy key, `~/.ssh/config` 별칭
- `Dockerfile` (multi-stage: Vite 빌드 → Node 서빙)
- `docker-compose.yml` (`name: origami`, `edge_shared`, 포트 `3150`)
- `scripts/deploy.sh`, `.github/workflows/deploy.yml`, self-hosted 러너 등록
- `/opt/stack/services/public/myazit.kr/origami/` 운영 트리 + `.env`
- Caddyfile에 1줄 추가 + push
- Node + Hono로 정적 SPA 서빙 + `/api/health`

**완료 기준**: `https://origami.myazit.kr/api/health` 200, 루트에 "hello" 화면.

### Phase 1 — 잎 3개 워킹 슬라이스 (~3~4주, 가장 큰 phase)

**목표**: 하드코딩 학 트리 → 종이 위 CP → 3D에서 접히는 학.

- React+TS+Vite 본격 구조, 페이지 1개
- 트리 입력은 UI 없이 코드 안에 학 트리 객체 직접 둔 상태
- TreeMaker v0.1
  - 그래프 거리 (Floyd-Warshall)
  - Circle packing — 잎 3개, 정삼각형 face 1개로 단순화
  - Universal molecule — 정삼각형 case (이등분선 → incenter)
  - FOLD 어셈블리
- 2D CP 렌더 (SVG, M/V/B 색상)
- 3D: Origami Simulator iframe 임베드, postMessage로 FOLD 전달
- Web Worker로 TreeMaker 실행 (UI 안 멈춤)

**완료 기준**: 페이지 로드 → 학 CP 보임 → 3D에서 학으로 접힘.

**가장 큰 리스크**: Universal molecule이 임의 정삼각형에서 안정적으로 동작하는지. 여기서 망가지면 Phase 2~3가 모래성.

### Phase 2 — LLM 통합 (~2주)

**목표**: "학" 입력 → 자동 트리 → Phase 1 흐름.

- 백엔드 `/api/tree-from-name` (Hono + Anthropic SDK)
- 시스템 프롬프트 정착, structured output (tool 호출)
- 검증·재시도 (1회)
- 프론트: 입력 폼, 로딩, 에러 토스트
- URL 상태 직렬화 (`?tree=base64url(json)`)

**완료 기준**: "학"·"crane"·"swan" 모두 동작. URL 복사 → 다른 브라우저에서 동일 결과.

### Phase 3 — TreeMaker 확장 (~4~6주)

**목표**: 도마뱀·사자·물고기·거북이·개구리 5종이 합리적 결과.

- Circle packing을 잎 4~6개로 확장 (NLP 솔버 본격 사용)
- Universal molecule을 일반 convex polygonal face로
- 비대칭 트리 지원 (대칭 강제 옵션은 별도 토글)
- River 처리 — 시간 부족하면 v2 연기
- 회귀 스냅샷 테스트 5종

**완료 기준**: 5종이 (1) valid FOLD, (2) Origami Simulator에서 발산 없이 접힘, (3) 시각적으로 그럴듯.

**가장 큰 리스크**: NLP 발산. 시드·초기값 전략이 핵심.

### Phase 4 — 폴리시 & 마감 (~2주)

**목표**: 친구한테 링크 보낼 수 있는 상태.

- 에러 메시지·로딩 상태 정돈
- 다운로드 버튼 (.svg / .fold / .png)
- 모바일 반응형 (탭으로 2D/3D 전환)
- 기본 OG 메타, 파비콘, 간단 about 페이지
- 회귀 테스트 CI 통합

**완료 기준**: 처음 보는 사람이 도움 없이 1분 안에 결과 받음.

### 7.1 누적 일정

| Phase | 누적 |
|---|---|
| 0 | ~1주 |
| 1 | ~4~5주 |
| 2 | ~6~7주 |
| 3 | ~10~13주 |
| 4 | ~12~15주 (≈ 3~4개월) |

### 7.2 v2 후보 (스펙 밖, 메모만)

- 트리 직접 편집 UI
- River 본격 처리, 회전 대칭
- 갤러리·공유, 사용자 계정
- 단계별 다이어그램 자동 생성 (Yoshizawa-Randlett)
- 사진 입력 (별도 큰 트랙)

## 8. 미정 항목 (TBD)

- **Origami Simulator 통합 방식**: iframe vs 번들. Phase 1 끝에 확정.
- **NLP 솔버 선택**: 자체 augmented Lagrangian vs 외부 패키지. Phase 3 초입에 결정.
- **라이센스**: MIT vs Apache-2.0. repo 생성 시 결정.

### 해소된 항목

- ~~포트 충돌 여부~~ → Phase 0에서 4500=hikers, 4600=gold, 3100=art-galleries 모두 충돌 → **3150 으로 확정** (`lsof -nP -iTCP -sTCP:LISTEN` 으로 호스트 전체 LISTEN 확인 후).
