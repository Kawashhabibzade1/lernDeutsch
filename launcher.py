"""
DeutschPath Launcher
Opens a browser-based progress page while starting the servers, then
redirects automatically to the app. No tkinter / GUI library needed.
"""
import hashlib
import os
import sys
import platform
import subprocess
import threading
import webbrowser
import time
import shutil
import json
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

# ── Project root ───────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    _exe = os.path.abspath(sys.executable)
    ROOT = (
        os.path.normpath(os.path.join(_exe, "..", "..", "..", ".."))
        if platform.system() == "Darwin"
        else os.path.dirname(_exe)
    )
else:
    ROOT = os.path.dirname(os.path.abspath(__file__))

BACKEND        = os.path.join(ROOT, "backend")
FRONTEND       = os.path.join(ROOT, "frontend")
ENV_FILE       = os.path.join(BACKEND, ".env")
LOG_FILE       = os.path.join(ROOT, "launcher.log")
DEPS_HASH_FILE  = os.path.join(BACKEND,  ".deps_hash")
PKG_HASH_FILE   = os.path.join(FRONTEND, ".pkg_hash")
BUILD_HASH_FILE = os.path.join(FRONTEND, ".build_hash")

_IS_WIN   = platform.system() == "Windows"
_venv_bin = os.path.join(BACKEND, "venv", "Scripts" if _IS_WIN else "bin")
VENV_PY   = os.path.join(_venv_bin, "python.exe"  if _IS_WIN else "python")
VENV_PIP  = os.path.join(_venv_bin, "pip.exe"     if _IS_WIN else "pip")
UVICORN   = os.path.join(_venv_bin, "uvicorn.exe" if _IS_WIN else "uvicorn")
_NO_WIN   = {"creationflags": subprocess.CREATE_NO_WINDOW} if _IS_WIN else {}

LAUNCHER_PORT = 9731
# Always use localhost for browser-facing URLs — Turbopack rejects 127.0.0.1
# on both Mac and Windows (JS runs but pages are blank/unresponsive).
# Use 127.0.0.1 only for internal urllib checks (bypasses DNS, avoids IPv6).
_APP_URL      = "http://localhost:3000"
_APP_CHECK    = "http://127.0.0.1:3000"   # internal readiness probe only
_BACKEND_URL  = "http://127.0.0.1:8000" if _IS_WIN else "http://localhost:8000"

# ── Shared state (setup thread → HTTP handler) ─────────────────────────────────
_state: dict = {"text": "Starting...", "pct": 0, "ready": False, "error": ""}
_server: "HTTPServer | None" = None
_done  = threading.Event()

