# 一鍵升版：同步 version.json / sw.js 的 BUILD_VERSION / index.html 的 APP_VERSION
#
# index.html 是由 ..\..\scripts\build_dashboard.py --public 產生的，
# 所以流程是：先寫 version.json → 重跑 build_dashboard → 再改 sw.js。
# 這樣 index.html 裡的 APP_VERSION 與 og:image 的 ?v= 都會自動帶到新版本。
#
# 用法：
#   .\scripts\bump-version.ps1
#   .\scripts\bump-version.ps1 -Notes "修正 XX"

param([string]$Notes = "內容更新")
$ErrorActionPreference = "Stop"

$pagesRoot = Split-Path -Parent $PSScriptRoot
$projRoot  = Split-Path -Parent $pagesRoot
$enc = New-Object System.Text.UTF8Encoding($false)
$today = Get-Date -Format "yyyy.MM.dd"

# 1) 算出新版本號（同一天就往上加序號）
$vp = Join-Path $pagesRoot "version.json"
$seq = 1
if (Test-Path $vp) {
    $old = (Get-Content $vp -Raw | ConvertFrom-Json).version
    if ($old -match "^$([regex]::Escape($today))-(\d+)$") { $seq = [int]$Matches[1] + 1 }
}
$ver = "$today-$seq"

# 2) 寫 version.json
[System.IO.File]::WriteAllText($vp, ([ordered]@{ version = $ver; notes = $Notes } | ConvertTo-Json), $enc)

# 3) 重新產生 index.html（會讀 version.json，帶入 APP_VERSION 與 og:image 的 ?v=）
Push-Location $projRoot
try {
    $env:PYTHONIOENCODING = "utf-8"
    python scripts/build_dashboard.py --public | Out-Null
    python scripts/build_dashboard.py | Out-Null   # 本機版一起更新
} finally { Pop-Location }

# 4) 改 sw.js 的 BUILD_VERSION（byte 一定要變，否則瀏覽器不會偵測到新版）
$swp = Join-Path $pagesRoot "sw.js"
$t = [System.IO.File]::ReadAllText($swp, [System.Text.Encoding]::UTF8)
$t = [regex]::Replace($t, "const BUILD_VERSION = '[^']*';", "const BUILD_VERSION = '$ver';")
[System.IO.File]::WriteAllText($swp, $t, $enc)

# 5) 驗證三處一致
$idx = [System.IO.File]::ReadAllText((Join-Path $pagesRoot "index.html"), [System.Text.Encoding]::UTF8)
$okIdx = $idx -match [regex]::Escape("var APP_VERSION = '$ver';")
$okSw  = $t   -match [regex]::Escape("const BUILD_VERSION = '$ver';")
Write-Host ""
Write-Host "版本 -> $ver"
Write-Host ("  version.json  ok")
Write-Host ("  sw.js         " + $(if ($okSw)  { "ok" } else { "⚠️ 沒對上" }))
Write-Host ("  index.html    " + $(if ($okIdx) { "ok" } else { "⚠️ 沒對上" }))
Write-Host ""
Write-Host "接著：git add -A; git commit -m 'chore: bump $ver'; git push"
