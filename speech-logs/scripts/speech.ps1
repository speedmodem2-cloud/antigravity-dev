# speech.ps1 — 원큐 래퍼: 입력 장치 체크 → 녹음 → 분석 → 다음 액션 안내
#
# 사용법:
#   .\scripts\speech.ps1                         # 무제한 녹음 (Ctrl+C로 종료) + 분석
#   .\scripts\speech.ps1 -Duration 300           # 최대 5분 강제 종료
#   .\scripts\speech.ps1 -Topic "오늘 회고"       # 토픽 지정
#   .\scripts\speech.ps1 -Smoke                  # 3초 녹음 + 레벨만 확인 (분석 생략)
#   .\scripts\speech.ps1 -SkipDeviceCheck        # 장치 매칭 경고 우회

param(
    [double]$Duration = 0,    # 0이면 무제한 (Ctrl+C로 종료). 양수이면 그 시간 후 자동 종료.
    [string]$Topic = $null,
    [switch]$Smoke,
    [switch]$SkipDeviceCheck
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Error "venv 없음: $Python"
    exit 1
}

$env:PYTHONIOENCODING = "utf-8"
# PowerShell 콘솔 출력 인코딩을 UTF-8로 강제. 기본값(CP949)이면
# Python이 UTF-8로 쓴 한글이 콘솔에서 깨진다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

# --- 1. 입력 장치 체크 ---
if (-not $SkipDeviceCheck) {
    Write-Host "`n[1/3] 입력 장치 확인..." -ForegroundColor Cyan
    $deviceOutput = & $Python -m src.device_info --check
    $deviceCode = $LASTEXITCODE
    Write-Host ($deviceOutput -join "`n")

    if ($deviceCode -ne 0) {
        Write-Host "예상 장치(USB/BY600) 키워드가 장치명에 없습니다." -ForegroundColor Yellow
        $confirm = Read-Host "계속 진행할까요? (y/n)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "중단. Windows 설정 → 시스템 → 소리 → 입력에서 BY600을 기본 입력으로 설정하세요." -ForegroundColor Yellow
            exit 1
        }
    }
}

# --- 2. 스모크 모드 (3초 녹음 + 레벨만 확인) ---
if ($Smoke) {
    Write-Host "`n[2/3] 스모크 녹음 (3초)..." -ForegroundColor Cyan
    $SmokePath = "audio\_smoke.wav"
    & $Python -m src.record --duration 3 --output $SmokePath
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n[3/3] 레벨 측정..." -ForegroundColor Cyan
    & $Python -m src.check_level $SmokePath
    Remove-Item $SmokePath -ErrorAction SilentlyContinue
    Write-Host "`n스모크 완료. 레벨 괜찮으면 -Smoke 없이 본 녹음 실행." -ForegroundColor Green
    exit 0
}

# --- 2. Topic 대화형 입력 ---
if (-not $Topic) {
    $Topic = Read-Host "오늘 주제 (엔터로 건너뛰기)"
    if ([string]::IsNullOrWhiteSpace($Topic)) { $Topic = $null }
}

# --- 3. 녹음 + 분석 ---
$SessionId = Get-Date -Format "yyyy-MM-dd_HHmmss"
$AudioPath = "audio\$SessionId.wav"

Write-Host "`n=== session $SessionId ===" -ForegroundColor Cyan
if ($Topic) { Write-Host "topic: $Topic" -ForegroundColor DarkGray }

Write-Host "`n[2/3] 녹음..." -ForegroundColor Cyan

# Ctrl+C는 PowerShell로도 전파되어 스크립트를 중단시키므로 try/catch로 보호.
# Python(record.py)은 KeyboardInterrupt를 잡아 그 시점까지 wav 저장하므로,
# 파일이 존재하면 종료라도 분석 단계로 이어간다.
$RecordArgs = @("-m", "src.record", "--output", $AudioPath)
if ($Duration -gt 0) { $RecordArgs += @("--duration", $Duration) }

try {
    & $Python @RecordArgs
} catch {
    Write-Host "`n(녹음 종료 감지)" -ForegroundColor Yellow
}

if (-not (Test-Path $AudioPath)) {
    Write-Error "녹음 파일이 생성되지 않음: $AudioPath"
    exit 1
}

$FileSizeKB = [math]::Round((Get-Item $AudioPath).Length / 1KB, 1)
Write-Host "녹음 저장: $AudioPath ($FileSizeKB KB)" -ForegroundColor Green

if ($FileSizeKB -lt 50) {
    Write-Host "파일이 매우 작음. 의미 있는 분석이 어려울 수 있습니다." -ForegroundColor Yellow
    $Confirm = Read-Host "그래도 분석 계속할까요? (y/n)"
    if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
        Remove-Item $AudioPath -ErrorAction SilentlyContinue
        Write-Host "파일 삭제. 종료." -ForegroundColor DarkGray
        exit 0
    }
}

Write-Host "`n[3/3] 분석 (STT + VAD + 메트릭)..." -ForegroundColor Cyan
$pipeArgs = @("-m", "src.pipeline", $AudioPath, "--session-id", $SessionId)
if ($Topic) { $pipeArgs += @("--topic", $Topic) }

& $Python @pipeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "분석 실패"
    exit $LASTEXITCODE
}

Write-Host "`n=== done ===" -ForegroundColor Green
Write-Host "내용 코칭을 받으려면 Claude Code 세션에서 " -NoNewline
Write-Host "`"스피치 분석`"" -ForegroundColor Yellow -NoNewline
Write-Host " 이라고 입력하세요."
