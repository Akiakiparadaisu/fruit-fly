import {test,expect} from '@playwright/test';
test('demo trains, evaluates, simulates, exports and predicts unlabelled input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'デモデータで試す'}).click();
 await expect(page.locator('#data-summary')).toContainText('80 試行');
 await page.locator('#train').click();await expect(page.locator('#accuracy')).toHaveText('100.0%');
 await expect(page.locator('#test-count')).toHaveText('16');
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toBe('flylearn-model.json');
 await page.locator('#to-learn').click();const before=parseFloat(await page.locator('#sim-score').textContent());
 await page.locator('#step').click();expect(parseFloat(await page.locator('#sim-score').textContent())).toBeGreaterThan(before);
 await page.locator('#play').click();await expect.poll(async()=>Number(await page.locator('#sim-steps').textContent())).toBeGreaterThan(3);await page.locator('#play').click();
 await page.locator('#reset').click();await expect(page.locator('#sim-steps')).toHaveText('0');
 await page.locator('[data-tab=classify]').click();await expect(page.locator('#accuracy')).toHaveText('100.0%');
 let csv='trial,word,Fz,Cz,Pz\n';for(let i=0;i<128;i++)csv+=`new,example,${Math.sin(i*.38)},${Math.cos(i*.2)},${Math.sin(i*.53)}\n`;
 await page.locator('#predict-file').setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.locator('#predictions')).toContainText('1試行を分類');
 await page.screenshot({path:'/tmp/fruit-fly-desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('Cygnus preamble, marker scan, extraction and training in browser',async({page})=>{
 await page.goto('/');let csv='Cygnus version: 0.28.0.7,File version: 2021.11\nDevice sampling rate: 1000 samples/second\nTimestamp,Serial Number,Fp1,Fp2,Software Marker Name\n';
 for(let i=0;i<10000;i++){const y=Math.floor(i/1000)%2,marker=i%1000===200?`word_onset_${y?'known':'pseudo'}`:'';csv+=`${i/1000},${3000000+i},${80000+(y?4:1)*Math.sin(i*.06)},${30000+(y?1:4)*Math.sin(i*.15)},${marker}\n`;}
 await page.locator('#file').setInputFiles({name:'cygnus.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.locator('#mode')).toHaveValue('events');await page.locator('#scan').click();await expect(page.locator('#marker-list')).toContainText('word_onset_pseudo');
 await page.locator('#load').click();await expect(page.locator('#data-summary')).toContainText('10 試行');
 await page.locator('#train').click();await expect(page.locator('#test-count')).toHaveText('2');
 await page.locator('#to-learn').click();await page.screenshot({path:'/tmp/fruit-fly-learning.png',fullPage:true});
});
test('mobile navigation and invalid csv are usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'デモデータで試す'}).click();await expect(page.locator('#train')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'/tmp/fruit-fly-mobile.png',fullPage:true});
 await page.locator('#file').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('not a csv')});await expect(page.locator('#status')).toHaveClass(/error/);await expect(page.locator('#train')).toBeDisabled();
});
test('streams a CSV larger than 32 MiB without loading all rows into the model',async({page})=>{
 test.setTimeout(60000);
 const {writeFile,unlink}=await import('node:fs/promises');
 const path='/tmp/flylearn-large-test.csv';
 let chunks=['Cygnus version: 0.28.0.7,File version: 2021.11\nDevice sampling rate: 1000 samples/second\nTimestamp,Serial Number,Fp1,Fp2,T7,T8,O1,O2,Fz,Pz,Software Marker Name\n'];
 for(let i=0;i<400000;i++){const trial=Math.floor(i/20000),marker=i%20000===200?`word_onset_${trial%2?'known':'pseudo'}`:'';chunks.push(`${(i/1000).toFixed(3)},${3000000+i},83895.04,29786.11,35063.41,57110.05,51828.24,61998.96,84019.76,74812.59,${marker}\n`);}
 const text=chunks.join('');expect(Buffer.byteLength(text)).toBeGreaterThan(32*1024*1024);await writeFile(path,text);chunks=null;
 try{await page.goto('/');await page.locator('#file').setInputFiles(path);await expect(page.locator('#mode')).toHaveValue('events');await page.locator('#load').click();await expect(page.locator('#data-summary')).toContainText('20 試行',{timeout:30000});await expect(page.locator('#data-summary')).toContainText('400,000行');}finally{await unlink(path);}
});
