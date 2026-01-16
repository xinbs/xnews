#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

compose_local="docker-compose.local.yml"
compose_remote="docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker 命令，请先安装 Docker。"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker 守护进程未就绪，请先启动 docker.service。"
  exit 1
fi

if [[ ! -f ".env.server" ]]; then
  echo "未找到 .env.server。请参考 example.env.server 创建并填写后再启动。"
  exit 1
fi

choose_node_image() {
  local -a candidates=(
    "node:20-bullseye"
    "docker.m.daocloud.io/library/node:20-bullseye"
    "registry.cn-hangzhou.aliyuncs.com/library/node:20-bullseye"
    "hub-mirror.c.163.com/library/node:20-bullseye"
    "mirror.baidubce.com/library/node:20-bullseye"
  )

  for img in "${candidates[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
      echo "$img"
      return 0
    fi
  done

  for img in "${candidates[@]}"; do
    echo "尝试拉取基础镜像：$img"
    if docker pull "$img" >/dev/null 2>&1; then
      echo "$img"
      return 0
    fi
  done

  echo ""
  return 1
}

NODE_IMAGE="${NODE_IMAGE:-}"
if [[ -z "${NODE_IMAGE}" ]]; then
  NODE_IMAGE="$(choose_node_image || true)"
fi

if [[ -z "${NODE_IMAGE}" ]]; then
  echo "无法获取 Node 基础镜像（node:20-bullseye）。请检查网络或配置镜像加速后重试。"
  exit 1
fi

echo "使用基础镜像：$NODE_IMAGE"

if [[ -f "$compose_remote" ]]; then
  docker compose -f "$compose_remote" down >/dev/null 2>&1 || true
fi

NODE_IMAGE="$NODE_IMAGE" docker compose -f "$compose_local" up -d --build

echo
docker compose -f "$compose_local" ps -a

echo
if command -v curl >/dev/null 2>&1; then
  curl -fsS -o /dev/null -w "健康检查：http://localhost:4444/ -> %{http_code}\n" http://localhost:4444/ || true
else
  echo "未安装 curl，跳过 HTTP 健康检查。"
fi

