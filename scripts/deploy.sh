#!/usr/bin/env bash
# /opt/stack/services/public/myazit.kr/origami/repo/scripts/deploy.sh
# self-hosted 러너에서 실행된다.
# CWD는 repo 루트(이 스크립트의 부모/부모).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[deploy] git fetch + reset"
git fetch --prune origin
git reset --hard origin/main

GIT_SHA="$(git rev-parse --short HEAD)"
export GIT_SHA
echo "[deploy] GIT_SHA=${GIT_SHA}"

echo "[deploy] compose up -d --build --force-recreate"
docker compose \
  --env-file ../.env \
  -f docker-compose.yml \
  up -d --build --force-recreate --remove-orphans

echo "[deploy] image prune"
docker image prune -f >/dev/null || true

echo "[deploy] health check (max 60s)"
DEADLINE=$(( $(date +%s) + 60 ))
while true; do
  if curl -fsS http://127.0.0.1:3150/api/health >/dev/null; then
    echo "[deploy] healthy"
    break
  fi
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "[deploy] HEALTHCHECK FAILED" >&2
    docker logs --tail 100 origami-app >&2 || true
    exit 1
  fi
  sleep 2
done

echo "[deploy] done"
