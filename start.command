#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  DeutschPath — macOS Launcher & First-Run Installer
#  Double-click in Finder to install everything and start the platform.
# ─────────────────────────────────────────────────────────────────────────────

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$DIR/backend"
FRONTEND="$DIR/frontend"
LOG="$DIR/setup.log"

# Remove macOS quarantine flag from the .app so it opens normally after this first run
xattr -cr "$DIR/DeutschPath.app" 2>/dev/null || true

# ── ANSI colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

step() { echo -e "\n${CYAN}▶${NC} ${BOLD}$*${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
info() { echo -e "  ${DIM}$*${NC}"; }
die()  {
  echo -e "\n  ${RED}✗ ERROR:${NC} $*"
  echo ""
  echo "  See $LOG for details."
  echo ""
  read -r -p "  Press Enter to close..."
  exit 1
}

clear
echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     DeutschPath — German Learning App     ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Detect whether this is a first-run / needs setup ─────────────────────────
NEEDS_SETUP=false
[ ! -d "$BACKEND/venv" ] && NEEDS_SETUP=true
[ ! -d "$FRONTEND/node_modules" ] && NEEDS_SETUP=true
if [ -f "$BACKEND/.env" ]; then
  KEY=$(grep -E "^GEMINI_API_KEY=" "$BACKEND/.env" | cut -d'=' -f2 | tr -d '[:space:]')
  [ -z "$KEY" ] || [ "$KEY" = "your-gemini-api-key-here" ] && NEEDS_SETUP=true
else
  NEEDS_SETUP=true
fi

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
step "Checking Homebrew..."
for BREW_BIN in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  [ -x "$BREW_BIN" ] && eval "$("$BREW_BIN" shellenv)" 2>/dev/null && break
done

if ! command -v brew &>/dev/null; then
  warn "Homebrew not found — installing it now."
  echo ""
  echo -e "  ${DIM}(You will be prompted for your macOS password — this is normal.)${NC}"
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Re-source after install (Apple Silicon puts brew in /opt/homebrew)
  for BREW_BIN in /opt/homebrew/bin/brew /usr/local/bin/brew; do
    [ -x "$BREW_BIN" ] && eval "$("$BREW_BIN" shellenv)" 2>/dev/null && break
  done
  command -v brew &>/dev/null || die \
    "Homebrew installation failed.\nInstall it manually from https://brew.sh then run start.command again."
  ok "Homebrew installed"
else
  BREW_VER=$(brew --version 2>/dev/null | awk 'NR==1{print $2}')
  ok "Homebrew $BREW_VER"
fi

# ── 2. Python 3.10+ ───────────────────────────────────────────────────────────
step "Checking Python..."
PYTHON=""
for CMD in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$CMD" &>/dev/null; then
    if "$CMD" -c "import sys; exit(0 if sys.version_info>=(3,10) else 1)" 2>/dev/null; then
      PYTHON="$CMD"; break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  warn "Python 3.10+ not found — installing via Homebrew (may take a minute)..."
  brew install python3 >>"$LOG" 2>&1 || die "Failed to install Python via Homebrew."
  # Pick up whatever python3.x was just installed
  for CMD in python3.13 python3.12 python3.11 python3.10 python3; do
    command -v "$CMD" &>/dev/null && PYTHON="$CMD" && break
  done
  [ -z "$PYTHON" ] && die "Python was installed but cannot be found. Try opening a new Terminal and running start.command again."
  ok "Python installed"
fi
VER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
ok "Python $VER  ($PYTHON)"

# ── 3. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found — installing via Homebrew (may take a minute)..."
  brew install node >>"$LOG" 2>&1 || die "Failed to install Node.js via Homebrew."
  command -v node &>/dev/null || die "Node.js installed but not found. Open a new Terminal and run start.command again."
  ok "Node.js installed"
fi
ok "Node.js $(node --version)"

# ── 4. Python virtual environment ────────────────────────────────────────────
step "Setting up Python environment..."
if [ ! -d "$BACKEND/venv" ]; then
  info "Creating virtual environment (first run)..."
  "$PYTHON" -m venv "$BACKEND/venv" || die "Could not create Python virtual environment."
fi
info "Installing/updating Python packages..."
"$BACKEND/venv/bin/pip" install -q --upgrade pip >>"$LOG" 2>&1
"$BACKEND/venv/bin/pip" install -q -r "$BACKEND/requirements.txt" >>"$LOG" 2>&1 \
  || die "pip install failed. Check $LOG for details."
ok "Python packages ready"

# ── 5. Node.js packages ───────────────────────────────────────────────────────
step "Setting up Node.js packages..."
if [ ! -d "$FRONTEND/node_modules" ]; then
  info "Installing npm packages (first run — about 1 minute)..."
  (cd "$FRONTEND" && npm install --silent >>"$LOG" 2>&1) \
    || die "npm install failed. Check $LOG for details."
  ok "npm packages installed"
else
  ok "npm packages already installed"
fi

# ── 6. Environment file ───────────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  printf 'GEMINI_API_KEY=\nFRONTEND_URL=http://localhost:3000\n' > "$BACKEND/.env"
fi

# ── 7. Free ports ─────────────────────────────────────────────────────────────
step "Freeing ports 8000 & 3000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 0.5
ok "Ports cleared"

# ── 8. Launch servers ─────────────────────────────────────────────────────────
step "Starting servers..."

osascript <<APSC
tell application "Terminal"
  activate
  set w to do script "
    clear
    echo 'DeutschPath Backend  -  http://localhost:8000'
    echo '--------------------------------------------'
    cd '$BACKEND'
    source venv/bin/activate
    uvicorn main:app --reload --port 8000
  "
  set custom title of w to "DeutschPath Backend"
end tell
APSC
sleep 0.8

osascript <<APSC
tell application "Terminal"
  activate
  set w to do script "
    clear
    echo 'DeutschPath Frontend  -  http://localhost:3000'
    echo '---------------------------------------------'
    cd '$FRONTEND'
    npm run dev
  "
  set custom title of w to "DeutschPath Frontend"
end tell
APSC

ok "Server windows opened"

# ── 9. Open browser ───────────────────────────────────────────────────────────
echo ""
if $NEEDS_SETUP; then
  info "Opening setup wizard..."
  sleep 1
  open "file://$DIR/setup.html"
else
  info "Waiting for app to start..."
  for i in $(seq 1 60); do
    sleep 1
    curl -s -o /dev/null -m 1 "http://localhost:3000" && break
  done
  open "http://localhost:3000"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ DeutschPath is running!${NC}"
echo -e "  Frontend : ${CYAN}http://localhost:3000${NC}"
echo -e "  Backend  : ${CYAN}http://localhost:8000${NC}"
echo ""
echo -e "${DIM}Close the Backend and Frontend Terminal windows to stop the app.${NC}"
echo ""
