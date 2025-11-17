#!/usr/bin/env python3
"""
Unit tests for the migrate_staging.py script
"""

import unittest
import tempfile
import json
import os
from pathlib import Path
from unittest.mock import patch, mock_open, MagicMock
import sys

# Add the project root to the path so we can import migrate_staging
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import the migration script
import importlib.util
spec = importlib.util.spec_from_file_location("migrate_staging", project_root / "migrate_staging.py")
migrate_staging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate_staging)

StagingMigrator = migrate_staging.StagingMigrator
MigrationResult = migrate_staging.MigrationResult
ValidationResult = migrate_staging.ValidationResult


class TestStagingMigrator(unittest.TestCase):
    """Test cases for StagingMigrator class"""

    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = Path(tempfile.mkdtemp())
        self.staging_dir = self.temp_dir / 'STAGING'
        self.shared_dir = self.temp_dir / '@shared'

        # Create directories
        self.staging_dir.mkdir()
        self.shared_dir.mkdir()

        # Create a sample manifest
        self.manifest = {
            'source_paths': [
                {'path': '**/*.ts', 'destination': 'test-dest'}
            ],
            'import_replacements': [
                {'pattern': r'from ["\']\.\./types/([^"\']*)["\']', 'replacement': "from '@shared/types/\\1'"}
            ],
            'rpc_migrations': []
        }

        # Create a sample file in STAGING
        self.sample_file = self.staging_dir / 'test.ts'
        self.sample_file.write_text('// Sample TypeScript file\nimport { User } from \'../types/common\';')

        # Create types directory structure in @shared for import validation tests
        (self.shared_dir / 'types').mkdir()
        (self.shared_dir / 'types' / 'common.ts').write_text('export interface User {}')

    def tearDown(self):
        """Clean up test fixtures"""
        import shutil
        shutil.rmtree(self.temp_dir)

    @patch('pathlib.Path.cwd')
    def test_manifest_loading_json(self, mock_cwd):
        """Test loading manifest from JSON file"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))

        self.assertEqual(migrator.manifest, self.manifest)
        self.assertEqual(migrator.project_root, self.temp_dir)

    def test_manifest_validation_valid(self):
        """Test manifest validation with valid manifest"""
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        result = migrator.validate_manifest()

        self.assertTrue(result.passed)
        self.assertEqual(len(result.errors), 0)

    def test_manifest_validation_missing_keys(self):
        """Test manifest validation with missing required keys"""
        invalid_manifest = {'source_paths': []}  # Missing required keys
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(invalid_manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        result = migrator.validate_manifest()

        self.assertFalse(result.passed)
        self.assertGreater(len(result.errors), 0)
        self.assertIn('import_replacements', ' '.join(result.errors))

    @patch('pathlib.Path.cwd')
    def test_file_copying(self, mock_cwd):
        """Test deterministic file copying"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        results = migrator.copy_files_deterministically()

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].success)
        self.assertEqual(results[0].source_path, str(self.sample_file))

        # Check that file was copied to correct location
        expected_dest = self.shared_dir / 'test-dest' / 'test.ts'
        self.assertTrue(expected_dest.exists())
        self.assertEqual(expected_dest.read_text(), self.sample_file.read_text())

    @patch('pathlib.Path.cwd')
    def test_import_replacement(self, mock_cwd):
        """Test import path replacement"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))

        # First copy the file
        migrator.copy_files_deterministically()

        # Then update imports
        results = migrator.update_import_paths()

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].success)

        # Check that import was updated
        dest_file = self.shared_dir / 'test-dest' / 'test.ts'
        content = dest_file.read_text()
        self.assertIn("from '@shared/types/common'", content)
        self.assertNotIn("from '../types/common'", content)

    @patch('subprocess.run')
    def test_typescript_validation(self, mock_subprocess):
        """Test TypeScript validation"""
        # Mock successful tsc run
        mock_subprocess.return_value = MagicMock(returncode=0, stdout='', stderr='')

        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        result = migrator._validate_typescript()

        self.assertTrue(result.passed)
        mock_subprocess.assert_called_once()

    @patch('subprocess.run')
    def test_typescript_validation_failure(self, mock_subprocess):
        """Test TypeScript validation with errors"""
        # Mock failed tsc run with errors
        mock_subprocess.return_value = MagicMock(
            returncode=1,
            stdout='error1\ntsc: error TS123: Some error\nerror2',
            stderr=''
        )

        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        result = migrator._validate_typescript()

        self.assertFalse(result.passed)
        self.assertTrue(any('error TS123' in error for error in result.errors))

    @patch('pathlib.Path.cwd')
    def test_import_path_validation(self, mock_cwd):
        """Test import path validation"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))

        # Test valid import path
        self.assertTrue(migrator._import_path_exists('@shared/types/common', self.shared_dir / 'test.ts'))

        # Test invalid import path
        self.assertFalse(migrator._import_path_exists('@nonexistent/path', self.shared_dir / 'test.ts'))

    @patch('pathlib.Path.cwd')
    def test_migration_report_generation(self, mock_cwd):
        """Test migration report generation"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))
        report = migrator.generate_report()

        self.assertIn('summary', report)
        self.assertIn('details', report)
        self.assertIn('files_copied', report['summary'])
        self.assertIn('validation_results', report['details'])

    @patch('pathlib.Path.cwd')
    def test_database_pattern_detection(self, mock_cwd):
        """Test detection of database patterns in code"""
        mock_cwd.return_value = self.temp_dir
        manifest_path = self.temp_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f)

        migrator = StagingMigrator(str(manifest_path))

        # Code with database patterns
        db_code = """
        const result = await env.DB.prepare('SELECT * FROM users').all();
        await db.insertInto('logs').values({ message: 'test' });
        """

        self.assertTrue(migrator._contains_database_patterns(db_code))

        # Code without database patterns
        clean_code = """
        const user = { name: 'John', age: 30 };
        console.log('Hello world');
        """

        self.assertFalse(migrator._contains_database_patterns(clean_code))


if __name__ == '__main__':
    unittest.main()
