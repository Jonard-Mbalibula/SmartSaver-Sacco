# Simple Git Secret Scanner
Write-Host "Git History Secret Scanner" -ForegroundColor Cyan
Write-Host ""

# Check git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git not found" -ForegroundColor Red
    exit 1
}

if (!(Test-Path .git)) {
    Write-Host "ERROR: Not a git repository" -ForegroundColor Red
    exit 1
}

Write-Host "Scanning for Supabase keys..." -ForegroundColor Yellow

# Search for JWT tokens (Supabase keys)
$jwtResults = git log --all -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --oneline 2>$null

if ($jwtResults) {
    Write-Host ""
    Write-Host "WARNING: Potential Supabase keys found in history!" -ForegroundColor Red
    Write-Host "Commits:" -ForegroundColor Yellow
    $jwtResults | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "ACTION REQUIRED:" -ForegroundColor Red
    Write-Host "1. Rotate all Supabase keys immediately" -ForegroundColor Yellow
    Write-Host "2. Update .env files" -ForegroundColor Yellow
    Write-Host "3. Never commit secrets again" -ForegroundColor Yellow
    $foundSecrets = $true
}

# Check for .env files in git
Write-Host ""
Write-Host "Checking for .env files in git..." -ForegroundColor Yellow

$envInGit = git ls-files | Select-String "\.env" 2>$null

if ($envInGit) {
    Write-Host ""
    Write-Host "WARNING: .env files tracked in git!" -ForegroundColor Red
    $envInGit | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "ACTION REQUIRED:" -ForegroundColor Red
    Write-Host "1. Remove these files from git: git rm --cached .env*" -ForegroundColor Yellow
    Write-Host "2. Add to .gitignore" -ForegroundColor Yellow
    $foundSecrets = $true
}

# Check .gitignore
Write-Host ""
Write-Host "Checking .gitignore..." -ForegroundColor Yellow

if (Test-Path .gitignore) {
    $content = Get-Content .gitignore -Raw
    $hasEnv = $content -match "\.env"
    
    if ($hasEnv) {
        Write-Host "OK: .gitignore contains .env pattern" -ForegroundColor Green
    } else {
        Write-Host "WARNING: .gitignore missing .env pattern" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: No .gitignore file" -ForegroundColor Yellow
}

Write-Host ""
if ($foundSecrets) {
    Write-Host "SCAN COMPLETE: Secrets found!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "SCAN COMPLETE: No obvious secrets found" -ForegroundColor Green
    Write-Host "Recommendation: Use gitleaks for comprehensive scan" -ForegroundColor Gray
    exit 0
}
