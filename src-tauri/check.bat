@echo off
setlocal
set "PATH=C:\Users\Windows\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;%PATH%"
set CARGO_BUILD_JOBS=4
REM CARGO_TARGET_DIR should be set globally via User Environment Variable
REM to a path outside TRAE sandbox (e.g. C:\cargo-target-dominate)
REM to prevent recycle bin pollution from cargo incremental cleanup.
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
cd /d "e:\Project\Dominate\src-tauri"
echo === cargo check -j 4 ===
cargo check -j 4 > e:\Project\cargo_check.log 2>&1
echo === Exit: %ERRORLEVEL% ===
echo.
echo === cargo test --lib ===
cargo test --lib > e:\Project\cargo_test.log 2>&1
echo === Exit: %ERRORLEVEL% ===
endlocal
