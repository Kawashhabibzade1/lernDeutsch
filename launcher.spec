# launcher.spec — PyInstaller build spec for DeutschPath GUI Launcher
#
# ONE-TIME SETUP
# --------------
#   pip install pyinstaller
#
# BUILD (run from this directory)
# --------------------------------
#   Mac:     pyinstaller launcher.spec
#            → produces  dist/DeutschPath.app
#            → move DeutschPath.app next to the backend/ and frontend/ folders
#
#   Windows: pyinstaller launcher.spec
#            → produces  dist\DeutschPath.exe
#            → move DeutschPath.exe next to the backend\ and frontend\ folders
#
# The compiled app/exe contains its own Python runtime — users do NOT need
# Python installed to run it. (They still need Node.js for the frontend.)

import platform as _platform

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    excludes=['numpy', 'pandas', 'matplotlib', 'PIL', 'scipy'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='DeutschPath',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

if _platform.system() == 'Darwin':
    app = BUNDLE(
        exe,
        name='DeutschPath.app',
        icon=None,
        bundle_identifier='com.deutschpath.launcher',
        info_plist={
            'NSHighResolutionCapable': True,
            'CFBundleName': 'DeutschPath',
            'CFBundleDisplayName': 'DeutschPath',
            'CFBundleVersion': '1.0.0',
            'CFBundleShortVersionString': '1.0',
            'NSRequiresAquaSystemAppearance': False,
        },
    )
