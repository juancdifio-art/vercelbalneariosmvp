# Script de backup para el proyecto Paso a paso Balnearios
# Crea una copia de seguridad completa del proyecto

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$projectRoot = $PSScriptRoot
$backupFolder = Join-Path $projectRoot "backup"
$backupName = "backup_$timestamp"
$backupPath = Join-Path $backupFolder $backupName

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKUP - Paso a paso Balnearios" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Crear carpeta backup si no existe
if (-not (Test-Path $backupFolder)) {
    Write-Host "[1/4] Creando carpeta backup..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $backupFolder | Out-Null
    Write-Host "      OK Carpeta creada" -ForegroundColor Green
} else {
    Write-Host "[1/4] Carpeta backup ya existe" -ForegroundColor Green
}

# Crear carpeta de backup con timestamp
Write-Host "[2/4] Creando backup: $backupName" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupPath | Out-Null

# Copiar archivos (excluyendo node_modules, .git, y otros archivos temporales)
Write-Host "[3/4] Copiando archivos..." -ForegroundColor Yellow

$excludeDirs = @(
    "node_modules",
    ".git",
    "dist",
    "build",
    ".vscode",
    "backup"
)

$excludeFiles = @(
    "*.log",
    ".DS_Store",
    "Thumbs.db"
)

# Copiar frontend
Write-Host "      > Copiando frontend..." -ForegroundColor Gray
$frontendSource = Join-Path $projectRoot "frontend"
$frontendDest = Join-Path $backupPath "frontend"
robocopy $frontendSource $frontendDest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# Copiar backend
Write-Host "      > Copiando backend..." -ForegroundColor Gray
$backendSource = Join-Path $projectRoot "backend"
$backendDest = Join-Path $backupPath "backend"
robocopy $backendSource $backendDest /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# Copiar archivos raiz importantes
Write-Host "      > Copiando archivos raiz..." -ForegroundColor Gray
$rootFiles = @("README.md", "package.json", ".gitignore")
foreach ($file in $rootFiles) {
    $sourcePath = Join-Path $projectRoot $file
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath -Destination $backupPath -ErrorAction SilentlyContinue
    }
}

Write-Host "      OK Archivos copiados" -ForegroundColor Green

# Crear archivo de información del backup
Write-Host "[4/4] Creando archivo de información..." -ForegroundColor Yellow
$infoContent = @"
BACKUP INFORMACIÓN
==================

Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Proyecto: Paso a paso Balnearios
Versión: 1.0

CONTENIDO:
- Frontend (React + Vite)
- Backend (Node.js + Express + PostgreSQL)
- Configuraciones y archivos raíz

NOTAS:
- Este backup NO incluye node_modules (se pueden reinstalar con npm install)
- Este backup NO incluye la carpeta .git
- Los archivos .env están incluidos (contienen configuración sensible)

RESTAURACIÓN:
1. Copiar esta carpeta a la ubicación deseada
2. En frontend: npm install
3. En backend: npm install
4. Configurar base de datos según backend/.env
5. Iniciar servicios: npm run dev (en cada carpeta)

"@

$infoPath = Join-Path $backupPath "BACKUP_INFO.txt"
$infoContent | Out-File -FilePath $infoPath -Encoding UTF8

Write-Host "      OK Informacion guardada" -ForegroundColor Green
Write-Host ""

# Calcular tamaño del backup
$backupSize = (Get-ChildItem $backupPath -Recurse | Measure-Object -Property Length -Sum).Sum
$backupSizeMB = [math]::Round($backupSize / 1MB, 2)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OK BACKUP COMPLETADO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ubicacion: $backupPath" -ForegroundColor White
Write-Host "Tamano: $backupSizeMB MB" -ForegroundColor White
Write-Host ""
Write-Host "Para restaurar:" -ForegroundColor Yellow
Write-Host "  1. Copiar la carpeta a la ubicacion deseada" -ForegroundColor Gray
Write-Host "  2. Ejecutar npm install en frontend y backend" -ForegroundColor Gray
Write-Host "  3. Configurar base de datos" -ForegroundColor Gray
Write-Host ""

# Listar backups existentes
Write-Host "Backups disponibles:" -ForegroundColor Cyan
Get-ChildItem $backupFolder -Directory | Sort-Object Name -Descending | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($size / 1MB, 2)
    Write-Host "  - $($_.Name) - $sizeMB MB" -ForegroundColor Gray
}
Write-Host ""
