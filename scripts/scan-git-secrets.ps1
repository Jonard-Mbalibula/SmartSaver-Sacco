# Git History Secret Scanner for SmartSaver SACCO
# Scans entire git history for potentially committed secrets

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Git History Secret Scanner" -ForegroundColor Cyan
Write-Host "SmartSaver SACCO Security Audit" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is available
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if we're in a git repository
if (!(Test-Path .git)) {
    Write-Host "ERROR: Not a git repository" -ForegroundColor Red
    exit 1
}

Write-Host "Scanning git history for secrets..." -ForegroundColor Yellow
Write-Host ""

# Patterns to search for (regex)
$patterns = @{
    "Supabase Service Role Key" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    "Supabase Anon Key" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    "Database URL with credentials" = "postgresql://"
    "AWS Access Key" = "AKIA"
    "API Key pattern" = "api[-_]key"
    "Secret pattern" = "secret"
    "Password pattern" = "password.*="
    "Private Key Header" = "-----BEGIN.*PRIVATE KEY-----"
}

$findings = @()
$totalCommits = 0

# Search through all commits
Write-Host "Searching through commit history..." -ForegroundColor Yellow

foreach ($patternName in $patterns.Keys) {
    $pattern = $patterns[$patternName]
    Write-Host "  Checking for: $patternName" -ForegroundColor Gray
    
    # Use git log to search for pattern in all files
    $results = git log --all --full-history -S $pattern --source --oneline 2>$null
    
    if ($results) {
        foreach ($line in $results) {
            $findings += [PSCustomObject]@{
                Type = $patternName
                Commit = $line
            }
        }
    }
}

# Also check for files that might contain secrets
Write-Host ""
Write-Host "Checking for suspicious files in history..." -ForegroundColor Yellow

$suspiciousFiles = @(
    ".env.local",
    ".env.production",
    ".env",
    "*.pem",
    "*.key",
    "*credentials*",
    "*secret*"
)

foreach ($filePattern in $suspiciousFiles) {
    Write-Host "  Checking for: $filePattern" -ForegroundColor Gray
    
    $results = git log --all --full-history --name-only --pretty=format:"%H %s" -- $filePattern 2>$null
    
    if ($results) {
        foreach ($line in $results) {
            if ($line -match "^[0-9a-f]{40}") {
                $findings += [PSCustomObject]@{
                    Type = "Suspicious File: $filePattern"
                    Commit = $line
                }
            }
        }
    }
}

# Report findings
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SCAN RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "✓ No obvious secrets found in git history" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: This is a basic scan. Consider using specialized tools like:" -ForegroundColor Yellow
    Write-Host "  - gitleaks (https://github.com/gitleaks/gitleaks)" -ForegroundColor Gray
    Write-Host "  - truffleHog (https://github.com/trufflesecurity/trufflehog)" -ForegroundColor Gray
    Write-Host "  - git-secrets (https://github.com/awslabs/git-secrets)" -ForegroundColor Gray
} else {
    Write-Host "⚠ POTENTIAL SECRETS FOUND: $($findings.Count)" -ForegroundColor Red
    Write-Host ""
    Write-Host "The following commits may contain sensitive information:" -ForegroundColor Yellow
    Write-Host ""
    
    $findings | Group-Object Type | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Count) occurrence(s)" -ForegroundColor Yellow
        foreach ($finding in $_.Group) {
            Write-Host "    - $($finding.Commit)" -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "RECOMMENDED ACTIONS:" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "1. Review each commit listed above" -ForegroundColor Yellow
    Write-Host "2. If secrets are found, assume they are COMPROMISED" -ForegroundColor Yellow
    Write-Host "3. Rotate ALL affected secrets immediately:" -ForegroundColor Yellow
    Write-Host "   - Generate new Supabase service role key" -ForegroundColor Gray
    Write-Host "   - Generate new API keys" -ForegroundColor Gray
    Write-Host "   - Update passwords" -ForegroundColor Gray
    Write-Host "4. Update environment variables everywhere" -ForegroundColor Yellow
    Write-Host "5. Consider using BFG Repo-Cleaner or git-filter-repo to remove secrets" -ForegroundColor Yellow
    Write-Host "6. Add pre-commit hooks to prevent future leaks" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠ WARNING: Simply deleting secrets from latest commit does NOT remove them from history!" -ForegroundColor Red
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ADDITIONAL CHECKS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check current .env files
Write-Host "Checking current .env files..." -ForegroundColor Yellow

$envFiles = Get-ChildItem -Path . -Filter ".env*" -File -ErrorAction SilentlyContinue

if ($envFiles) {
    foreach ($envFile in $envFiles) {
        $tracked = git ls-files $envFile.Name 2>$null
        if ($tracked) {
            Write-Host "  ⚠ WARNING: $($envFile.Name) is tracked by git!" -ForegroundColor Red
            Write-Host "    This file should be in .gitignore" -ForegroundColor Yellow
        } else {
            Write-Host "  ✓ $($envFile.Name) is not tracked (good)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  No .env files found in current directory" -ForegroundColor Gray
}

Write-Host ""

# Check .gitignore
Write-Host "Checking .gitignore..." -ForegroundColor Yellow

if (Test-Path .gitignore) {
    $gitignoreContent = Get-Content .gitignore -Raw
    
    $requiredPatterns = @(".env.local", ".env", "*.pem", "*.key")
    $missing = @()
    
    foreach ($pattern in $requiredPatterns) {
        if ($gitignoreContent -notmatch [regex]::Escape($pattern)) {
            $missing += $pattern
        }
    }
    
    if ($missing.Count -eq 0) {
        Write-Host "  ✓ .gitignore contains recommended patterns" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ .gitignore missing patterns:" -ForegroundColor Yellow
        foreach ($pattern in $missing) {
            Write-Host "    - $pattern" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ⚠ No .gitignore file found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Scan complete." -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($findings.Count -gt 0) {
    exit 1
} else {
    exit 0
}
