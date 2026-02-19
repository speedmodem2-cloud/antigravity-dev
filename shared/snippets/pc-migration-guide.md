# PC 마이그레이션 가이드

## 1단계: 파일 복사 (현재 PC → USB/클라우드)

PowerShell에서 실행 (node_modules, dist 제외하고 복사):

```powershell
robocopy C:\Dev E:\Dev /E /XD node_modules dist .cache coverage build /XF *.log *.tmp
```

> E:\를 USB 드라이브 문자로 변경. 클라우드 사용 시 해당 경로로.

## 2단계: 회사 PC에 붙여넣기

USB에서 `C:\Dev`로 복사 (또는 원하는 경로).

## 3단계: 셋업 스크립트 실행

관리자 PowerShell 열고:

```powershell
cd C:\Dev\shared\snippets
.\setup-new-pc.ps1
```

이 스크립트가 자동으로:

- [x] Git, Node.js, VS Code 설치 (winget)
- [x] pnpm 설치
- [x] 모든 하위 프로젝트 의존성 설치 (pnpm install)
- [x] DEV_ROOT 환경변수 설정
- [x] Claude Code 메모리 심링크 생성
- [x] API 키 확인

## 4단계: 수동 설정

1. **GEMINI_API_KEY 설정** (PowerShell):

   ```powershell
   [System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key", "User")
   ```

2. **VS Code 확장 설치**:
   - Claude Code 확장

3. **Docker Desktop 설치** (백엔드 프로젝트용):

   ```powershell
   winget install Docker.DockerDesktop
   ```

4. **터미널 재시작** (환경변수 반영)

## 5단계: 확인

```powershell
# 개발환경 확인
node -v          # Node.js
pnpm -v          # pnpm
git --version    # Git
docker --version # Docker (백엔드용)

# TUI 대시보드 테스트
cd C:\Dev\tools\tui-dashboard
pnpm dev
```

## 이후: GitHub 자동화 (권장)

수동 복사 대신 git push/pull로 동기화하려면:

```powershell
# 1. gh CLI 설치
winget install GitHub.cli

# 2. GitHub 로그인
gh auth login

# 3. 비공개 저장소 생성 + push
cd C:\Dev
gh repo create antigravity-dev --private --source=. --push

# 이후 양쪽 PC에서:
git pull   # 최신 변경 가져오기
git push   # 변경사항 올리기
```
