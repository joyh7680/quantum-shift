import { chromium } from '@playwright/test';
import { crossElectric } from './lab-electric-control.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
try {
 await page.goto('http://127.0.0.1:5177/');await page.getByRole('button',{name:/게임 시작/}).click();await page.waitForTimeout(1500);
 await page.evaluate(()=>{const s=window.__quantumGame.getState();s.patchLab({checkpoint:[8,0,-.6]});s.patch({respawn:s.respawn+1})});
 await page.waitForTimeout(1000);
 await crossElectric(page);
 console.log('ELECTRIC PASS',await page.evaluate(()=>({pos:window.__quantumGame.getState().pos,time:window.__quantumGame.getState().lab.time,deaths:window.__quantumGame.getState().lab.deaths})));
}catch(e){console.error(e);process.exitCode=1}finally{await browser.close()}
