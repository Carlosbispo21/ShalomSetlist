import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [name, size] of [['icon-192.png',192], ['icon-512.png',512], ['apple-touch-icon.png',180]]) {
    const page = await browser.newPage({ viewport: { width:size,height:size }, deviceScaleFactor:1 });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.screenshot({ path: new URL(`../public/${name}`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1'), omitBackground:true });
    await page.close();
  }
  const densities = existsSync(new URL('../android/gradlew.bat',import.meta.url)) ? [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]] : [];
  for (const [density,size] of densities) {
    const dir = new URL(`../android/app/src/main/res/mipmap-${density}/`,import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
    await mkdir(dir,{recursive:true});
    const page = await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await page.setContent(`<style>html,body{margin:0;background:#20282a}svg{display:block;width:100%;height:100%}</style>${svg}`);
    await page.screenshot({path:`${dir}/ic_launcher.png`});
    await page.screenshot({path:`${dir}/ic_launcher_round.png`});
    await page.screenshot({path:`${dir}/ic_launcher_foreground.png`});
    await page.close();
  }
} finally { await browser.close(); }