# ── Single-page launcher (progress → optional key setup → redirect) ────────────
HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DeutschPath</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0F172A;color:#E2E8F0;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;
  }
  .card{
    background:#111827;border:1px solid #1E293B;border-radius:16px;
    padding:40px;width:100%;max-width:460px;
    box-shadow:0 24px 80px rgba(0,0,0,.6);
  }
  .logo{
    display:flex;align-items:center;gap:14px;
    margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #1E293B;
  }
  .logo-flag{font-size:30px;line-height:1}
  .logo-text h1{font-size:20px;font-weight:700;color:#fff}
  .logo-text p{font-size:13px;color:#64748B;margin-top:2px}
  .ph{display:none;animation:fade .3s ease}
  .ph.active{display:block}
  @keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

  /* loading */
  .st-text{font-size:1rem;color:#94A3B8;margin-bottom:12px;min-height:24px}
  .st-text.err{color:#EF4444}
  .bar-wrap{background:#1E293B;border-radius:999px;height:8px;overflow:hidden}
  .bar{background:#4F8EF7;height:100%;width:0%;border-radius:999px;transition:width .5s ease}
  .bar.ok{background:#22C55E}
  .pct-txt{color:#475569;font-size:.78rem;text-align:right;margin-top:5px}
  .hint-txt{color:#334155;font-size:.76rem;margin-top:20px}

  /* configure */
  .ph-title{font-size:18px;font-weight:600;color:#F1F5F9;margin-bottom:6px}
  .ph-desc{font-size:13px;color:#64748B;margin-bottom:22px;line-height:1.6}
  .fld-lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#64748B;margin-bottom:7px}
  .key-inp{
    width:100%;padding:11px 14px;
    background:#0F172A;border:1px solid #1E293B;border-radius:9px;
    color:#E2E8F0;font-size:14px;font-family:'SF Mono','Fira Code',monospace;
    outline:none;transition:border-color .2s;margin-bottom:6px;
  }
  .key-inp:focus{border-color:#4F8EF7;box-shadow:0 0 0 3px rgba(79,142,247,.12)}
  .key-inp::placeholder{color:#334155}
  .fld-hint{font-size:12px;color:#64748B;margin-bottom:18px;line-height:1.5}
  .fld-hint a{color:#4F8EF7;text-decoration:none}
  .toast{padding:10px 14px;border-radius:7px;font-size:12px;margin-bottom:14px;display:none}
  .toast.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#EF4444}
  .toast.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22C55E}

  /* buttons */
  .btn{
    display:flex;align-items:center;justify-content:center;gap:7px;
    width:100%;padding:12px 18px;border-radius:9px;border:none;
    font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;line-height:1;
  }
  .btn+.btn{margin-top:8px}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .btn-primary{background:#4F8EF7;color:#0F172A}
  .btn-primary:hover:not(:disabled){background:#6BA3F8;transform:translateY(-1px)}
  .btn-ghost{background:transparent;color:#64748B;border:1px solid #1E293B}
  .btn-ghost:hover{color:#94A3B8;border-color:#334155}

  /* done */
  .done-circle{
    width:68px;height:68px;background:rgba(34,197,94,.12);border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:30px;margin:0 auto 20px;
  }
  .done-title{font-size:22px;font-weight:700;text-align:center;color:#F1F5F9;margin-bottom:6px}
  .done-sub{font-size:13px;color:#64748B;text-align:center;margin-bottom:22px;line-height:1.5}
  .btn-launch{
    display:flex;align-items:center;justify-content:center;gap:8px;
    width:100%;padding:13px 18px;border-radius:9px;
    background:#22C55E;color:#0F172A;font-size:14px;font-weight:600;
    text-decoration:none;transition:all .18s;
  }
  .btn-launch:hover{background:#4ADE80;transform:translateY(-1px)}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-flag">&#127465;&#127466;</div>
    <div class="logo-text"><h1>DeutschPath</h1><p>German Learning Platform</p></div>
  </div>

  <!-- Phase 1: progress -->
  <div id="ph-load" class="ph active">
    <p class="st-text" id="st">Starting...</p>
    <div class="bar-wrap"><div class="bar" id="bar"></div></div>
    <p class="pct-txt" id="pct">0%</p>
    <p class="hint-txt" id="hint">First run takes ~30 s &middot; subsequent launches are instant</p>
  </div>

  <!-- Phase 2: API key -->
  <div id="ph-cfg" class="ph">
    <p class="ph-title">Add your Gemini API key</p>
    <p class="ph-desc">
      DeutschPath uses Google Gemini AI for word analysis, grammar practice, and
      conversation. Your free key enables all features.
    </p>
    <div class="fld-lbl">Gemini API Key</div>
    <input class="key-inp" id="key-input" type="text"
           placeholder="AQ.Ab8R… or AIzaSy…" autocomplete="off" spellcheck="false">
    <p class="fld-hint">
      Get a free key at
      <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a>
      &mdash; no billing required.<br>
      New keys start with <code style="font-family:monospace;font-size:0.85em">AQ.</code>
      (e.g. <code style="font-family:monospace;font-size:0.85em">AQ.Ab8R&hellip;</code>).
      Older <code style="font-family:monospace;font-size:0.85em">AIza&hellip;</code> keys also work for now.
    </p>
    <div class="toast ok"  id="test-toast"></div>
    <div class="toast err" id="err-toast"></div>
    <button class="btn btn-ghost" id="test-btn" onclick="testKey()">&#9889; Test Connection</button>
    <button class="btn btn-primary" id="save-btn" onclick="saveKey()">Save &amp; Launch App</button>
    <button class="btn btn-ghost" onclick="skipKey()">Skip &mdash; I&apos;ll add it in Settings</button>
  </div>

  <!-- Phase 3: done -->
  <div id="ph-done" class="ph">
    <div class="done-circle">&#10003;</div>
    <p class="done-title">You&apos;re all set!</p>
    <p class="done-sub" id="done-sub">Opening the app in 3 seconds...</p>
    <a href="__APP_URL__" class="btn-launch">Open DeutschPath &rarr;</a>
  </div>
</div>
<script>
  const BACKEND = '__BACKEND_URL__';

  function show(id){
    document.querySelectorAll('.ph').forEach(el=>el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // Phase 1: poll launcher /status
  const timer = setInterval(pollLauncher, 500);
  function pollLauncher(){
    fetch('/status').then(r=>r.json()).then(d=>{
      document.getElementById('st').textContent  = d.text;
      document.getElementById('bar').style.width = d.pct + '%';
      document.getElementById('pct').textContent = d.pct + '%';
      if(d.error){
        clearInterval(timer);
        document.getElementById('st').classList.add('err');
        document.getElementById('hint').textContent = 'Check launcher.log in the project folder.';
        return;
      }
      if(d.ready){
        clearInterval(timer);
        document.getElementById('bar').classList.add('ok');
        document.getElementById('bar').style.width = '100%';
        document.getElementById('pct').textContent = 'Ready!';
        checkApiKey();
      }
    }).catch(()=>{});
  }

  // Transition: check if key is configured
  async function checkApiKey(){
    try{
      const r = await fetch(BACKEND+'/settings',{cache:'no-store'});
      const d = await r.json();
      if(d.gemini_key_set){ show('ph-done'); autoRedirect(); }
      else                 { show('ph-cfg'); }
    }catch{ show('ph-done'); autoRedirect(); }
  }

  // Phase 2: test key
  async function testKey(){
    const key  = document.getElementById('key-input').value.trim();
    const err  = document.getElementById('err-toast');
    const ok   = document.getElementById('test-toast');
    const btn  = document.getElementById('test-btn');
    err.style.display='none'; ok.style.display='none';
    if(!key){ err.textContent='Enter your API key first.'; err.style.display='block'; return; }
    btn.disabled=true; btn.textContent='Testing…';
    try{
      const r = await fetch(BACKEND+'/settings/test-connection',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({api_key:key}),
      });
      if(!r.ok){
        const d = await r.json().catch(()=>({}));
        throw new Error(d.detail || 'HTTP '+r.status);
      }
      ok.textContent='✓ Connected! Key works — click Save & Launch App.';
      ok.style.display='block';
      btn.textContent='✓ Connection OK';
    }catch(e){
      err.textContent='✗ '+( e.message || 'Connection failed');
      err.style.display='block';
      btn.textContent='&#9889; Test Connection';
    }
    btn.disabled=false;
  }

  // Phase 2: save key
  async function saveKey(){
    const key = document.getElementById('key-input').value.trim();
    const err = document.getElementById('err-toast');
    const btn = document.getElementById('save-btn');
    err.style.display = 'none';
    if(!key){ err.textContent='Please enter your API key.'; err.style.display='block'; return; }
    if(!key.startsWith('AQ.') && !key.startsWith('AI')){
      err.textContent='Invalid key format — expected AQ.Ab8R… (new) or AIzaSy… (legacy).';
      err.style.display='block'; return;
    }
    btn.disabled = true; btn.textContent = 'Saving…';
    try{
      const r = await fetch(BACKEND+'/settings',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({gemini_api_key:key}),
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      show('ph-done'); autoRedirect();
    }catch(e){
      err.textContent = 'Could not save ('+e.message+'). Add it in Settings after launch.';
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Save & Launch App';
    }
  }
  function skipKey(){ show('ph-done'); autoRedirect(); }

  // Phase 3: countdown then redirect
  function autoRedirect(){
    let n = 3;
    const sub = document.getElementById('done-sub');
    const t = setInterval(()=>{
      n--;
      if(n<=0){ clearInterval(t); window.location.href='__APP_URL__'; }
      else{ sub.textContent='Opening the app in '+n+' second'+(n!==1?'s':'')+'…'; }
    },1000);
  }

  document.getElementById('key-input').addEventListener('keydown',e=>{
    if(e.key==='Enter') saveKey();
  });
  document.getElementById('key-input').addEventListener('input',()=>{
    document.getElementById('test-toast').style.display='none';
    document.getElementById('err-toast').style.display='none';
    document.getElementById('test-btn').textContent='&#9889; Test Connection';
  });
</script>
</body>
</html>
"""


# ── Tiny HTTP server ───────────────────────────────────────────────────────────
class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass

    def do_GET(self):
        if self.path == "/":
            body = (HTML
                    .replace("__APP_URL__", _APP_URL)
                    .replace("__BACKEND_URL__", _BACKEND_URL)
                    .encode("utf-8"))
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/status":
            body = json.dumps(_state).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def _start_server() -> HTTPServer:
    srv = HTTPServer(("", LAUNCHER_PORT), _Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


# ── Setup steps ────────────────────────────────────────────────────────────────
def _set(text: str, pct: int) -> None:
    _state["text"] = text
    _state["pct"]  = pct


def _run_setup() -> None:
    _set("Starting...", 1)   # confirm thread is alive before touching the filesystem

    try:
        logf = open(LOG_FILE, "a")
    except Exception:
        # Fallback if launcher.log is locked (e.g. previous crashed run on Windows)
        logf = open(os.devnull, "w")

    def run(*args, **kw):
        kw.setdefault("stdout", logf)
        kw.setdefault("stderr", logf)
        kw.update(_NO_WIN)
        return subprocess.run(*args, **kw)

    try:
        _set("Checking Python...", 5)
        sys_py = _find_python()
        if not sys_py:
            _state["error"] = "Python 3.10+ not found"
            _state["text"]  = "Python 3.10+ not found. Install from python.org."
            time.sleep(30)
            return

        _set("Checking Node.js...", 12)
        if _IS_WIN:
            _add_node_to_path()
        npm = shutil.which("npm")
        if not shutil.which("node") or not npm:
            _state["error"] = "Node.js not found"
            _state["text"]  = "Node.js not found. Install from nodejs.org."
            time.sleep(30)
            return

        # ── Python venv + packages ─────────────────────────────────────────
        venv_exists = os.path.isfile(VENV_PY)
        if venv_exists:
            # Verify the venv is healthy and was built with the same Python.
            # If not (e.g. was created with a beta Python and is now broken),
            # delete it so it gets rebuilt cleanly.
            chk = subprocess.run(
                [VENV_PY, "-c",
                 "import sys; "
                 "exit(0 if sys.version_info.releaselevel=='final' else 1)"],
                capture_output=True, timeout=10, **_NO_WIN,
            )
            if chk.returncode != 0:
                shutil.rmtree(os.path.join(BACKEND, "venv"), ignore_errors=True)
                # Also clear the deps hash so packages are reinstalled.
                if os.path.isfile(DEPS_HASH_FILE):
                    os.remove(DEPS_HASH_FILE)
                venv_exists = False

        if not venv_exists:
            _set("Creating Python environment...", 28)
            run([sys_py, "-m", "venv", os.path.join(BACKEND, "venv")])

        if not venv_exists or _requirements_changed():
            _set("Installing Python packages...", 42)
            run([sys_py, "-m", "pip", "install", "-q", "--upgrade", "pip"])
            run([VENV_PIP, "install", "-q", "--prefer-binary", "-r",
                 os.path.join(BACKEND, "requirements.txt")])
            _save_deps_hash()
        else:
            _set("Python packages up to date", 42)

        # Generate app icon on Mac and browser favicon (Pillow is now in the venv)
        _create_mac_icon()
        _create_favicon()
        _create_windows_shortcut()

        # ── Node modules ───────────────────────────────────────────────────
        # Check the actual next binary, not just the directory — npm install
        # can create the directory and then fail, leaving the hash saved but
        # next missing so subsequent runs incorrectly skip the install.
        _next_bin = os.path.join(
            FRONTEND, "node_modules", ".bin",
            "next.cmd" if _IS_WIN else "next",
        )
        if not os.path.isfile(_next_bin) or _package_changed():
            _set("Installing Node.js packages...", 68)
            # Clear the hash so a crashed install is retried next time
            if os.path.isfile(PKG_HASH_FILE):
                os.remove(PKG_HASH_FILE)
            run([npm, "install"], cwd=FRONTEND)
            # Only save hash if next was actually installed
            if os.path.isfile(_next_bin):
                _save_pkg_hash()
        else:
            _set("Node.js packages up to date", 68)

        if not os.path.isfile(ENV_FILE):
            with open(ENV_FILE, "w") as f:
                f.write(f"GEMINI_API_KEY=\nFRONTEND_URL={_APP_URL}\n")

        # Build the frontend (production mode — fast start, low RAM, no fan)
        if _build_needed():
            _set("Building frontend (first time ~60s, then cached)...", 72)
            result = run([npm, "run", "build"], cwd=FRONTEND)
            if result.returncode != 0:
                _state["error"] = "Frontend build failed — check launcher.log for details."
                _state["text"]  = "Build failed. Check launcher.log in the project folder."
                time.sleep(30)
                return
            _save_build_hash()
        else:
            _set("Frontend build up to date", 72)

        # Kill any existing servers before starting fresh
        _kill_ports()

        _set("Starting backend...", 84)
        subprocess.Popen(
            [UVICORN, "main:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=BACKEND, stdout=logf, stderr=logf, **_NO_WIN,
        )
        time.sleep(1.5)

        _set("Starting frontend...", 90)
        subprocess.Popen(
            [npm, "start"],
            cwd=FRONTEND, stdout=logf, stderr=logf, **_NO_WIN,
        )

        _set("Waiting for app to load...", 95)
        for _ in range(90):
            if _port_open(3000):
                break
            time.sleep(1)
        else:
            _state["error"] = "Frontend server did not start — check launcher.log."
            _state["text"]  = "Frontend server failed to start. Check launcher.log."
            time.sleep(30)
            return

        _state["text"]  = "Ready"
        _state["pct"]   = 100
        _state["ready"] = True

        # Wait for the browser to receive the ready signal before exiting.
        time.sleep(6)

    except Exception as exc:
        _state["error"] = str(exc)
        _state["text"]  = str(exc)
        time.sleep(30)   # keep progress page visible so user can read the error
    finally:
        try:
            logf.close()
        except Exception:
            pass
        _done.set()


# ── Helpers ────────────────────────────────────────────────────────────────────
def _find_python() -> "str | None":
    # On Windows we launch via pythonw.exe; check for sibling python.exe first.
    # This works even when Python is not yet in PATH after a fresh winget install.
    _ver_check = (
        "import sys; "
        "exit(0 if sys.version_info>=(3,10) "
        "and sys.version_info.releaselevel=='final' else 1)"
    )

    if _IS_WIN:
        py_exe = os.path.join(os.path.dirname(sys.executable), "python.exe")
        if os.path.isfile(py_exe):
            try:
                r = subprocess.run(
                    [py_exe, "-c", _ver_check],
                    capture_output=True, timeout=10, **_NO_WIN,
                )
                if r.returncode == 0:
                    return py_exe
            except Exception:
                pass

    for cmd in ("python3.13", "python3.12", "python3.11", "python3.10",
                "python3", "python"):
        path = shutil.which(cmd)
        if path:
            try:
                r = subprocess.run(
                    [path, "-c", _ver_check],
                    capture_output=True, timeout=10,
                )
                if r.returncode == 0:
                    return path
            except Exception:
                pass
    return None


def _add_node_to_path() -> None:
    """On Windows, find a freshly-installed Node.js that isn't in PATH yet and add it."""
    pf  = os.environ.get("PROGRAMFILES",      r"C:\Program Files")
    pf86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
    appdata = os.environ.get("APPDATA", "")
    candidates = [
        os.path.join(pf,   "nodejs"),
        os.path.join(pf86, "nodejs"),
        os.path.join(appdata, "npm"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "nodejs"),
    ]
    current = os.environ.get("PATH", "")
    for d in candidates:
        if os.path.isfile(os.path.join(d, "node.exe")) and d not in current:
            os.environ["PATH"] = d + os.pathsep + current
            break


def _kill_ports() -> None:
    if _IS_WIN:
        for port in (8000, 3000):
            r = subprocess.run(
                f'netstat -ano | findstr ":{port} "',
                shell=True, capture_output=True, text=True,
            )
            for line in r.stdout.splitlines():
                if "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        subprocess.run(["taskkill", "/F", "/PID", parts[-1]],
                                       capture_output=True)
    else:
        for port in (8000, 3000):
            subprocess.run(
                f"lsof -ti:{port} | xargs kill -9 2>/dev/null || true",
                shell=True, capture_output=True,
            )
    time.sleep(0.5)


def _needs_setup(env_path: str) -> bool:
    if not os.path.isfile(env_path):
        return True
    with open(env_path) as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                val = line.split("=", 1)[1].strip()
                return not val or val == "your-gemini-api-key-here"
    return True


def _file_md5(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def _requirements_changed() -> bool:
    req = os.path.join(BACKEND, "requirements.txt")
    if not os.path.isfile(req):
        return False
    if not os.path.isfile(DEPS_HASH_FILE):
        return True
    with open(DEPS_HASH_FILE) as f:
        return f.read().strip() != _file_md5(req)


def _save_deps_hash() -> None:
    req = os.path.join(BACKEND, "requirements.txt")
    if os.path.isfile(req):
        with open(DEPS_HASH_FILE, "w") as f:
            f.write(_file_md5(req))


def _package_changed() -> bool:
    pkg = os.path.join(FRONTEND, "package.json")
    if not os.path.isfile(pkg):
        return False
    if not os.path.isfile(PKG_HASH_FILE):
        return True
    with open(PKG_HASH_FILE) as f:
        return f.read().strip() != _file_md5(pkg)


def _save_pkg_hash() -> None:
    pkg = os.path.join(FRONTEND, "package.json")
    if os.path.isfile(pkg):
        with open(PKG_HASH_FILE, "w") as f:
            f.write(_file_md5(pkg))


def _source_hash() -> str:
    """Hash mtimes of all source files that affect the production build."""
    h = hashlib.md5()
    watch_dirs = [os.path.join(FRONTEND, "src")]
    watch_files = [
        os.path.join(FRONTEND, f)
        for f in ("next.config.js", "tailwind.config.js", "tsconfig.json",
                  "package.json", "postcss.config.js")
    ]
    for d in watch_dirs:
        for root, _, files in os.walk(d):
            for name in sorted(files):
                fp = os.path.join(root, name)
                try:
                    h.update(fp.encode())
                    h.update(str(os.path.getmtime(fp)).encode())
                except OSError:
                    pass
    for fp in watch_files:
        if os.path.isfile(fp):
            h.update(str(os.path.getmtime(fp)).encode())
    return h.hexdigest()


def _build_needed() -> bool:
    build_id = os.path.join(FRONTEND, ".next", "BUILD_ID")
    if not os.path.isfile(build_id):
        return True
    if not os.path.isfile(BUILD_HASH_FILE):
        return True
    with open(BUILD_HASH_FILE) as f:
        return f.read().strip() != _source_hash()


def _save_build_hash() -> None:
    with open(BUILD_HASH_FILE, "w") as f:
        f.write(_source_hash())


def _create_mac_icon() -> None:
    """Generate AppIcon.icns for DeutschPath.app using Pillow (already in the venv)."""
    if platform.system() != "Darwin":
        return
    resources = os.path.join(ROOT, "DeutschPath.app", "Contents", "Resources")
    icns_path  = os.path.join(resources, "AppIcon.icns")
    if os.path.isfile(icns_path):
        return  # already exists, skip

    script = r"""
import sys, os, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont

ROOT      = sys.argv[1]
resources = os.path.join(ROOT, "DeutschPath.app", "Contents", "Resources")
os.makedirs(resources, exist_ok=True)

logo_path = os.path.join(ROOT, "frontend", "public", "logo.png")
alt_path  = os.path.join(ROOT, "frontend", "public", "logo.jpg")

if os.path.isfile(logo_path) or os.path.isfile(alt_path):
    from PIL import ImageOps
    src = logo_path if os.path.isfile(logo_path) else alt_path
    img = ImageOps.fit(Image.open(src).convert("RGBA"), (1024, 1024),
                       method=resample, centering=(0.5, 0.5))
else:
    SIZE, PADDING, RADIUS = 1024, 80, 200
    img  = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([PADDING, PADDING, SIZE-PADDING, SIZE-PADDING],
                           radius=RADIUS, fill=(30, 58, 95, 255))
    fnt = None
    for fp in ["/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(fp):
            try: fnt = ImageFont.truetype(fp, 560); break
            except: pass
    if fnt is None: fnt = ImageFont.load_default()
    bb = draw.textbbox((0,0), "D", font=fnt)
    x  = (SIZE - (bb[2]-bb[0])) // 2 - bb[0]
    y  = (SIZE - (bb[3]-bb[1])) // 2 - bb[1]
    draw.text((x, y), "D", fill=(255,255,255,255), font=fnt)

iconset = os.path.join(resources, "AppIcon.iconset")
os.makedirs(iconset, exist_ok=True)
try:    resample = Image.Resampling.LANCZOS
except: resample = Image.LANCZOS

for base, scale in [(16,1),(16,2),(32,1),(32,2),(64,1),(64,2),
                    (128,1),(128,2),(256,1),(256,2),(512,1),(512,2)]:
    px   = base * scale
    name = (f"icon_{base}x{base}.png" if scale==1
            else f"icon_{base}x{base}@2x.png")
    img.resize((px, px), resample).save(os.path.join(iconset, name))

icns = os.path.join(resources, "AppIcon.icns")
subprocess.run(["/usr/bin/iconutil", "-c", "icns", iconset, "-o", icns],
               capture_output=True)
shutil.rmtree(iconset, ignore_errors=True)
subprocess.run(["touch", os.path.join(ROOT, "DeutschPath.app")], capture_output=True)
"""
    subprocess.run([VENV_PY, "-c", script, ROOT], capture_output=True)


def _port_open(port: int) -> bool:
    """TCP-level check — works regardless of HTTP redirects or error codes."""
    import socket
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def _servers_running() -> bool:
    return _port_open(8000) and _port_open(3000)


def _focus_or_open(url: str) -> None:
    """Focus an existing browser tab at url, or open a new one if none exists."""
    if platform.system() != "Darwin":
        webbrowser.open(url)
        return

    # AppleScript: scan running browsers for a tab already showing localhost:3000.
    # Covers Chrome-family (Chrome, Chromium, Arc, Brave, Edge) and Safari.
    script = f'''
set targetURL to "{url}"
set chromeBrowsers to {{"Google Chrome", "Chromium", "Arc", "Brave Browser", "Microsoft Edge"}}

repeat with b in chromeBrowsers
  if application b is running then
    try
      tell application b
        set wList to windows
        repeat with w in wList
          set tIdx to 1
          repeat with t in (tabs of w)
            if (URL of t) starts with targetURL then
              set active tab index of w to tIdx
              set index of w to 1
              activate
              return
            end if
            set tIdx to tIdx + 1
          end repeat
        end repeat
      end tell
    end try
  end if
end repeat

if application "Safari" is running then
  try
    tell application "Safari"
      repeat with w in windows
        repeat with t in tabs of w
          if (URL of t) starts with targetURL then
            set current tab of w to t
            set index of w to 1
            activate
            return
          end if
        end repeat
      end repeat
    end tell
  end try
end if

open location targetURL
'''
    result = subprocess.run(["osascript", "-e", script],
                            capture_output=True, timeout=5)
    if result.returncode != 0:
        webbrowser.open(url)


def _create_favicon() -> None:
    """Create a 64×64 favicon.png in frontend/public/ from logo.png (runs once)."""
    logo = os.path.join(ROOT, "frontend", "public", "logo.png")
    dest = os.path.join(FRONTEND, "public", "favicon.png")
    if os.path.isfile(dest) or not os.path.isfile(logo) or not os.path.isfile(VENV_PY):
        return
    script = r"""
import sys
from PIL import Image, ImageOps
src, dst = sys.argv[1], sys.argv[2]
try:
    img = ImageOps.fit(Image.open(src).convert("RGBA"), (64, 64))
    img.save(dst)
except Exception as e:
    print(e, file=sys.stderr)
"""
    subprocess.run([VENV_PY, "-c", script, logo, dest], capture_output=True)


def _create_windows_shortcut() -> None:
    """Create DeutschPath.lnk with the logo icon (Windows only, runs once).

    VBS files can't carry embedded icons; a .lnk shortcut is the standard
    Windows way to give a script a custom icon.  After the first launch the
    user can use DeutschPath.lnk (or drag it to the Desktop) for a nicer look.
    """
    if not _IS_WIN:
        return
    lnk_path  = os.path.join(ROOT, "DeutschPath.lnk")
    ico_path  = os.path.join(ROOT, "DeutschPath.ico")
    vbs_path  = os.path.join(ROOT, "DeutschPath.vbs")
    logo_path = os.path.join(ROOT, "frontend", "public", "logo.png")

    if os.path.isfile(lnk_path):
        return  # already created
    if not os.path.isfile(vbs_path):
        return

    # Step 1 — convert logo.png → DeutschPath.ico using Pillow (already in venv)
    if not os.path.isfile(ico_path) and os.path.isfile(logo_path) and os.path.isfile(VENV_PY):
        ico_script = r"""
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
try:
    img = Image.open(src).convert("RGBA")
    sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
    resized = [img.resize(s, Image.Resampling.LANCZOS) for s in sizes]
    resized[0].save(dst, format="ICO", sizes=sizes, append_images=resized[1:])
except Exception as e:
    print(e, file=sys.stderr)
"""
        subprocess.run([VENV_PY, "-c", ico_script, logo_path, ico_path],
                       capture_output=True)

    if not os.path.isfile(ico_path):
        return  # no icon available, skip shortcut

    # Step 2 — create the .lnk via PowerShell's WScript.Shell COM object
    ps = (
        f'$s=(New-Object -ComObject WScript.Shell).CreateShortcut("{lnk_path}");'
        f'$s.TargetPath="{vbs_path}";'
        f'$s.IconLocation="{ico_path}";'
        f'$s.Description="DeutschPath - German Learning Platform";'
        f'$s.Save()'
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        capture_output=True, **_NO_WIN,
    )


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[DeutschPath] launcher.py started", flush=True)
    import traceback

    def _err(msg: str) -> None:
        print(f"\n[DeutschPath ERROR] {msg}", flush=True)

    try:
        # If the platform is already running, focus the existing tab — no restart.
        if _servers_running():
            _focus_or_open(_APP_URL)
            sys.exit(0)

        # Kill any stale launcher server left from a previous stuck/crashed run.
        if _IS_WIN:
            r = subprocess.run(
                f'netstat -ano | findstr ":{LAUNCHER_PORT} "',
                shell=True, capture_output=True, text=True,
            )
            for line in r.stdout.splitlines():
                if "LISTENING" in line:
                    parts = line.split()
                    if parts:
                        subprocess.run(["taskkill", "/F", "/PID", parts[-1]],
                                       capture_output=True)
        else:
            subprocess.run(
                f"lsof -ti:{LAUNCHER_PORT} | xargs kill -9 2>/dev/null || true",
                shell=True, capture_output=True,
            )
        time.sleep(0.5)

        # Full startup: show single progress/setup page, start servers, then exit.
        try:
            _server = _start_server()
        except OSError as exc:
            _err(f"Cannot bind to port {LAUNCHER_PORT}: {exc}")
            _err("A previous DeutschPath window may still be running.")
            _err("Close all DeutschPath windows and try again.")
            sys.exit(1)

        threading.Thread(target=_run_setup, daemon=True).start()
        webbrowser.open(f"http://127.0.0.1:{LAUNCHER_PORT}")
        _done.wait()           # block until setup thread signals completion
        if _server:
            _server.shutdown()
        if _state.get("error"):
            _err(f"Setup failed: {_state['error']}")
            sys.exit(1)
        sys.exit(0)

    except SystemExit:
        raise
    except Exception as exc:
        _err(f"Unexpected error: {exc}")
        _err(traceback.format_exc())
        sys.exit(1)
