<# 
.SYNOPSIS
    Installs OddsHarvester CLV API for Surebet Helper extension.

.DESCRIPTION
    This script:
    1. Verifies Python 3.11+ is installed
    2. Clones OddsHarvester repository
    3. Sets up virtual environment with dependencies
    4. Copies API server files
    5. Creates Windows Task Scheduler task for auto-start
    6. Tests the installation

.NOTES
    Run this script in PowerShell with administrator privileges for Task Scheduler setup.
    File: install_odds_api.ps1
    Version: 1.0.0
#>

param(
    [int]$Port = 8765,
    [int]$MaxConcurrency = 3,
    [switch]$SkipTaskScheduler,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$INSTALL_DIR = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI"
$HARVESTER_DIR = "$INSTALL_DIR\OddsHarvester"
$VENV_DIR = "$INSTALL_DIR\venv"
$LOG_FILE = "$INSTALL_DIR\install.log"
$TASK_NAME = "OddsHarvester CLV API"

# Get script directory (where API files are located)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$API_SOURCE_DIR = $SCRIPT_DIR

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    if (Test-Path (Split-Path $LOG_FILE -Parent)) {
        Add-Content -Path $LOG_FILE -Value $logMessage
    }
}

function Test-PythonVersion {
    Write-Log "Checking Python version..."
    
    try {
        $pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
        if (-not $pythonPath) {
            $pythonPath = (Get-Command python3 -ErrorAction SilentlyContinue).Source
        }
        
        if (-not $pythonPath) {
            throw "Python not found in PATH"
        }
        
        $versionOutput = & $pythonPath --version 2>&1
        $versionMatch = $versionOutput -match "Python (\d+)\.(\d+)\.(\d+)"
        
        if ($versionMatch) {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            
            if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 11)) {
                throw "Python 3.11 or higher is required. Found: Python $major.$minor"
            }
            
            Write-Log "Found Python $major.$minor at: $pythonPath" "SUCCESS"
            return $pythonPath
        } else {
            throw "Could not parse Python version from: $versionOutput"
        }
    } catch {
        Write-Log $_.Exception.Message "ERROR"
        Write-Host ""
        Write-Host "Python 3.11+ is required but not found." -ForegroundColor Red
        Write-Host "Please install Python from: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
        exit 1
    }
}

function Test-GitInstalled {
    Write-Log "Checking Git installation..."
    
    try {
        $gitPath = (Get-Command git -ErrorAction SilentlyContinue).Source
        if (-not $gitPath) {
            throw "Git not found in PATH"
        }
        
        $version = & git --version
        Write-Log "Found $version" "SUCCESS"
        return $true
    } catch {
        Write-Log "Git not found" "ERROR"
        Write-Host ""
        Write-Host "Git is required but not found." -ForegroundColor Red
        Write-Host "Please install Git from: https://git-scm.com/downloads" -ForegroundColor Yellow
        exit 1
    }
}

function Initialize-InstallDirectory {
    Write-Log "Creating installation directory..."
    
    if (Test-Path $INSTALL_DIR) {
        if ($Force) {
            Write-Log "Force flag set, removing existing installation..." "WARN"
            Remove-Item -Recurse -Force $INSTALL_DIR
        } else {
            Write-Log "Installation directory already exists: $INSTALL_DIR" "WARN"
            $response = Read-Host "Do you want to reinstall? (y/N)"
            if ($response -ne 'y' -and $response -ne 'Y') {
                Write-Log "Installation cancelled by user" "INFO"
                exit 0
            }
            Remove-Item -Recurse -Force $INSTALL_DIR
        }
    }
    
    New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
    Write-Log "Created: $INSTALL_DIR" "SUCCESS"
}

