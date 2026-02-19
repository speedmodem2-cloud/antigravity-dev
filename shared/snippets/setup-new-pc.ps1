# ============================================================
# AntiGravity Dev 환경 자동 셋업 (새 PC용)
# 관리자 PowerShell에서 실행: .\setup-new-pc.ps1
# D드라이브 사용 시: .\setup-new-pc.ps1 -DevRoot "D:\Dev"
# ============================================================

param(
    [string]$DevRoot = "C:\Dev"
)

Write-Host "`n=== AntiGravity Dev Setup ===" -ForegroundColor Magenta
Write-Host "  DEV_ROOT: $DevRoot" -ForegroundColor Gray

# 1. winget 필수 프로그램 설치
Write-Host "`n[1/6] 프로그램 설치..." -ForegroundColor Cyan

$packages = @(
    @{ id = "Git.Git";               name = "Git" },
    @{ id = "OpenJS.NodeJS.LTS";     name = "Node.js LTS" },
    @{ id = "Microsoft.VisualStudioCode"; name = "VS Code" }
)

foreach ($pkg in $packages) {
    $installed = winget list --id $pkg.id 2>$null | Select-String $pkg.id
    if ($installed) {
        Write-Host "  [OK] $($pkg.name) 이미 설치됨" -ForegroundColor Green
    } else {
        Write-Host "  설치 중: $($pkg.name)..." -ForegroundColor Yellow
        winget install --id $pkg.id --accept-source-agreements --accept-package-agreements -e
    }
}

# 2. pnpm 설치
Write-Host "`n[2/6] pnpm 설치..." -ForegroundColor Cyan
$pnpmCheck = Get-Command pnpm -ErrorAction SilentlyContinue
if ($pnpmCheck) {
    Write-Host "  [OK] pnpm 이미 설치됨" -ForegroundColor Green
} else {
    npm install -g pnpm
    Write-Host "  [OK] pnpm 설치 완료" -ForegroundColor Green
}

# 3. 프로젝트 폴더 확인
Write-Host "`n[3/6] $DevRoot 프로젝트 확인..." -ForegroundColor Cyan
if (Test-Path "$DevRoot\.git") {
    Write-Host "  [OK] $DevRoot 이미 존재" -ForegroundColor Green
} else {
    Write-Host "  $DevRoot 없음 — git clone 필요" -ForegroundColor Yellow
    Write-Host "  수동 실행: git clone <your-repo-url> $DevRoot" -ForegroundColor Yellow
}

# 4. DEV_ROOT 환경변수 설정
Write-Host "`n[4/6] DEV_ROOT 환경변수..." -ForegroundColor Cyan
$currentRoot = [System.Environment]::GetEnvironmentVariable("DEV_ROOT", "User")
if ($currentRoot -eq $DevRoot) {
    Write-Host "  [OK] DEV_ROOT = $DevRoot" -ForegroundColor Green
} elseif ($DevRoot -ne "C:\Dev") {
    [System.Environment]::SetEnvironmentVariable("DEV_ROOT", $DevRoot, "User")
    $env:DEV_ROOT = $DevRoot
    Write-Host "  [OK] DEV_ROOT → $DevRoot 설정 완료" -ForegroundColor Green

    # MCP config 경로도 갱신
    $mcpConfig = "$DevRoot\system\mcp\mcp-config.json"
    if (Test-Path $mcpConfig) {
        $content = Get-Content $mcpConfig -Raw
        $content = $content -replace 'C:/Dev', ($DevRoot -replace '\\', '/')
        Set-Content $mcpConfig $content
        Write-Host "  [OK] mcp-config.json 경로 갱신" -ForegroundColor Green
    }
} else {
    Write-Host "  [OK] 기본 경로 C:\Dev 사용 (환경변수 불필요)" -ForegroundColor Green
}

# 5. 의존성 설치 (node_modules)
Write-Host "`n[5/6] 의존성 설치..." -ForegroundColor Cyan
$subDirs = @(
    "tools\tui-dashboard",
    "tools\phase-manager",
    "tools\retrospect",
    "tools\agent-factory",
    "system\mcp\gemini-bridge",
    "system\mcp\token-monitor",
    "system\mcp\project-manager",
    "system\mcp\image-bridge"
)

foreach ($sub in $subDirs) {
    $dir = "$DevRoot\$sub"
    if (Test-Path "$dir\package.json") {
        Write-Host "  pnpm install: $sub" -ForegroundColor Gray
        Push-Location $dir
        pnpm install --silent 2>$null
        Pop-Location
    }
}
Write-Host "  [OK] 의존성 설치 완료" -ForegroundColor Green

# 6. Claude Code 메모리 심링크
Write-Host "`n[6/7] Claude Code 메모리 심링크..." -ForegroundColor Cyan
$memoryTarget = "$DevRoot\system\memory"
$memoryLink = "$env:USERPROFILE\.claude\projects\c--Dev\memory"

if (Test-Path $memoryLink) {
    $item = Get-Item $memoryLink -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "  [OK] 심링크 이미 존재" -ForegroundColor Green
    } else {
        Write-Host "  기존 폴더 → 심링크로 교체..." -ForegroundColor Yellow
        Remove-Item $memoryLink -Recurse -Force
        New-Item -ItemType Junction -Path $memoryLink -Target $memoryTarget | Out-Null
        Write-Host "  [OK] Junction 생성 완료" -ForegroundColor Green
    }
} else {
    $parentDir = Split-Path $memoryLink -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    New-Item -ItemType Junction -Path $memoryLink -Target $memoryTarget | Out-Null
    Write-Host "  [OK] Junction 생성 완료" -ForegroundColor Green
}

# 7. API 키 확인
Write-Host "`n[7/7] API 키 확인..." -ForegroundColor Cyan

$geminiKey = [System.Environment]::GetEnvironmentVariable("GEMINI_API_KEY", "User")
if ($geminiKey) {
    Write-Host "  [OK] GEMINI_API_KEY 설정됨" -ForegroundColor Green
} else {
    Write-Host "  [!] GEMINI_API_KEY 미설정" -ForegroundColor Yellow
    Write-Host '  수동: [System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key", "User")' -ForegroundColor Gray
}

# 완료
Write-Host "`n=== 셋업 완료 ===" -ForegroundColor Magenta
Write-Host "다음 단계:" -ForegroundColor White
Write-Host "  1. 터미널 재시작 (PATH 반영)" -ForegroundColor Gray
Write-Host "  2. VS Code에서 $DevRoot 열기" -ForegroundColor Gray
Write-Host "  3. Claude Code 확장 설치" -ForegroundColor Gray
Write-Host "  4. eztrans 사전 파일 → $DevRoot\workspace\jktranslator\data\ 복사" -ForegroundColor Gray
Write-Host ""
