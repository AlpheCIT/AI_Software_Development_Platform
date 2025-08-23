@echo off
echo 🚀 Creating AI Software Development Platform Directory Structure...

REM Create main application directories
mkdir "apps\web-dashboard\src\components" 2>nul
mkdir "apps\web-dashboard\src\pages" 2>nul
mkdir "apps\web-dashboard\src\hooks" 2>nul
mkdir "apps\web-dashboard\src\services" 2>nul
mkdir "apps\web-dashboard\public" 2>nul
mkdir "apps\vscode-extension\src" 2>nul
mkdir "apps\cli-tool\src" 2>nul
mkdir "apps\jupyter-notebooks\analysis" 2>nul
mkdir "apps\jupyter-notebooks\demos" 2>nul
mkdir "apps\jupyter-notebooks\migration" 2>nul

REM Create packages directories
mkdir "packages\core\entities" 2>nul
mkdir "packages\core\repositories" 2>nul
mkdir "packages\core\services" 2>nul
mkdir "packages\core\types" 2>nul
mkdir "packages\core\interfaces" 2>nul
mkdir "packages\core\use-cases" 2>nul

mkdir "packages\database\arango\collections" 2>nul
mkdir "packages\database\arango\queries" 2>nul
mkdir "packages\database\arango\indexes" 2>nul
mkdir "packages\database\migrations" 2>nul
mkdir "packages\database\seeds" 2>nul
mkdir "packages\database\schemas" 2>nul

mkdir "packages\ai-services\pattern-recognition" 2>nul
mkdir "packages\ai-services\security-analysis" 2>nul
mkdir "packages\ai-services\performance-analysis" 2>nul
mkdir "packages\ai-services\compliance-checker" 2>nul
mkdir "packages\ai-services\vector-similarity" 2>nul
mkdir "packages\ai-services\ml-models" 2>nul

mkdir "packages\agents\orchestrator" 2>nul
mkdir "packages\agents\security-expert" 2>nul
mkdir "packages\agents\performance-expert" 2>nul
mkdir "packages\agents\compliance-expert" 2>nul
mkdir "packages\agents\integration-manager" 2>nul
mkdir "packages\agents\base" 2>nul

mkdir "packages\parsers\multi-language\python" 2>nul
mkdir "packages\parsers\multi-language\javascript" 2>nul
mkdir "packages\parsers\multi-language\typescript" 2>nul
mkdir "packages\parsers\multi-language\java" 2>nul
mkdir "packages\parsers\multi-language\csharp" 2>nul
mkdir "packages\parsers\ast-analysis" 2>nul
mkdir "packages\parsers\metadata-extraction" 2>nul

mkdir "packages\integrations\github" 2>nul
mkdir "packages\integrations\jira" 2>nul
mkdir "packages\integrations\refact-ai" 2>nul
mkdir "packages\integrations\sonarqube" 2>nul
mkdir "packages\integrations\slack" 2>nul
mkdir "packages\integrations\webhooks" 2>nul

mkdir "packages\shared\config" 2>nul
mkdir "packages\shared\logging" 2>nul
mkdir "packages\shared\monitoring" 2>nul
mkdir "packages\shared\security" 2>nul
mkdir "packages\shared\validation" 2>nul
mkdir "packages\shared\utils" 2>nul
mkdir "packages\shared\constants" 2>nul

REM Create services directories
mkdir "services\api-gateway\src\graphql" 2>nul
mkdir "services\api-gateway\src\middleware" 2>nul
mkdir "services\repository-ingestion\src" 2>nul
mkdir "services\analysis-engine\src" 2>nul
mkdir "services\ai-orchestration\src" 2>nul
mkdir "services\notification\src" 2>nul
mkdir "services\websocket\src" 2>nul

REM Create infrastructure directories
mkdir "infrastructure\docker" 2>nul
mkdir "infrastructure\kubernetes" 2>nul
mkdir "infrastructure\terraform" 2>nul
mkdir "infrastructure\monitoring" 2>nul
mkdir "infrastructure\ci-cd" 2>nul

REM Create documentation directories
mkdir "docs\api" 2>nul
mkdir "docs\architecture" 2>nul
mkdir "docs\deployment" 2>nul
mkdir "docs\development" 2>nul
mkdir "docs\integrations" 2>nul
mkdir "docs\user-guides" 2>nul

REM Create testing directories
mkdir "tests\unit" 2>nul
mkdir "tests\integration" 2>nul
mkdir "tests\e2e" 2>nul
mkdir "tests\performance" 2>nul
mkdir "tests\fixtures" 2>nul

REM Create scripts directories
mkdir "scripts\setup" 2>nul
mkdir "scripts\migration" 2>nul
mkdir "scripts\deployment" 2>nul
mkdir "scripts\maintenance" 2>nul

REM Create config directories
mkdir "config\environments" 2>nul
mkdir "config\policies" 2>nul
mkdir "config\workflows" 2>nul

echo ✅ Directory structure created successfully!
echo.
echo 📁 Main directories:
echo   - apps/           (Application layer)
echo   - packages/       (Shared libraries & services)
echo   - services/       (Microservices)
echo   - infrastructure/ (DevOps & Infrastructure)
echo   - docs/           (Documentation)
echo   - tests/          (Testing framework)
echo   - scripts/        (Automation scripts)
echo   - config/         (Configuration files)
echo.
echo 🎯 Ready for AI Software Development Platform development!
