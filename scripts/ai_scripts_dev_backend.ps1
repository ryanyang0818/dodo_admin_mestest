# 從專案虛擬環境啟動 FastAPI 開發伺服器。
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
  throw "找不到專案 Python：$pythonPath。請先建立並安裝 .venv。"
}

Push-Location $backendPath

try {
  & $pythonPath -m fastapi dev "app\main.py"
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
