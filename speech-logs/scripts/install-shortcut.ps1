# install-shortcut.ps1 - Creates a desktop shortcut to speech.ps1.
#
# Usage:
#   .\scripts\install-shortcut.ps1
#
# After running, double-click the "Speech Log" icon on the desktop.
# PowerShell opens in the project directory and runs device check,
# topic prompt, recording, and analysis in one flow.
# The window stays open (-NoExit) so you can read the result.

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SpeechPs1   = Join-Path $ProjectRoot "scripts\speech.ps1"

if (-not (Test-Path $SpeechPs1)) {
    Write-Error "speech.ps1 not found: $SpeechPs1"
    exit 1
}

$Desktop      = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "Speech Log.lnk"

$Shell     = New-Object -ComObject WScript.Shell
$Shortcut  = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = (Get-Command powershell.exe).Path
$Shortcut.Arguments        = "-NoExit -ExecutionPolicy Bypass -File `"$SpeechPs1`""
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.Description      = "5min monologue recording + STT/VAD analysis"

$IconPath = Join-Path $ProjectRoot "assets\speech-log.ico"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = $IconPath
} else {
    $Shortcut.IconLocation = "$($Shortcut.TargetPath),0"
}
$Shortcut.Save()

Write-Host "Created: $ShortcutPath" -ForegroundColor Green
Write-Host "Double-click the 'Speech Log' icon on your desktop to start."
