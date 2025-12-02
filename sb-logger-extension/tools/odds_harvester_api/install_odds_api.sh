#!/usr/bin/env bash
#
# install_odds_api.sh - Install OddsHarvester CLV API for Surebet Helper
#
# This script:
# 1. Verifies Python 3.11+ is installed
# 2. Clones OddsHarvester repository
# 3. Sets up virtual environment with dependencies
# 4. Copies API server files
# 5. Creates systemd user service for auto-start (Linux) or launchd agent (macOS)
# 6. Tests the installation
#
# Usage: ./install_odds_api.sh [options]
#   --port PORT        API port (default: 8765)
#   --no-service       Skip systemd/launchd service creation
#   --force            Force reinstall if already installed
#   --help             Show this help message
#

set -e

# Configuration
PORT="${PORT:-8765}"
MAX_CONCURRENCY="${MAX_CONCURRENCY:-3}"
INSTALL_DIR="${HOME}/.local/share/surebet-helper/odds-harvester-api"
HARVESTER_DIR="${INSTALL_DIR}/OddsHarvester"
VENV_DIR="${INSTALL_DIR}/venv"
LOG_FILE="${INSTALL_DIR}/install.log"
SERVICE_NAME="odds-harvester-api"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_SOURCE_DIR="${SCRIPT_DIR}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_SERVICE=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --no-service)
            SKIP_SERVICE=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "  --port PORT        API port (default: 8765)"
            echo "  --no-service       Skip systemd/launchd service creation"
            echo "  --force            Force reinstall if already installed"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}"
    if [[ -d "$(dirname "${LOG_FILE}")" ]]; then
        echo "${timestamp} [${level}] ${message}" >> "${LOG_FILE}"
    fi
}

log_success() { log "SUCCESS" "${GREEN}$1${NC}"; }
log_info() { log "INFO" "$1"; }
log_warn() { log "WARN" "${YELLOW}$1${NC}"; }
log_error() { log "ERROR" "${RED}$1${NC}"; }

