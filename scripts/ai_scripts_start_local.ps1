# 啟動內網開發環境；登入與桌面捷徑共用此入口。
param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
$mutex = New-Object System.Threading.Mutex($false, 'Local\DodoAdmin2LocalLauncher')
$locked = $false

# 沿程序父子關係確認服務屬於本專案；無法確認時保守視為占用。
function Test-ProjectProcess($processId, $kind) {
  $seen = @{}
  while ($processId -gt 0 -and -not $seen.ContainsKey($processId)) {
    $seen[$processId] = $true
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
    if (-not $process) { return $false }
    $command = [string]$process.CommandLine
    if ($kind -eq 'Backend') {
      if ($process.ExecutablePath -eq $pythonPath -and $command -match 'fastapi\s+dev\s+.*app[\\/]main\.py') { return $true }
    } elseif ($command.IndexOf($projectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $command -match 'vite') {
      return $true
    }
    $processId = [int]$process.ParentProcessId
  }
  return $false
}

# 檢查連接埠後開啟可見 CMD；等待監聽完成，避免連點競爭。
function Start-DevWindow($kind, $port, $directory, $command) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
  if ($listeners.Count -gt 0) {
    foreach ($owner in @($listeners.OwningProcess | Select-Object -Unique)) {
      if (-not (Test-ProjectProcess $owner $kind)) {
        throw "$kind port $port is occupied by PID $owner; ownership cannot be confirmed. No process was stopped."
      }
    }
    Write-Host "$kind already running on port $port; skipped."
    return
  }
  if ($CheckOnly) {
    Write-Host "$kind port $port is available."
    return
  }
  # ponytail: 單一登入工作階段使用 mutex；跨工作階段仍由 port 檢查與 strictPort 防護。
  $cmdText = 'title Dodo Admin ' + $kind + ' & ' + $command
  Start-Process -FilePath $env:ComSpec -WorkingDirectory $directory -ArgumentList @('/d', '/k', $cmdText) -WindowStyle Normal
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
      foreach ($owner in @($listeners.OwningProcess | Select-Object -Unique)) {
        if (-not (Test-ProjectProcess $owner $kind)) { throw "$kind port $port was taken by another process (PID $owner)." }
      }
      Write-Host "$kind listening on port $port."
      return
    }
  } while ((Get-Date) -lt $deadline)
  throw "$kind did not listen on port $port within 30 seconds. Check its CMD window before retrying."
}

try {
  $locked = $mutex.WaitOne(0)
  if (-not $locked) {
    Write-Host 'Another launcher is starting Dodo Admin; skipped.'
    exit 0
  }
  if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) { throw "Python not found: $pythonPath" }
  $bunPath = (Get-Command bun.exe -ErrorAction Stop).Source
  $errors = @()
  foreach ($service in @(
    @{ Kind = 'Backend'; Port = 8000; Directory = 'backend'; Command = ('"{0}" -m fastapi dev app\main.py --host 0.0.0.0 --port 8000' -f $pythonPath) },
    @{ Kind = 'Frontend'; Port = 5173; Directory = 'frontend'; Command = ('"{0}" run dev --host 0.0.0.0 --port 5173 --strictPort' -f $bunPath) }
  )) {
    try {
      $directory = Join-Path $projectRoot $service.Directory
      if (-not (Test-Path -LiteralPath $directory -PathType Container)) { throw "Directory not found: $directory" }
      Start-DevWindow $service.Kind $service.Port $directory $service.Command
    } catch {
      $errors += $_.Exception.Message
      Write-Host $_.Exception.Message -ForegroundColor Red
    }
  }
  if ($errors.Count -gt 0) { throw 'Some services could not be started.' }
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  if (-not $CheckOnly) { Read-Host 'Press Enter to close' | Out-Null }
  exit 1
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
