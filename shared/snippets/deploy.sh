#!/bin/bash
# 배포 자동화 스크립트
# 사용법: bash deploy.sh [프로젝트명]

set -e

PROJECT=${1:?"프로젝트명을 입력하세요. 사용법: bash deploy.sh [프로젝트명]"}
DEV_ROOT="C:/Dev"
PROJECT_DIR="$DEV_ROOT/workspace/$PROJECT"

echo "=== 배포 시작: $PROJECT ==="

# 1. 프로젝트 디렉토리 확인
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ 프로젝트를 찾을 수 없습니다: $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

# 2. 린트 체크
echo "→ ESLint 검사 중..."
pnpm exec eslint src/ --max-warnings=0 || { echo "❌ ESLint 에러 발견"; exit 1; }

# 3. 타입 체크
echo "→ TypeScript 검사 중..."
pnpm exec tsc --noEmit || { echo "❌ TypeScript 에러 발견"; exit 1; }

# 4. 빌드
echo "→ 빌드 중..."
pnpm build || { echo "❌ 빌드 실패"; exit 1; }

# 5. 빌드 결과 확인
if [ ! -d "dist" ]; then
  echo "❌ dist 폴더가 생성되지 않았습니다"
  exit 1
fi

echo "✅ 빌드 성공!"
echo "→ dist/ 폴더 크기: $(du -sh dist | cut -f1)"

# 6. Git 태그 (선택)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo "→ 배포 태그: deploy-$PROJECT-$TIMESTAMP"

echo "=== 배포 완료: $PROJECT ==="
