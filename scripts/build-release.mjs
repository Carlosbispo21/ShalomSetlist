import { execFileSync } from 'node:child_process';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const env = { ...process.env };
if (windows) {
  env.JAVA_HOME ||= 'C:\\Program Files\\Android\\Android Studio\\jbr';
  env.ANDROID_HOME ||= join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
}
env.GRADLE_USER_HOME ||= join(root, '.gradle-cache');
if (!env.JAVA_HOME || !env.ANDROID_HOME || !existsSync(env.JAVA_HOME) || !existsSync(env.ANDROID_HOME)) throw new Error('Configure JDK 21 e Android SDK no JAVA_HOME/ANDROID_HOME.');
let pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
let gradle = await readFile(join(root, 'android/app/build.gradle'), 'utf8');
if (process.argv.includes('--bump')) {
  const parts = pkg.version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n))) throw new Error('Versão inválida.');
  parts[2]++; pkg.version = parts.join('.');
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  lock.version = pkg.version; lock.packages[''].version = pkg.version;
  gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${pkg.version}"`)
    .replace(/versionCode (\d+)/, (_, code) => `versionCode ${Number(code) + 1}`);
  await writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(join(root, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  await writeFile(join(root, 'android/app/build.gradle'), gradle);
}
if (!gradle.includes(`versionName "${pkg.version}"`)) throw new Error('Versões do app e do Android precisam coincidir.');
function command(text, cwd = root) {
  execFileSync(windows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh', windows ? ['/d', '/s', '/c', text] : ['-c', text], { cwd, env, stdio: 'inherit', windowsHide: true });
}
command('npm test');
command('npm run build');
command('node scripts/check-legacy-syntax.mjs');
command('npm run test:e2e');
execFileSync(process.execPath, [join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android'], { cwd: root, env, stdio: 'inherit', windowsHide: true });
command(windows ? 'gradlew.bat assembleDebug --console=plain' : './gradlew assembleDebug --console=plain', join(root, 'android'));
await mkdir(join(root, 'artifacts'), { recursive: true });
await copyFile(join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), join(root, `artifacts/shalom-${pkg.version}-debug.apk`));
if (windows) execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Compress-Archive -Path dist\\* -DestinationPath artifacts\\shalom-web.zip -Force'], { cwd: root, stdio: 'inherit', windowsHide: true });
else command('cd dist && zip -qr ../artifacts/shalom-web.zip .');
console.log(`Versão ${pkg.version} preparada. Revise e envie o código ao GitHub antes de release:publish.`);
