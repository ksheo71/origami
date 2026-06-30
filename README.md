# Origami CP Generator

동물 이름을 입력하면 LLM이 스틱 피겨를 만들고, TreeMaker 엔진이 종이 한 장으로 접을 수 있는 전개도(CP)를 생성하는 웹 앱. 결과를 Origami Simulator로 3D 접기까지 보여준다.

- 운영 URL: https://origami.myazit.kr
- 설계 문서: `docs/superpowers/specs/2026-06-30-origami-cp-generator-design.md`
- 운영 셋업: `docs/ops/deploy.md`

## 로컬 개발

```bash
npm install
npm run dev:server   # 백엔드 :4600
npm run dev:client   # 프론트 :5173 (api는 4600으로 프록시)
```

## 테스트

```bash
npm test
```

## 빌드 + 도커 실행

```bash
docker network create edge_shared 2>/dev/null || true
docker compose up -d --build
curl http://localhost:4600/api/health
```

## 배포

main 브랜치 push → 맥미니 self-hosted 러너가 `scripts/deploy.sh` 실행.
