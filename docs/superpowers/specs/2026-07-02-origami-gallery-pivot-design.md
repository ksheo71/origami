# 종이접기 갤러리 — 방향 전환 설계 문서

- **상태**: Draft (브레인스토밍 완료, 사용자 설계 승인 → 스펙 리뷰 대기)
- **작성일**: 2026-07-02
- **선행/대체**: Phase 0~3(동물 이름 → LLM 트리 → TreeMaker 자동 생성)을 **대체**한다.
- **이전 스펙**: [`2026-06-30-origami-cp-generator-design.md`](2026-06-30-origami-cp-generator-design.md) (자동 생성 방향, 폐기)

## 1. 배경 — 왜 방향을 바꾸나

Phase 0~3로 "동물 이름 → LLM이 스틱 피겨 → TreeMaker가 크리스패턴 자동 생성 → 2D/3D"를
전부 구현하고 운영 배포까지 마쳤다. 그러나 근본 한계가 확인되었다:

- 자동 생성 결과는 **수학적으로만 유효한 추상 크리스패턴**이라, "사자"를 넣어도 사자처럼 보이지 않는다.
  분기점 1개에서 여러 갈래로 뻗은 "방사형 별" 계열로 수렴하며, 이는 TreeMaker식 접근의 태생적 특성이다.
- 사용자 피드백: "이 접근 자체를 다시 생각하고 싶다" → **"실제로 접히고 알아볼 수 있는 종이접기 +
  접는 법"** 을 원함.

**핵심 통찰**: "알아볼 수 있음 + 접힘"을 알고리즘으로 짜내는 건 미해결 난제다. 반면 종이접기 작가들이
이미 설계한 **검증된 모델**을 쓰면 두 조건이 공짜로 보장된다. 그래서 생성이 아니라 **큐레이션**으로 전환한다.

**저작권 현실(조사로 확인)**: 저작권 깨끗하고 알아볼 수 있는 크리스패턴을 대량 제공하는 공개
저장소는 없다. 유명 작가(Robert Lang 등)의 CP는 저작권이 있고 웹 게시가 금지된다. 안전한 것은
**전통/퍼블릭 도메인 모델**(학·펄럭이는 새·배·기본 베이스 등)뿐이며, 현실적 규모는 **~20~40종**이다.
(출처: OrigamiUSA Copyright FAQ "전통 모델은 자유 사용 가능"; langorigami.com/copyright 게시 금지 명시.)

## 2. 목표 / 비목표

### 목표
- 저작권 깨끗한 **전통 모델 갤러리**(MVP ~10~15종, 이후 ~30까지)를 브라우징.
- 각 모델을 **2D 크리스패턴 + 3D 접히는 과정**으로 보여준다(접으면 알아볼 수 있는 모양).
- 이름 검색·카테고리 필터. 모델별 URL 공유.
- 이미 만든 2D 렌더러·3D 시뮬레이터·서버·배포를 **재사용**.

### 비목표
- 동물 이름 → 자동 크리스패턴 **생성**(Phase 0~3 방식) — 폐기.
- **단계별 접기 설명서**(Yoshizawa-Randlett 화살표 다이어그램) — 대부분 저작권 이미지라 이번 범위 밖.
  "접는 법"은 크리스패턴 + 3D 접힘 애니메이션으로 정의한다.
- 유명 작가 저작권 모델 수록 — 라이선스 없이는 불가.
- 사용자 CP 업로드, 절차적 대량 생성(테셀레이션) — 후속 후보.

## 3. 컨셉 & UX

### 3.1 화면
- **갤러리(`/`)**: 모델 카드 그리드(썸네일 + 이름 + 카테고리 + 난이도). 상단에 이름 검색 + 카테고리 필터.
- **모델 상세(`/model/:id`)**: 좌측 2D 크리스패턴(산 빨강 / 골 파랑 점선 / 경계 검정), 우측 3D 뷰
  (0→100% 접기 슬라이더). 하단에 이름·출처("전통")·난이도·간단 설명.

### 3.2 "접는 법"의 정의 (명시)
크리스패턴(어디를 산/골로 접는지) + 3D에서 종이가 그 모양으로 닫히는 과정. 단계별 순서 설명서는 아님.

## 4. 아키텍처

### 4.1 재사용 (기존 검증된 코드)
| 컴포넌트 | 파일 | 역할 |
|---|---|---|
| FOLD 타입/검증 | `src/shared/fold.ts` | 크리스패턴 데이터 모델 |
| 2D 렌더러 | `src/client/components/CPCanvas.tsx`, `foldToSvgPaths.ts` | FOLD → SVG |
| 3D 임베드 | `src/client/components/FoldSimulator.tsx`, `foldSimulatorMessage.ts` | Origami Simulator iframe + postMessage |
| 서버 | `src/server/index.ts` (Hono) | 정적 SPA + 에셋 + /api/health |
| 인프라 | Dockerfile, docker-compose, deploy.sh, GitHub Actions | 배포 파이프라인 |

### 4.2 신규
- `src/client/catalog/` — 모델 카탈로그: 메타데이터 인덱스(`catalog.ts` 또는 JSON) + `.fold` 에셋.
- `src/client/pages/GalleryPage.tsx` — 카드 그리드 + 검색/필터.
- `src/client/pages/ModelPage.tsx` — 2D + 3D 상세.
- 클라이언트 라우팅(경량: 해시 또는 history 기반; 의존성 최소).