function Install-OddsHarvester {
    param([string]$PythonPath)
    
    Write-Log "Cloning OddsHarvester repository..."
    
    Push-Location $INSTALL_DIR
    try {
        # Temporarily disable error action preference for git clone (it writes to stderr)
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $cloneOutput = & git clone https://github.com/jordantete/OddsHarvester.git 2>&1
        $cloneExitCode = $LASTEXITCODE
        $ErrorActionPreference = $oldErrorAction
        
        if ($cloneExitCode -ne 0) {
            throw "Failed to clone OddsHarvester repository: $cloneOutput"
        }
        Write-Log "OddsHarvester cloned successfully" "SUCCESS"
    } finally {
        Pop-Location
    }
    
    Write-Log "Creating virtual environment..."
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $venvOutput = & $PythonPath -m venv $VENV_DIR 2>&1
    $venvExitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldErrorAction
    
    if ($venvExitCode -ne 0) {
        throw "Failed to create virtual environment: $venvOutput"
    }
    Write-Log "Virtual environment created" "SUCCESS"
    
    # Activate venv and install dependencies
    $venvPython = "$VENV_DIR\Scripts\python.exe"
    $venvPip = "$VENV_DIR\Scripts\pip.exe"
    
    Write-Log "Installing uv package manager..."
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $uvOutput = & $venvPip install uv 2>&1
    $ErrorActionPreference = $oldErrorAction
    
    Write-Log "Installing OddsHarvester dependencies (this may take a few minutes)..."
    Push-Location $HARVESTER_DIR
    try {
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $syncOutput = & "$VENV_DIR\Scripts\uv.exe" sync 2>&1
        $syncExitCode = $LASTEXITCODE
        $ErrorActionPreference = $oldErrorAction
        
        if ($syncExitCode -ne 0) {
            Write-Log "uv sync failed, falling back to pip..." "WARN"
            $oldErrorAction = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            $pipInstall = & $venvPip install -e . 2>&1
            $ErrorActionPreference = $oldErrorAction
        }
    } finally {
        Pop-Location
    }
    Write-Log "OddsHarvester dependencies installed" "SUCCESS"
    
    Write-Log "Installing API server dependencies..."
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $apiDeps = & $venvPip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite apscheduler psutil httpx 2>&1
    $ErrorActionPreference = $oldErrorAction
    Write-Log "API dependencies installed" "SUCCESS"
}

function Copy-APIFiles {
    Write-Log "Copying API server files..."
    
    $filesToCopy = @(
        "server.py",
        "database.py",
        "league_mapper.py",
        "fuzzy_matcher.py",
        "requirements_api.txt"
    )
    
    foreach ($file in $filesToCopy) {
        $sourcePath = Join-Path $API_SOURCE_DIR $file
        $destPath = Join-Path $INSTALL_DIR $file
        
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath $destPath
            Write-Log "Copied: $file" "SUCCESS"
        } else {
            Write-Log "Warning: Source file not found: $sourcePath" "WARN"
        }
    }
}

function Initialize-Database {
    Write-Log "Initializing database..."
    
    $venvPython = "$VENV_DIR\Scripts\python.exe"
    $escapedInstallDir = $INSTALL_DIR.Replace('\', '\\')
    
    # Create a simple init script
    $initScript = @"
import sys
sys.path.insert(0, '$escapedInstallDir')
from database import Database, init_db
db = Database('$escapedInstallDir\\clv_cache.db')
init_db(db)
db.close()
print('Database initialized successfully')
"@
    
    $initScriptPath = "$INSTALL_DIR\init_db.py"
    $initScript | Out-File -FilePath $initScriptPath -Encoding UTF8
    
    $oldErrorAction = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $initOutput = & $venvPython $initScriptPath 2>&1
    $ErrorActionPreference = $oldErrorAction
    Remove-Item $initScriptPath -ErrorAction SilentlyContinue
    
    Write-Log "Database initialized" "SUCCESS"
}

function New-StartupScript {
    Write-Log "Creating startup script..."
    
    # Create a PowerShell script that starts the server hidden
    $ps1Script = @'
$pythonPath = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI\venv\Scripts\python.exe"
$serverPath = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI\server.py"
$workDir = "$env:LOCALAPPDATA\SurebetHelper\OddsHarvesterAPI"

Start-Process -FilePath $pythonPath -ArgumentList $serverPath -WorkingDirectory $workDir -WindowStyle Hidden
'@
    
    $ps1ScriptPath = "$INSTALL_DIR\start_server.ps1"
    $ps1Script | Out-File -FilePath $ps1ScriptPath -Encoding UTF8
    
    Write-Log "Startup script created: $ps1ScriptPath" "SUCCESS"
    return $ps1ScriptPath
}

function New-TaskSchedulerTask {
    Write-Log "Creating Task Scheduler task..."
    
    # Create startup script first
    $startupScript = New-StartupScript
    
    # Remove existing task if present
    $existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
        Write-Log "Removed existing task" "INFO"
    }
    
    # Create action using PowerShell to run the startup script hidden
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startupScript`"" -WorkingDirectory $INSTALL_DIR
    
    # Create trigger (at user logon)
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    
    # Create settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 9999)
    
    # Create principal (run without highest privileges to avoid UAC)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    
    # Register task
    Register-ScheduledTask -TaskName $TASK_NAME -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "OddsHarvester CLV API server for Surebet Helper extension" | Out-Null
    
    Write-Log "Task Scheduler task created" "SUCCESS"
    
    # Start the task immediately
    Write-Log "Starting API server..."
    Start-ScheduledTask -TaskName $TASK_NAME
    
    # Give it a moment to start
    Start-Sleep -Seconds 2
    Write-Log "API server started" "SUCCESS"
}

function Start-APIServer {
    param([switch]$Background)
    
    Write-Log "Starting API server manually..."
    
    $pythonPath = "$VENV_DIR\Scripts\python.exe"
    $serverPath = "$INSTALL_DIR\server.py"
    
    if ($Background) {
        # Use Start-Process with hidden window (most reliable)
        Start-Process -FilePath $pythonPath -ArgumentList "`"$serverPath`"" -WorkingDirectory $INSTALL_DIR -WindowStyle Hidden
    } else {
        & $pythonPath $serverPath
    }
}

