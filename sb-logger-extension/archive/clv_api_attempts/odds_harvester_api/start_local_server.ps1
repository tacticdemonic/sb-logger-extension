$env:API_PORT = 8766
$env:ODDS_HARVESTER_PATH = "c:\Local\SB Logger\sb-logger-extension\sb-logger-extension\tools\odds_harvester_api\OddsHarvester"
$pythonPath = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI\venv\Scripts\python.exe"
$serverPath = "c:\Local\SB Logger\sb-logger-extension\sb-logger-extension\tools\odds_harvester_api\server.py"

Write-Host "Starting server on port 8766..."
& $pythonPath $serverPath
