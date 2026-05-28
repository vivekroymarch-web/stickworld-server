# Run this script to copy generated sprites into this folder
$artifactDir = 'C:\Users\Roy Home\.gemini\antigravity\brain\ef509d7f-1bd0-470c-98fd-20078f91e20c'
$destDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$files = @{
    'portal_1779977458516.png'     = 'portal.png'
    'crate_1779977483042.png'      = 'crate.png'
    'sign_1779977505828.png'       = 'sign.png'
    'trap_spikes_1779977525657.png' = 'trap_spikes.png'
    'trap_spring_1779977546455.png' = 'trap_spring.png'
    'trap_hole_1779977567293.png'  = 'trap_hole.png'
    'trap_arrow_1779977587028.png' = 'trap_arrow.png'
}

foreach ($src in $files.Keys) {
    $dst = $files[$src]
    Copy-Item "$artifactDir\$src" "$destDir\$dst" -Force
    Write-Host "Copied $dst"
}

Write-Host "`nDone! All 7 sprites copied to $destDir"
Get-ChildItem $destDir -Filter "*.png" | Select-Object Name, Length
