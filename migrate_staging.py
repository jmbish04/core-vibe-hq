#!/usr/bin/env python3
"""
Comprehensive Manifest-Driven Migration Script

Automates the migration of STAGING/ code into the @shared framework with:
- Deterministic file copying
- Import path updates
- AI-driven D1-to-RPC refactoring
- Automated validation

Usage:
    python migrate_staging.py --manifest migration_manifest.json
    python migrate_staging.py --manifest migration_manifest.yaml
"""

import json
import yaml
import os
import shutil
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class MigrationResult:
    """Result of a migration operation"""
    success: bool
    source_path: str
    dest_path: str
    operations: List[str]
    errors: List[str]

@dataclass
class ValidationResult:
    """Result of validation operation"""
    passed: bool
    component: str
    errors: List[str]
    warnings: List[str]

class StagingMigrator:
    """
    Comprehensive manifest-driven migration tool for STAGING/ to @shared framework
    """

    def __init__(self, manifest_path: str):
        self.manifest_path = Path(manifest_path)
        self.project_root = Path.cwd()

        # Load manifest
        self.manifest = self.load_manifest()

        # Initialize migration report
        self.migration_report = {
            'files_copied': [],
            'imports_updated': [],
            'rpc_migrations': [],
            'validation_results': {},
            'errors': []
        }

        # Setup paths
        self.staging_dir = self.project_root / 'STAGING'
        self.shared_dir = self.project_root / '@shared'

        logger.info(f"Initialized migrator with manifest: {manifest_path}")
        logger.info(f"Project root: {self.project_root}")
        logger.info(f"STAGING directory: {self.staging_dir}")
        logger.info(f"@shared directory: {self.shared_dir}")

    def load_manifest(self) -> Dict[str, Any]:
        """Load migration manifest from JSON or YAML file"""
        if not self.manifest_path.exists():
            raise FileNotFoundError(f"Manifest file not found: {self.manifest_path}")

        with open(self.manifest_path, 'r', encoding='utf-8') as f:
            if self.manifest_path.suffix.lower() in ['.yaml', '.yml']:
                return yaml.safe_load(f)
            else:
                return json.load(f)

    def validate_manifest(self) -> ValidationResult:
        """Validate the migration manifest structure"""
        errors = []
        warnings = []

        required_keys = ['source_paths', 'import_replacements', 'rpc_migrations']
        for key in required_keys:
            if key not in self.manifest:
                errors.append(f"Missing required key: {key}")

        # Validate source paths
        if 'source_paths' in self.manifest:
            for i, path_config in enumerate(self.manifest['source_paths']):
                if not isinstance(path_config, dict):
                    errors.append(f"source_paths[{i}]: Must be a dictionary")
                    continue

                if 'path' not in path_config:
                    errors.append(f"source_paths[{i}]: Missing 'path' key")
                if 'destination' not in path_config:
                    errors.append(f"source_paths[{i}]: Missing 'destination' key")

        # Validate import replacements
        if 'import_replacements' in self.manifest:
            for i, replacement in enumerate(self.manifest['import_replacements']):
                if not isinstance(replacement, dict):
                    errors.append(f"import_replacements[{i}]: Must be a dictionary")
                    continue

                if 'pattern' not in replacement:
                    errors.append(f"import_replacements[{i}]: Missing 'pattern' key")
                if 'replacement' not in replacement:
                    errors.append(f"import_replacements[{i}]: Missing 'replacement' key")

        return ValidationResult(
            passed=len(errors) == 0,
            component="manifest_validation",
            errors=errors,
            warnings=warnings
        )

    def copy_files_deterministically(self) -> List[MigrationResult]:
        """Copy files from STAGING to @shared according to manifest"""
        results = []

        for path_config in self.manifest.get('source_paths', []):
            source_pattern = path_config['path']
            destination_base = path_config['destination']

            # Find all matching files in STAGING
            staging_files = list(self.staging_dir.glob(source_pattern))
            if not staging_files:
                logger.warning(f"No files found matching pattern: {source_pattern}")
                continue

            for source_file in staging_files:
                if not source_file.is_file():
                    continue

                # Calculate relative path from STAGING
                relative_path = source_file.relative_to(self.staging_dir)

                # Construct destination path
                dest_file = self.shared_dir / destination_base / relative_path
                dest_file.parent.mkdir(parents=True, exist_ok=True)

                try:
                    # Copy file with metadata preservation
                    shutil.copy2(source_file, dest_file)
                    logger.info(f"Copied: {source_file} -> {dest_file}")

                    results.append(MigrationResult(
                        success=True,
                        source_path=str(source_file),
                        dest_path=str(dest_file),
                        operations=['copy'],
                        errors=[]
                    ))

                    self.migration_report['files_copied'].append({
                        'source': str(source_file),
                        'destination': str(dest_file)
                    })

                except Exception as e:
                    logger.error(f"Failed to copy {source_file}: {e}")
                    results.append(MigrationResult(
                        success=False,
                        source_path=str(source_file),
                        dest_path=str(dest_file),
                        operations=['copy'],
                        errors=[str(e)]
                    ))

        return results

    def update_import_paths(self) -> List[MigrationResult]:
        """Update import paths in copied files according to manifest"""
        results = []

        replacements = self.manifest.get('import_replacements', [])

        # Process all files in @shared that were just copied
        for file_info in self.migration_report['files_copied']:
            dest_path = Path(file_info['destination'])

            if not dest_path.exists() or dest_path.suffix not in ['.ts', '.tsx', '.js', '.jsx', '.py']:
                continue

            try:
                # Read file content
                with open(dest_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                original_content = content
                operations_performed = []

                # Apply import replacements
                for replacement in replacements:
                    pattern = replacement['pattern']
                    replacement_text = replacement['replacement']

                    if re.search(pattern, content):
                        content = re.sub(pattern, replacement_text, content)
                        operations_performed.append(f"import_replacement: {pattern} -> {replacement_text}")

                # Write back if changed
                if content != original_content:
                    with open(dest_path, 'w', encoding='utf-8') as f:
                        f.write(content)

                    logger.info(f"Updated imports in: {dest_path}")
                    results.append(MigrationResult(
                        success=True,
                        source_path=file_info['source'],
                        dest_path=str(dest_path),
                        operations=operations_performed,
                        errors=[]
                    ))

                    self.migration_report['imports_updated'].append({
                        'file': str(dest_path),
                        'operations': operations_performed
                    })

            except Exception as e:
                logger.error(f"Failed to update imports in {dest_path}: {e}")
                results.append(MigrationResult(
                    success=False,
                    source_path=file_info['source'],
                    dest_path=str(dest_path),
                    operations=['import_update'],
                    errors=[str(e)]
                ))

        return results

    def perform_ai_driven_rpc_migration(self) -> List[MigrationResult]:
        """Use AI to migrate D1/SQLite code to RPC calls"""
        results = []

        rpc_configs = self.manifest.get('rpc_migrations', [])

        for config in rpc_configs:
            file_pattern = config.get('file_pattern', '**/*.ts')
            ai_provider = config.get('ai_provider', 'openai')
            context_files = config.get('context_files', [])

            # Find files to migrate
            target_files = list(self.shared_dir.glob(file_pattern))

            for target_file in target_files:
                try:
                    # Read the file
                    with open(target_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Check if file contains D1/SQLite patterns
                    if self._contains_database_patterns(content):
                        logger.info(f"Migrating database code in: {target_file}")

                        # Perform AI-driven migration
                        migrated_content = self._migrate_with_ai(
                            content,
                            target_file,
                            ai_provider,
                            context_files
                        )

                        # Write back migrated content
                        with open(target_file, 'w', encoding='utf-8') as f:
                            f.write(migrated_content)

                        results.append(MigrationResult(
                            success=True,
                            source_path=str(target_file),
                            dest_path=str(target_file),
                            operations=['ai_rpc_migration'],
                            errors=[]
                        ))

                        self.migration_report['rpc_migrations'].append({
                            'file': str(target_file),
                            'ai_provider': ai_provider,
                            'context_files': context_files
                        })

                except Exception as e:
                    logger.error(f"Failed AI migration for {target_file}: {e}")
                    results.append(MigrationResult(
                        success=False,
                        source_path=str(target_file),
                        dest_path=str(target_file),
                        operations=['ai_rpc_migration'],
                        errors=[str(e)]
                    ))

        return results

    def _contains_database_patterns(self, content: str) -> bool:
        """Check if content contains D1/SQLite database patterns"""
        patterns = [
            r'\.prepare\(',
            r'CREATE TABLE',
            r'SELECT.*FROM',
            r'INSERT INTO',
            r'UPDATE.*SET',
            r'DELETE FROM',
            r'env\.DB',
            r'kysely',
            r'drizzle'
        ]

        return any(re.search(pattern, content, re.IGNORECASE) for pattern in patterns)

    def _migrate_with_ai(self, content: str, file_path: Path,
                        ai_provider: str, context_files: List[str]) -> str:
        """Use AI to migrate database code to RPC calls"""
        # This would integrate with AI providers to perform the migration
        # For now, return the content unchanged (placeholder implementation)
        logger.warning(f"AI migration not yet implemented for {file_path}")
        return content

    def validate_migration(self) -> List[ValidationResult]:
        """Run comprehensive validation on migrated code"""
        results = []

        # Validate TypeScript compilation
        ts_result = self._validate_typescript()
        results.append(ts_result)
        self.migration_report['validation_results']['typescript'] = {
            'passed': ts_result.passed,
            'errors': ts_result.errors
        }

        # Validate imports
        import_result = self._validate_imports()
        results.append(import_result)
        self.migration_report['validation_results']['imports'] = {
            'passed': import_result.passed,
            'errors': import_result.errors
        }

        # Validate RPC migrations
        rpc_result = self._validate_rpc_migrations()
        results.append(rpc_result)
        self.migration_report['validation_results']['rpc'] = {
            'passed': rpc_result.passed,
            'errors': rpc_result.errors
        }

        return results

    def _validate_typescript(self) -> ValidationResult:
        """Validate TypeScript compilation"""
        errors = []

        try:
            # Run tsc --noEmit in @shared directory
            result = subprocess.run(
                ['npx', 'tsc', '--noEmit', '--skipLibCheck'],
                cwd=self.shared_dir,
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode != 0:
                errors.extend(result.stdout.split('\n'))
                errors.extend(result.stderr.split('\n'))

        except subprocess.TimeoutExpired:
            errors.append("TypeScript validation timed out")
        except FileNotFoundError:
            errors.append("TypeScript compiler not found")

        return ValidationResult(
            passed=len(errors) == 0,
            component="typescript",
            errors=[e for e in errors if e.strip()],
            warnings=[]
        )

    def _validate_imports(self) -> ValidationResult:
        """Validate that all imports resolve correctly"""
        errors = []

        # Check for common import issues
        import_patterns = [
            (r'from\s+["\'](@shared/[^"\']*)["\']', "Invalid @shared import path"),
            (r'import\s+.*from\s+["\'](@shared/[^"\']*)["\']', "Invalid @shared import path"),
        ]

        for file_info in self.migration_report['files_copied']:
            dest_path = Path(file_info['destination'])

            if dest_path.suffix not in ['.ts', '.tsx', '.js', '.jsx']:
                continue

            try:
                with open(dest_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                for pattern, error_msg in import_patterns:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        # Check if the import path exists
                        import_path = match
                        if not self._import_path_exists(import_path, dest_path):
                            errors.append(f"{dest_path}: {error_msg} - {import_path}")

            except Exception as e:
                errors.append(f"Failed to validate imports in {dest_path}: {e}")

        return ValidationResult(
            passed=len(errors) == 0,
            component="imports",
            errors=errors,
            warnings=[]
        )

    def _import_path_exists(self, import_path: str, source_file: Path) -> bool:
        """Check if an import path exists"""
        # This is a simplified check - in practice you'd need a proper module resolver
        if import_path.startswith('@shared/'):
            relative_path = import_path[len('@shared/'):]
            target_path = self.shared_dir / relative_path

            # Check for .ts, .tsx, .js, .jsx files
            for ext in ['.ts', '.tsx', '.js', '.jsx']:
                if (target_path.with_suffix(ext)).exists():
                    return True
                if (target_path / 'index').with_suffix(ext).exists():
                    return True

        return False

    def _validate_rpc_migrations(self) -> ValidationResult:
        """Validate that RPC migrations were successful"""
        errors = []

        # Check that migrated files no longer contain direct database calls
        for migration_info in self.migration_report['rpc_migrations']:
            file_path = Path(migration_info['file'])

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                if self._contains_database_patterns(content):
                    errors.append(f"{file_path}: Still contains database patterns after migration")

            except Exception as e:
                errors.append(f"Failed to validate RPC migration in {file_path}: {e}")

        return ValidationResult(
            passed=len(errors) == 0,
            component="rpc_migrations",
            errors=errors,
            warnings=[]
        )

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive migration report"""
        return {
            'summary': {
                'files_copied': len(self.migration_report['files_copied']),
                'imports_updated': len(self.migration_report['imports_updated']),
                'rpc_migrations': len(self.migration_report['rpc_migrations']),
                'validation_passed': all(
                    result.get('passed', False)
                    for result in self.migration_report['validation_results'].values()
                ),
                'errors': len(self.migration_report['errors'])
            },
            'details': self.migration_report
        }

    def save_report(self, output_path: Optional[str] = None) -> None:
        """Save migration report to file"""
        if output_path is None:
            output_path = self.project_root / 'migration_report.json'

        report = self.generate_report()

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        logger.info(f"Migration report saved to: {output_path}")

    def migrate(self) -> bool:
        """Execute the complete migration process"""
        logger.info("Starting STAGING to @shared migration")

        # Validate manifest
        manifest_validation = self.validate_manifest()
        if not manifest_validation.passed:
            logger.error("Manifest validation failed:")
            for error in manifest_validation.errors:
                logger.error(f"  - {error}")
            return False

        # Step 1: Copy files
        logger.info("Step 1: Copying files...")
        copy_results = self.copy_files_deterministically()
        failed_copies = [r for r in copy_results if not r.success]
        if failed_copies:
            logger.error(f"Failed to copy {len(failed_copies)} files")
            return False

        # Step 2: Update imports
        logger.info("Step 2: Updating import paths...")
        import_results = self.update_import_paths()

        # Step 3: AI-driven RPC migration
        logger.info("Step 3: Performing AI-driven RPC migrations...")
        rpc_results = self.perform_ai_driven_rpc_migration()

        # Step 4: Validate migration
        logger.info("Step 4: Validating migration...")
        validation_results = self.validate_migration()

        # Generate and save report
        self.save_report()

        # Summary
        total_errors = sum(len(r.errors) for r in copy_results + import_results + rpc_results)
        total_errors += sum(len(v.errors) for v in validation_results)

        success = total_errors == 0
        logger.info(f"Migration {'completed successfully' if success else 'failed with errors'}")
        logger.info(f"Files copied: {len(copy_results)}")
        logger.info(f"Imports updated: {len(import_results)}")
        logger.info(f"RPC migrations: {len(rpc_results)}")
        logger.info(f"Total errors: {total_errors}")

        return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Comprehensive Manifest-Driven Migration Script"
    )
    parser.add_argument(
        '--manifest', '-m',
        required=True,
        help='Path to migration manifest (JSON or YAML)'
    )
    parser.add_argument(
        '--output', '-o',
        help='Output path for migration report'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Perform dry run without making changes'
    )

    args = parser.parse_args()

    try:
        migrator = StagingMigrator(args.manifest)

        if args.dry_run:
            logger.info("Performing dry run...")
            # TODO: Implement dry run logic
            logger.info("Dry run completed")
            return

        success = migrator.migrate()
        sys.exit(0 if success else 1)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
