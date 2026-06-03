#!/usr/bin/env node
/**
 * Ondertekent active-win `main` in de .app zodat macOS TCC stabieler is (zelfde adhoc-sign als de app).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const product = context.packager.appInfo.productFilename;
  const appDir = path.join(context.appOutDir, `${product}.app`);
  const mainBin = path.join(
    appDir,
    'Contents/Resources/app.asar.unpacked/node_modules/active-win/main',
  );

  if (!fs.existsSync(mainBin)) {
    console.warn('[after-pack] active-win/main niet gevonden — overgeslagen');
    return;
  }

  try {
    execFileSync('codesign', ['--force', '--sign', '-', mainBin], { stdio: 'inherit' });
    console.log('[after-pack] codesign active-win/main OK');
  } catch (err) {
    console.warn('[after-pack] codesign active-win/main mislukt:', err.message);
  }
};
