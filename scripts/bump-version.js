#!/usr/bin/env node

/**
 * Version Bump Script for PantryPal
 *
 * Usage:
 *   npm run bump-version patch   # 1.3.0 -> 1.3.1
 *   npm run bump-version minor   # 1.3.0 -> 1.4.0
 *   npm run bump-version major   # 1.3.0 -> 2.0.0
 */

const fs = require('fs');
const path = require('path');

const BUMP_TYPES = ['major', 'minor', 'patch'];

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${type}. Use major, minor, or patch.`);
  }
}

function updateMobileVersion(newVersion) {
  const appJsonPath = path.join(__dirname, '../mobile/app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const oldVersion = appJson.expo.version;
  const oldBuildNumber = parseInt(appJson.expo.ios.buildNumber);

  appJson.expo.version = newVersion;
  appJson.expo.ios.buildNumber = String(oldBuildNumber + 1);

  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

  console.log(`📱 Mobile App:`);
  console.log(`   Version: ${oldVersion} -> ${newVersion}`);
  console.log(`   iOS Build Number: ${oldBuildNumber} -> ${oldBuildNumber + 1}`);
}

function updateWebVersion(newVersion) {
  const packageJsonPath = path.join(__dirname, '../services/web-ui/package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const oldVersion = packageJson.version;
  packageJson.version = newVersion;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`🌐 Web UI:`);
  console.log(`   Version: ${oldVersion} -> ${newVersion}`);
}

function updateRootPackageVersion(newVersion) {
  const packageJsonPath = path.join(__dirname, '../package.json');

  // Check if root package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  console.log(`📦 Root Package:`);
  console.log(`   Version: ${oldVersion} -> ${newVersion}`);
}

function main() {
  const bumpType = process.argv[2];

  if (!bumpType || !BUMP_TYPES.includes(bumpType)) {
    console.error('❌ Error: Please specify bump type (major, minor, or patch)');
    console.error('\nUsage:');
    console.error('  npm run bump-version patch   # 1.3.0 -> 1.3.1');
    console.error('  npm run bump-version minor   # 1.3.0 -> 1.4.0');
    console.error('  npm run bump-version major   # 1.3.0 -> 2.0.0');
    process.exit(1);
  }

  // Get current version from mobile app.json
  const appJsonPath = path.join(__dirname, '../mobile/app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const currentVersion = appJson.expo.version;

  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n🚀 Bumping version (${bumpType})...\n`);

  updateMobileVersion(newVersion);
  updateWebVersion(newVersion);
  updateRootPackageVersion(newVersion);

  console.log(`\n✅ All versions updated to ${newVersion}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review changes: git diff`);
  console.log(`   2. Commit changes: git add . && git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`   3. Build mobile: cd mobile && eas build --platform all --auto-submit`);
  console.log(`   4. Build Docker: docker-compose build && docker-compose up -d`);
  console.log(`   5. Push to Docker Hub: npm run docker:push\n`);
}

main();
