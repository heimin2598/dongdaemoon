$ErrorActionPreference = 'Stop'
$repo = 'C:\VSCODE\DONGDAEMOON'
$log  = Join-Path $repo '.auto-backup.log'

Set-Location $repo

$tempIndex = Join-Path $env:TEMP 'ddm-auto-backup-index'
if (Test-Path $tempIndex) { Remove-Item $tempIndex -Force }
$env:GIT_INDEX_FILE = $tempIndex

$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

try {
    & git read-tree HEAD 2>&1 | Out-Null
    & git add -A 2>&1 | Out-Null
    $tree = (& git write-tree).Trim()

    & git fetch origin auto-backup --quiet 2>$null
    $parent = (& git rev-parse refs/remotes/origin/auto-backup 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $parent) {
        $parent = (& git rev-parse HEAD).Trim()
    } else {
        $parent = $parent.Trim()
    }

    $msg = "auto-backup: $ts"
    $commit = ($msg | & git commit-tree $tree -p $parent).Trim()

    & git update-ref refs/heads/auto-backup $commit
    & git push origin auto-backup --force --quiet

    "[$ts] OK $commit" | Out-File -FilePath $log -Append -Encoding utf8
}
catch {
    "[$ts] ERROR $($_.Exception.Message)" | Out-File -FilePath $log -Append -Encoding utf8
    exit 1
}
finally {
    Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
    if (Test-Path $tempIndex) { Remove-Item $tempIndex -Force -ErrorAction SilentlyContinue }
}