check_python() {
    log_info "Checking Python version..."
    
    local python_cmd=""
    
    # Try python3 first, then python
    if command -v python3 &> /dev/null; then
        python_cmd="python3"
    elif command -v python &> /dev/null; then
        python_cmd="python"
    else
        log_error "Python not found in PATH"
        echo ""
        echo -e "${RED}Python 3.11+ is required but not found.${NC}"
        echo -e "${YELLOW}Please install Python from: https://www.python.org/downloads/${NC}"
        exit 1
    fi
    
    local version=$($python_cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    
    if [[ "$major" -lt 3 ]] || [[ "$major" -eq 3 && "$minor" -lt 11 ]]; then
        log_error "Python 3.11 or higher is required. Found: Python $version"
        exit 1
    fi
    
    log_success "Found Python $version at: $(which $python_cmd)"
    PYTHON_CMD="$python_cmd"
}

check_git() {
    log_info "Checking Git installation..."
    
    if ! command -v git &> /dev/null; then
        log_error "Git not found in PATH"
        echo ""
        echo -e "${RED}Git is required but not found.${NC}"
        echo -e "${YELLOW}Please install Git:${NC}"
        echo -e "  macOS: brew install git"
        echo -e "  Ubuntu/Debian: sudo apt install git"
        echo -e "  Fedora: sudo dnf install git"
        exit 1
    fi
    
    log_success "Found $(git --version)"
}

init_install_dir() {
    log_info "Creating installation directory..."
    
    if [[ -d "$INSTALL_DIR" ]]; then
        if [[ "$FORCE" == "true" ]]; then
            log_warn "Force flag set, removing existing installation..."
            rm -rf "$INSTALL_DIR"
        else
            log_warn "Installation directory already exists: $INSTALL_DIR"
            read -p "Do you want to reinstall? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Installation cancelled by user"
                exit 0
            fi
            rm -rf "$INSTALL_DIR"
        fi
    fi
    
    mkdir -p "$INSTALL_DIR"
    log_success "Created: $INSTALL_DIR"
}

install_odds_harvester() {
    log_info "Cloning OddsHarvester repository..."
    
    cd "$INSTALL_DIR"
    git clone https://github.com/jordantete/OddsHarvester.git 2>&1 | tail -n 5
    log_success "OddsHarvester cloned successfully"
    
    log_info "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    log_success "Virtual environment created"
    
    # Activate venv
    source "$VENV_DIR/bin/activate"
    
    log_info "Installing uv package manager..."
    pip install uv > /dev/null 2>&1
    
    log_info "Installing OddsHarvester dependencies (this may take a few minutes)..."
    cd "$HARVESTER_DIR"
    if ! uv sync > /dev/null 2>&1; then
        log_warn "uv sync failed, falling back to pip..."
        pip install -e . > /dev/null 2>&1
    fi
    log_success "OddsHarvester dependencies installed"
    
    log_info "Installing API server dependencies..."
    pip install fastapi "uvicorn[standard]" sqlalchemy aiosqlite apscheduler psutil httpx > /dev/null 2>&1
    log_success "API dependencies installed"
    
    deactivate
}

copy_api_files() {
    log_info "Copying API server files..."
    
    local files=("server.py" "database.py" "league_mapper.py" "fuzzy_matcher.py" "requirements_api.txt")
    
    for file in "${files[@]}"; do
        local source_path="${API_SOURCE_DIR}/${file}"
        local dest_path="${INSTALL_DIR}/${file}"
        
        if [[ -f "$source_path" ]]; then
            cp "$source_path" "$dest_path"
            log_success "Copied: $file"
        else
            log_warn "Warning: Source file not found: $source_path"
        fi
    done
}

init_database() {
    log_info "Initializing database..."
    
    source "$VENV_DIR/bin/activate"
    
    cat > "${INSTALL_DIR}/init_db.py" << EOF
import sys
sys.path.insert(0, '${INSTALL_DIR}')
from database import Database, init_db
db = Database('${INSTALL_DIR}/clv_cache.db')
init_db(db)
db.close()
print('Database initialized successfully')
EOF
    
    python "${INSTALL_DIR}/init_db.py"
    rm -f "${INSTALL_DIR}/init_db.py"
    
    deactivate
    
    log_success "Database initialized"
}

create_systemd_service() {
    log_info "Creating systemd user service..."
    
    local service_dir="${HOME}/.config/systemd/user"
    mkdir -p "$service_dir"
    
    cat > "${service_dir}/${SERVICE_NAME}.service" << EOF
[Unit]
Description=OddsHarvester CLV API for Surebet Helper
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${VENV_DIR}/bin/python ${INSTALL_DIR}/server.py
Restart=on-failure
RestartSec=10
Environment=API_PORT=${PORT}
Environment=MAX_CONCURRENCY=${MAX_CONCURRENCY}

[Install]
WantedBy=default.target
EOF
    
    # Reload systemd and enable service
    systemctl --user daemon-reload
    systemctl --user enable "${SERVICE_NAME}.service"
    systemctl --user start "${SERVICE_NAME}.service"
    
    log_success "Systemd service created and started"
}

create_launchd_agent() {
    log_info "Creating launchd agent..."
    
    local agents_dir="${HOME}/Library/LaunchAgents"
    mkdir -p "$agents_dir"
    
    local plist_file="${agents_dir}/com.surebethelper.oddsharvester.plist"
    
    cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.surebethelper.oddsharvester</string>
    <key>ProgramArguments</key>
    <array>
        <string>${VENV_DIR}/bin/python</string>
        <string>${INSTALL_DIR}/server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>API_PORT</key>
        <string>${PORT}</string>
        <key>MAX_CONCURRENCY</key>
        <string>${MAX_CONCURRENCY}</string>
    </dict>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/stderr.log</string>
</dict>
</plist>
EOF
    
    # Load the agent
    launchctl load "$plist_file"
    
    log_success "Launchd agent created and loaded"
}

create_service() {
    if [[ "$SKIP_SERVICE" == "true" ]]; then
        log_info "Skipping service creation (manual start required)"
        return
    fi
    
    if [[ "$(uname)" == "Darwin" ]]; then
        create_launchd_agent
    elif [[ "$(uname)" == "Linux" ]]; then
        if command -v systemctl &> /dev/null; then
            create_systemd_service
        else
            log_warn "systemctl not found, skipping service creation"
            log_info "You will need to start the server manually"
        fi
    else
        log_warn "Unknown OS, skipping service creation"
    fi
}

start_server_manually() {
    log_info "Starting API server..."
    
    source "$VENV_DIR/bin/activate"
    nohup python "${INSTALL_DIR}/server.py" > "${INSTALL_DIR}/server.log" 2>&1 &
    deactivate
    
    log_success "API server started in background"
}

test_installation() {
    log_info "Testing installation..."
    
    local max_attempts=10
    local attempt=0
    local success=false
    
    while [[ $attempt -lt $max_attempts ]] && [[ "$success" != "true" ]]; do
        ((attempt++))
        log_info "Testing connection (attempt $attempt/$max_attempts)..."
        
        sleep 3
        
        if response=$(curl -s "http://localhost:${PORT}/health" 2>/dev/null); then
            if echo "$response" | grep -q '"status":"ok"'; then
                success=true
                log_success "API server is running!"
                
                echo ""
                echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${GREEN}║         OddsHarvester CLV API - Installation Complete        ║${NC}"
                echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
                echo -e "${GREEN}║  API URL: http://localhost:${PORT}                               ║${NC}"
                echo -e "${GREEN}║  Status: Running                                             ║${NC}"
                echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
            fi
        fi
    done
    
    if [[ "$success" != "true" ]]; then
        log_error "API server did not respond within expected time"
        echo ""
        echo -e "${YELLOW}Installation completed but server test failed.${NC}"
        echo -e "${YELLOW}The server may still be starting up. Try:${NC}"
        echo -e "  1. Wait 30 seconds and try: curl http://localhost:${PORT}/health"
        echo -e "  2. Check the log file: ${LOG_FILE}"
        echo -e "  3. Check the server log: ${INSTALL_DIR}/server.log"
    fi
    
    return 0
}

show_troubleshooting() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}                    Troubleshooting Guide                       ${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}If the API server fails to start:${NC}"
    echo ""
    echo "1. Check if port ${PORT} is already in use:"
    echo "   lsof -i :${PORT}"
    echo ""
    echo "2. Manually start the server for debugging:"
    echo "   cd ${INSTALL_DIR}"
    echo "   ./venv/bin/python server.py"
    echo ""
    echo "3. Check the installation log:"
    echo "   cat ${LOG_FILE}"
    echo ""
    echo "4. Check the server log:"
    echo "   cat ${INSTALL_DIR}/odds_harvester_api.log"
    echo ""
    echo "5. Verify OddsHarvester installation:"
    echo "   cd ${HARVESTER_DIR}"
    echo "   ../venv/bin/python -m src.main --help"
    echo ""
    echo -e "${CYAN}For more help, visit:${NC}"
    echo "https://github.com/tacticdemonic/surebet-helper-extension/issues"
    echo ""
}

# === Main Installation Flow ===

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       OddsHarvester CLV API - Installation Script            ║${NC}"
echo -e "${CYAN}║              For Surebet Helper Extension                    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run installation steps
check_python
check_git
init_install_dir

# Initialize log file
echo "Installation started at $(date)" > "${LOG_FILE}"

install_odds_harvester
copy_api_files
init_database
create_service

# If service creation was skipped, start manually
if [[ "$SKIP_SERVICE" == "true" ]]; then
    start_server_manually
fi

test_installation
show_troubleshooting

log_success "Installation completed!"
