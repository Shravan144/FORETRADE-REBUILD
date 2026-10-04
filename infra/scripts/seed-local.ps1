# Local seed script for ForeTrade
# Seeds Market Snapshots from real EXIM transactions and a complete Demo Workspace with real companies.

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ForeTrade Local Seeder (Phase 2 Data Seed)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "`n1. Seeding Market Snapshots from EXIM Transactions..." -ForegroundColor Yellow
python "$repoRoot\infra\scripts\seed_market_snapshots.py"

Write-Host "`n2. Seeding Demo Workspace from Real Buyer Dataset..." -ForegroundColor Yellow
python "$repoRoot\infra\scripts\seed_demo_workspace.py"

Write-Host "`nLocal seed completed successfully!" -ForegroundColor Green
Write-Host "Demo Credentials:" -ForegroundColor White
Write-Host "  Email:    demo@example.com" -ForegroundColor White
Write-Host "  Password: DemoPassword123!" -ForegroundColor White
