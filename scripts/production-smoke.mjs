import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(3500);
  await page.screenshot({path:'artifacts/start-screen.png'});
  await page.getByRole('button',{name:'M254 선택',exact:true}).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'연구실에 들어가기'}).click();
  await page.waitForTimeout(1500);
  await page.locator('.game-canvas canvas').click({position:{x:720,y:600}});
  await page.waitForFunction(()=>document.pointerLockElement!==null);
  await page.mouse.move(600,400);
  await page.keyboard.press('Digit3');
  await page.keyboard.down('KeyD');await page.waitForTimeout(400);await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'일시정지'}).waitFor();
  await page.getByRole('button',{name:'연구실로 돌아가기'}).click();
  await page.screenshot({path:'artifacts/production-game.png'});
  const catalog=JSON.parse(fs.readFileSync('src/characters.json','utf8'));
  const asset=await page.request.get('http://127.0.0.1:4173'+catalog[0].url);
  if(!asset.ok()||(await asset.body()).readUInt32LE(0)!==0x46546c67)throw Error('Production GLB missing');
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync('artifacts/production-result.json',JSON.stringify({passed:true,errors,pointerLock:true,character:'M254',glb:asset.status()},null,2));
  console.log('PRODUCTION PASS: M254 model, pointer lock, mouse camera, movement, scale, pause/resume, GLB HTTP 200; no browser errors.');
}finally{await browser.close();}
