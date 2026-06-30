# Origami — 운영 셋업 (Phase 0)

이 문서는 맥미니(`kyle-mini.local`)에서 origami 앱을 처음 띄울 때의 수동 단계를 정리한 것이다. `/opt/stack/CLAUDE.md` 의 일반 패턴을 origami에 적용한 구체화 버전.

## 사전 조건

- 맥미니에 OrbStack 동작 중
- `/opt/stack/services/network/{cloudflared, caddy}/` 가 떠 있음 (= `edge_shared` 네트워크 존재)
- 작업자 GitHub 계정에 `ksheo71/origami` 생성 권한
- 작업자 손에 맥미니 셸 (직접 또는 원격)

## 1. GitHub repo 생성

GitHub 웹에서 `ksheo71/origami` 생성 (private 또는 public). description: "Origami CP generator (Phase 0+)".

로컬 작업 트리에서 첫 push:

```bash
cd /Users/kyle/workspace/origami
git remote add origin git@github.com:ksheo71/origami.git
git push -u origin main
```

(첫 push 단계에서는 통상 GitHub 계정 SSH 키를 쓴다. deploy key는 맥미니 전용으로 아래 4단계에서 발급.)

## 2. 운영 트리 생성

맥미니에서:

```bash
sudo mkdir -p /opt/stack/services/public/myazit.kr/origami
sudo chown kyle:staff /opt/stack/services/public/myazit.kr/origami
cd /opt/stack/services/public/myazit.kr/origami
```

`.env` 작성 (이 파일은 git에 커밋되지 않는다):

```bash
cat > .env <<'EOF'
ANTHROPIC_API_KEY=
GIT_SHA=dev
EOF
chmod 600 .env
```

> Phase 0 에서는 `ANTHROPIC_API_KEY` 가 비어 있어도 컨테이너가 뜨고 헬스체크 통과한다. Phase 2 시작 시 실제 키를 채운다.

## 3. 포트 4600 충돌 검사

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep ':4600' || echo "포트 4600 OK"
ss -tln | grep -E ':4600\b' || echo "포트 4600 OK"
```

충돌이 있으면 `docker-compose.yml` 과 `scripts/deploy.sh`, `vite.config.ts` 프록시 대상의 포트를 동일하게 다른 번호로 교체 후 push (예: 4600).

## 4. deploy key 발급 + 등록

맥미니에서:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/origami_deploy -N '' -C 'origami deploy key'
cat ~/.ssh/origami_deploy.pub
```

출력된 public key를 GitHub repo의 Settings → Deploy keys → "Add deploy key" 에 등록 (write access 체크 ❌ — 우리는 read only면 충분).

`~/.ssh/config` 에 별칭 추가:

```
Host github-origami
    HostName github.com
    User git
    IdentityFile ~/.ssh/origami_deploy
    IdentitiesOnly yes
```

## 5. 운영 트리에 repo clone

```bash
cd /opt/stack/services/public/myazit.kr/origami
git clone git@github-origami:ksheo71/origami.git repo
```

확인:

```bash
ls repo/scripts/deploy.sh
```

## 6. self-hosted 러너 등록

GitHub repo Settings → Actions → Runners → "New self-hosted runner" → macOS arm64 선택 → 토큰을 받는다.

맥미니에서:

```bash
mkdir -p ~/actions-runner-origami
cd ~/actions-runner-origami
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-osx-arm64-2.319.1.tar.gz
# (버전은 GitHub 안내 페이지의 최신값으로 교체)
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/ksheo71/origami --token <RUNNER_TOKEN> --name kyle-mini-origami --labels self-hosted,origami --unattended
```

launchd 등록 (다른 앱의 `~/actions-runner-<앱>/` 패턴 그대로 복사):

```bash
./svc.sh install
./svc.sh start
./svc.sh status
```

> 기존 다른 앱 러너의 plist 를 참고해서 동일한 패턴으로 둔다.

## 7. Caddyfile 라우트 추가

`edge-caddy` repo(예: `~/workspace/edge-caddy`)의 `Caddyfile` 끝에 다음을 추가:

```caddy
http://origami.myazit.kr {
    import common
    reverse_proxy origami-app:4600
}
```

주의 (`/opt/stack/CLAUDE.md` 의 함정 절):
- 반드시 `http://` 접두사
- multi-line — `import common` 과 `reverse_proxy` 는 별도 줄
- 한글 주석·세미콜론 들어간 헤더 값 금지

commit + push:

```bash
git add Caddyfile
git commit -m "feat: route origami.myazit.kr"
git push origin main
```

→ caddy 의 self-hosted 러너가 자동 force-recreate.

caddy 가 새 설정을 받았는지 확인:

```bash
docker exec caddy wget -qO- http://localhost:2019/config/ | python3 -m json.tool | grep -A2 origami
```

Cloudflare 대시보드는 손대지 않는다 (`*.myazit.kr` 와일드카드가 흡수).

## 8. 첫 배포 트리거

로컬에서 main 브랜치에 트리비얼한 변경(예: README의 줄 끝 공백) 또는 빈 커밋을 push, 또는 GitHub Actions에서 `workflow_dispatch` 로 수동 실행:

```bash
gh workflow run deploy.yml --repo ksheo71/origami
```

진행 상황 보기:

```bash
gh run watch --repo ksheo71/origami
```

또는 맥미니에서:

```bash
docker logs -f origami-app
```

## 9. 최종 검증 게이트

브라우저 또는 curl:

```bash
curl -sS https://origami.myazit.kr/api/health
```

기대: `{"ok":true,"version":"<짧은 git sha>"}`

루트도 확인:

```bash
curl -sS https://origami.myazit.kr/ | grep 'hello, origami'
```

이 두 응답이 정상이면 **Phase 0 완료**.

## 트러블슈팅

- **502 from Caddy**: `docker ps --filter name=origami-app` 으로 컨테이너 상태 확인. Up이 아니면 `docker logs origami-app`.
- **헬스체크 실패**: `docker exec origami-app wget -qO- http://localhost:4600/api/health`. 컨테이너 내부에서 실패하면 빌드 산출물(`dist/server/index.js`)이 들어갔는지 확인.
- **Caddy가 새 호스트를 모름**: caddy 컨테이너 재기동(`gh workflow run deploy.yml --repo ksheo71/edge-caddy`). bind mount inode 이슈로 reload가 안 먹은 경우.
- **러너가 깨어 있지 않음**: `cd ~/actions-runner-origami && ./svc.sh status`.
