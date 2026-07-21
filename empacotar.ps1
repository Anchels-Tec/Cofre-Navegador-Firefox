# Empacota a extensao num .xpi VALIDO (entradas com barra normal, manifest na raiz).
# Uso: clique direito > Executar com PowerShell, ou:  powershell -ExecutionPolicy Bypass -File empacotar.ps1
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

$src = $PSScriptRoot
$xpi = Join-Path (Split-Path $src -Parent) 'cofre-navegador.xpi'
if (Test-Path $xpi) { Remove-Item $xpi -Force }

# arquivos a incluir (ignora o proprio xpi, o script e lixo de git/zip)
$ignorar = @('.xpi', '.zip')
$files = Get-ChildItem -Path $src -Recurse -File | Where-Object {
  ($ignorar -notcontains $_.Extension) -and ($_.Name -ne 'empacotar.ps1') -and ($_.FullName -notlike '*\.git\*')
}

$zip = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($src.Length + 1) -replace '\\', '/'   # <- barra normal (Firefox exige)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    Write-Host "  + $rel"
  }
} finally {
  $zip.Dispose()
}
Write-Host ""
Write-Host "OK -> $xpi  ($([math]::Round((Get-Item $xpi).Length/1KB,1)) KB)" -ForegroundColor Green
