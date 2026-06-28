' DeutschPath Windows Launcher
' Double-click this file to start DeutschPath with no terminal window.

Option Explicit

Dim WshShell, fso, root, launcher

Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")

root     = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = root & "\launcher.py"

' ── Guard: running from inside a ZIP (Windows extracts to Temp folder) ────────
If InStr(LCase(root), "\appdata\local\temp\") > 0 Or _
   InStr(LCase(root), "\temp\") > 0 Or _
   Not fso.FileExists(launcher) Then
    MsgBox "DeutschPath is running from a temporary folder." & vbCrLf & vbCrLf & _
           "You must extract the ZIP file before running it." & vbCrLf & vbCrLf & _
           "Steps:" & vbCrLf & _
           "  1. Close this dialog" & vbCrLf & _
           "  2. Find the downloaded ZIP file" & vbCrLf & _
           "  3. Right-click it  →  Extract All" & vbCrLf & _
           "  4. Open the extracted folder" & vbCrLf & _
           "  5. Double-click DeutschPath.vbs", _
           vbCritical, "DeutschPath — Extract ZIP First"
    WScript.Quit 1
End If

' ── Find Python, auto-install if missing, then launch ────────────────────────
Dim pythonw : pythonw = FindPython()

If pythonw = "" Then
    pythonw = InstallPython()
End If

If pythonw <> "" Then
    WshShell.Run """" & pythonw & """ """ & launcher & """", 0, False
End If


' =============================================================================
' Helpers
' =============================================================================

Function FindPython()
    FindPython = ""
    Dim candidates(9)
    candidates(0) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe")
    candidates(1) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe")
    candidates(2) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python311\pythonw.exe")
    candidates(3) = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python310\pythonw.exe")
    candidates(4) = "C:\Python313\pythonw.exe"
    candidates(5) = "C:\Python312\pythonw.exe"
    candidates(6) = "C:\Python311\pythonw.exe"
    candidates(7) = "C:\Python310\pythonw.exe"
    candidates(8) = WshShell.ExpandEnvironmentStrings("%PROGRAMFILES%\Python313\pythonw.exe")
    candidates(9) = WshShell.ExpandEnvironmentStrings("%PROGRAMFILES%\Python312\pythonw.exe")

    Dim i
    For i = 0 To 9
        If fso.FileExists(candidates(i)) Then
            FindPython = candidates(i)
            Exit Function
        End If
    Next

    On Error Resume Next
    Dim objExec
    Set objExec = WshShell.Exec("where pythonw")
    If Err.Number = 0 Then
        Dim ln : ln = Trim(objExec.StdOut.ReadLine())
        If fso.FileExists(ln) Then FindPython = ln
    End If
    On Error GoTo 0
End Function


Function InstallPython()
    InstallPython = ""

    Dim hasWinget
    hasWinget = (WshShell.Run("cmd /c winget --version >nul 2>&1", 0, True) = 0)

    If hasWinget Then
        Dim dlg
        dlg = MsgBox("Python 3.11 is required to run DeutschPath." & vbCrLf & vbCrLf & _
                     "Click OK to install it automatically using Windows Package Manager." & vbCrLf & _
                     "This takes about 1-2 minutes and requires an internet connection.", _
                     vbOKCancel + vbInformation, "DeutschPath — Installing Python")

        If dlg <> vbOK Then WScript.Quit 0

        WshShell.Run "cmd /c winget install --id Python.Python.3.11 --source winget " & _
                     "--accept-source-agreements --accept-package-agreements", 1, True

        InstallPython = FindPython()

        If InstallPython = "" Then
            MsgBox "Python was installed successfully!" & vbCrLf & vbCrLf & _
                   "Please double-click DeutschPath.vbs one more time to start the platform.", _
                   vbInformation, "DeutschPath — Almost Ready"
            WScript.Quit 0
        End If

    Else
        Dim ans
        ans = MsgBox("Python 3.10 or newer is required but was not found." & vbCrLf & vbCrLf & _
                     "Click OK to open the Python download page, then:" & vbCrLf & _
                     "  1. Download Python 3.11 or newer" & vbCrLf & _
                     "  2. Run the installer" & vbCrLf & _
                     "  3. IMPORTANT: check ""Add Python to PATH"" on the first screen" & vbCrLf & _
                     "  4. Run DeutschPath.vbs again when done", _
                     vbOKCancel + vbExclamation, "DeutschPath — Python Required")
        If ans = vbOK Then
            WshShell.Run "https://www.python.org/downloads/", 1, False
        End If
        WScript.Quit 1
    End If
End Function