### 4.3 폐기 (이번 방향과 무관)
- LLM: `src/server/llm/*`(treeTool, generateTree, anthropicClient), `POST /api/tree-from-name`, `rateLimit.ts`
- TreeMaker 엔진: `src/treemaker/*`(starTree, starPacking, starMolecule, foldAssembly, treemaker, geometry)
- 입력 폼: `src/client/components/AnimalNameForm.tsx`, `treeFromNameRequest.ts`, `urlTreeState.ts`(트리 직렬화), `cpData/craneTree.ts`
- 결과: 서버는 정적 서빙 + 헬스체크만. `ANTHROPIC_API_KEY` 불필요(제거 또는 무시).
- (git 히스토리에 보존되므로 필요 시 참고 가능.)

## 5. 콘텐츠 카탈로그 & 소싱

### 5.1 카탈로그 항목 모델
```ts
interface OrigamiModel {
  id: string            // 'crane'
  nameKo: string        // '학'
  nameEn: string        // 'Crane'
  category: 'animal' | 'box' | 'flower' | 'base' | 'other'
  difficulty: 'easy' | 'medium' | 'hard'
  source: string        // '전통 (traditional)'
  license: string       // 'public domain (traditional)'
  foldPath: string      // 'catalog/crane.fold'
  description?: string
}
```

### 5.2 소싱 (진짜 작업량)
- **MVP 씨앗**: Origami Simulator 저장소(`amandaghassaei/OrigamiSimulator`) 데모 중 **`data-author`
  속성이 없는 전통 항목**만 선별해 `.fold`를 우리 repo로 복사. 조사 결과 작가 표기 없는 전통 항목
  ~18개, 그중 "알아볼 수 있는 물체" ~10개(학·펄럭이는 새·배·개구리 베이스 등). MIT 저장소지만
  **각 파일의 작가 표기 유무를 개별 확인**하는 것을 구현 계획의 첫 콘텐츠 Task로 둔다.
- **추가 저작**: 부족하면 공개 도메인 모델의 `.fold`를 직접 작성(예: 기본 베이스들).
- **정직한 상한**: ~10~15종 시작, ~30 목표. "수백" 아님.
- 모든 항목에 출처·라이선스 표기.

### 5.3 라이선스 가드
- 카탈로그에 넣기 전, 항목마다 (a) 전통/퍼블릭 도메인이거나 (b) 명시적 자유 라이선스임을 확인.
- 확인 안 된 항목(작가 표기 있음/불명)은 **넣지 않는다**. 이 게이트를 문서화한다.

## 6. 데이터 흐름 & 라우팅

```
정적 카탈로그 인덱스 → GalleryPage 카드 그리드 → 클릭 → /model/:id
   → 해당 .fold fetch → CPCanvas(2D) + FoldSimulator(postMessage로 3D)
```
- 백엔드 LLM 호출 없음. 서버는 SPA + `.fold`(정적) + `/api/health`.
- 상세 URL 공유 가능(`/model/crane`). 3D는 기존 postMessage 핸드셰이크 재사용
  (Phase 1에서 확인한 `edges_foldAngle` 필수 컨벤션 유지 — 카탈로그 `.fold`도 이 필드 보장).

## 7. 마이그레이션 (제거 순서)
1. 갤러리·상세 페이지와 카탈로그를 먼저 세워 새 흐름을 동작시킨 뒤,
2. LLM·treemaker·입력폼을 제거(빌드/테스트 그린 유지),
3. 서버에서 `/api/tree-from-name`·rate limiter 제거, 정적 서빙만 남김.
- 각 단계 끝에 `npm test` + `build:server`/`build:client` 그린(Phase 2 배포 실패 재발 방지).

## 8. 테스트 전략
- **카탈로그 무결성**: 모든 항목의 `.fold`가 존재하고 `validateFold` 통과, `edges_foldAngle` 존재.
- **갤러리**: 검색/필터가 올바른 부분집합 반환(단위 테스트).
- **상세**: 잘못된 `id` → not-found 처리.
- **렌더러 회귀**: 기존 2D 렌더러가 카탈로그 FOLD(가변 정점/면)를 그대로 처리(이미 일반적).
- **E2E 수동**: 갤러리 → 학 선택 → 2D CP + 3D 접힘 시각 확인(운영 URL).
- TDD + subagent-driven-development(기존 Phase와 동일).

## 9. 마일스톤
1. 라우팅 + 갤러리 그리드(정적 카탈로그 2~3종 하드코딩)로 뼈대.
2. 모델 상세(2D+3D) 재사용 연결.
3. 콘텐츠: 안전한 전통 `.fold` ~10종 확보·검증·카탈로그화.
4. 검색/필터.
5. LLM·treemaker·폼 제거 + 서버 단순화.
6. 배포 + E2E 시각 확인.

**완료 기준**: 갤러리에서 전통 모델 ~10종을 보고, 아무거나 골라 2D CP와 3D 접힘(→알아볼 수 있는 모양)을
확인하며, 모델 URL을 공유하면 동일 결과가 뜬다. `npm test`·양쪽 빌드 그린.

## 10. 리스크 / 미정
- **최대 리스크**: 콘텐츠 소싱. "알아볼 수 있는 전통 `.fold`"가 생각보다 적을 수 있음 →
  MVP를 ~10종으로 낮게 잡고, 각 항목 라이선스 개별 확인. 부족하면 직접 저작.
- **차선**: 일부 전통 `.fold`가 시뮬레이터에서 깔끔히 안 접힐 수 있음 → 상세 페이지에서 개별 확인 후 수록.
- **미정**: 라우팅 방식(해시 vs history)·상태 관리 세부는 구현 계획에서 확정(경량·의존성 최소 원칙).