function Test-Installation {
    Write-Log "Testing installation..."
    
    $maxAttempts = 10
    $attempt = 0
    $success = $false
    
    while ($attempt -lt $maxAttempts -and -not $success) {
        $attempt++
        Write-Log "Testing connection (attempt $attempt/$maxAttempts)..."
        
        Start-Sleep -Seconds 3
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 10
            
            if ($response.status -eq "ok") {
                $success = $true
                Write-Log "API server is running!" "SUCCESS"
                Write-Host ""
                Write-Host "============================================================" -ForegroundColor Green
                Write-Host "       OddsHarvester CLV API - Installation Complete        " -ForegroundColor Green
                Write-Host "============================================================" -ForegroundColor Green
                Write-Host "  Status: $($response.status)" -ForegroundColor Green
                Write-Host "  Version: $($response.version)" -ForegroundColor Green
                Write-Host "  API URL: http://localhost:$Port" -ForegroundColor Green
                Write-Host "============================================================" -ForegroundColor Green
            }
        } catch {
            Write-Log "Connection attempt failed: $($_.Exception.Message)" "WARN"
        }
    }
    
    if (-not $success) {
        Write-Log "API server did not respond within expected time" "ERROR"
        Write-Host ""
        Write-Host "Installation completed but server test failed." -ForegroundColor Yellow
        Write-Host "The server may still be starting up. Try:" -ForegroundColor Yellow
        Write-Host "  1. Wait 30 seconds and try: Invoke-RestMethod http://localhost:$Port/health" -ForegroundColor Yellow
        Write-Host "  2. Check the log file: $LOG_FILE" -ForegroundColor Yellow
        Write-Host "  3. Check Task Scheduler for '$TASK_NAME'" -ForegroundColor Yellow
    }
    
    return $success
}

function Show-Troubleshooting {
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "                 Troubleshooting Guide                      " -ForegroundColor Cyan
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If the API server fails to start:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. Check if port $Port is already in use:" -ForegroundColor Yellow
    Write-Host "   netstat -ano | findstr :$Port" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Manually start the server for debugging:" -ForegroundColor Yellow
    Write-Host "   cd $INSTALL_DIR" -ForegroundColor Gray
    Write-Host "   .\venv\Scripts\python.exe server.py" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Check the installation log:" -ForegroundColor Yellow
    Write-Host "   notepad $LOG_FILE" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Check the server log:" -ForegroundColor Yellow
    Write-Host "   notepad $INSTALL_DIR\odds_harvester_api.log" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. Verify OddsHarvester installation:" -ForegroundColor Yellow
    Write-Host "   cd $HARVESTER_DIR" -ForegroundColor Gray
    Write-Host "   ..\venv\Scripts\python.exe -m src.main --help" -ForegroundColor Gray
    Write-Host ""
    Write-Host "For more help, visit:" -ForegroundColor White
    Write-Host "https://github.com/tacticdemonic/surebet-helper-extension/issues" -ForegroundColor Cyan
    Write-Host ""
}

# === Main Installation Flow ===

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "     OddsHarvester CLV API - Installation Script           " -ForegroundColor Cyan
Write-Host "            For Surebet Helper Extension                   " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Step 1: Check prerequisites
    $pythonPath = Test-PythonVersion
    Test-GitInstalled
    
    # Step 2: Create installation directory
    Initialize-InstallDirectory
    
    # Initialize log file
    "Installation started at $(Get-Date)" | Out-File -FilePath $LOG_FILE
    
    # Step 3: Install OddsHarvester and dependencies
    Install-OddsHarvester -PythonPath $pythonPath
    
    # Step 4: Copy API server files
    Copy-APIFiles
    
    # Step 5: Initialize database
    Initialize-Database
    
    # Step 6: Create Task Scheduler task (or start manually)
    if (-not $SkipTaskScheduler) {
        try {
            New-TaskSchedulerTask
        } catch {
            Write-Log "Failed to create Task Scheduler task: $($_.Exception.Message)" "WARN"
            Write-Log "Starting server manually instead..." "INFO"
            Start-APIServer -Background
        }
    } else {
        Write-Log "Skipping Task Scheduler setup (manual start required)" "INFO"
        Start-APIServer -Background
    }
    
    # Step 7: Test installation
    $testResult = Test-Installation
    
    if (-not $testResult) {
        Show-Troubleshooting
    }
    
    Write-Log "Installation completed!" "SUCCESS"
    
} catch {
    Write-Log "Installation failed: $($_.Exception.Message)" "ERROR"
    Write-Host ""
    Write-Host "Installation failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Show-Troubleshooting
    exit 1
}
