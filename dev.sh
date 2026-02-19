#!/usr/bin/env bash
# d:/Dev/dev.sh — 워크스페이스 프로젝트 실행기
# 사용법: ./dev.sh <프로젝트명>

PROJECT=$1

show_list() {
  echo ""
  echo "워크스페이스 프로젝트 목록:"
  echo "  portfolio        → http://localhost:3000  (Vite React)"
  echo "  portfolio2       → http://localhost:3001  (Vite React)"
  echo "  portfolio3       → http://localhost:3002  (Vite React)"
  echo "  shop-backend1    → http://localhost:3000  (NestJS + Docker 필요)"
  echo "  shop-backend2    → http://localhost:3000  (NestJS + Docker 필요)"
  echo "  shop-backend2-1  → http://localhost:3000  (NestJS + Docker 필요)"
  echo ""
  echo "사용법: ./dev.sh <프로젝트명>"
  echo ""
}

case $PROJECT in
  portfolio)
    cd d:/Dev/workspace/portfolio && pnpm dev
    ;;
  portfolio2)
    cd d:/Dev/workspace/portfolio2 && pnpm dev
    ;;
  portfolio3)
    cd d:/Dev/workspace/portfolio3 && pnpm dev
    ;;
  shop-backend1)
    echo "[1/2] Docker 컨테이너 시작..."
    docker compose -f d:/Dev/workspace/shop-backend1/docker-compose.yml up -d
    echo "[2/2] NestJS 개발 서버 시작..."
    cd d:/Dev/workspace/shop-backend1 && pnpm start:dev
    ;;
  shop-backend2)
    echo "[1/2] Docker 컨테이너 시작..."
    docker compose -f d:/Dev/workspace/shop-backend2/docker-compose.yml up -d
    echo "[2/2] NestJS 개발 서버 시작..."
    cd d:/Dev/workspace/shop-backend2 && pnpm start:dev
    ;;
  shop-backend2-1)
    echo "[1/2] Docker 컨테이너 시작..."
    docker compose -f d:/Dev/workspace/shop-backend2-1/docker-compose.yml up -d
    echo "[2/2] NestJS 개발 서버 시작..."
    cd d:/Dev/workspace/shop-backend2-1 && pnpm start:dev
    ;;
  list|"")
    show_list
    ;;
  *)
    echo "알 수 없는 프로젝트: $PROJECT"
    show_list
    exit 1
    ;;
esac
