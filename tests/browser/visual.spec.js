import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
async function exported(page){const waiting=page.waitForEvent('download');await page.locator('#v-export').click();const d=await waiting;return JSON.parse(await readFile(await d.path(),'utf8'));}
test('visual memory learns rendered words, supports pause/step and tests without plasticity',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('[data-tab=vision]').click();await expect(page.locator('#v-slots')).toHaveText('0');
 await page.locator('#v-speed').selectOption('0.25');await page.locator('#v-train').click();await page.locator('#v-pause').click();
 const time=await page.locator('#v-clock').textContent();await page.waitForTimeout(100);await expect(page.locator('#v-clock')).toHaveText(time);
 await page.locator('#v-step').click();expect(await page.locator('#v-clock').textContent()).not.toBe(time);
 await page.locator('#v-speed').selectOption('4');await page.locator('#v-pause').click();await expect(page.locator('#v-train')).toBeEnabled({timeout:40000});
 await expect(page.locator('#v-progress')).toHaveText('24 / 24');const trained=await exported(page);
 expect(trained.records).toHaveLength(24);expect(trained.model.updates).toBeGreaterThan(0);expect(trained.evaluation.same.hits).toBeGreaterThanOrEqual(6);
 expect(trained.evaluation.same.falseAlarms).toBeLessThanOrEqual(2);expect(trained.evaluation.rows).toHaveLength(16);
 await page.screenshot({path:'/tmp/fruit-fly-visual-desktop.png',fullPage:true});
 await page.locator('#v-probe-word').selectOption('APPLE');await page.locator('#v-probe').click();await expect(page.locator('#v-probe-result')).toContainText('結合変化 0.000');
 const probed=await exported(page);expect(probed.model).toEqual(trained.model);expect(errors).toEqual([]);
 await page.locator('#v-reset').click();await expect(page.locator('#v-slots')).toHaveText('0');await expect(page.locator('#v-log tr')).toHaveCount(0);
});
test('no reward control has spikes but no memory and mobile fits',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('[data-tab=vision]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.locator('#v-reward').selectOption('off');await page.locator('#v-speed').selectOption('4');await page.locator('#v-train').click();
 await expect(page.locator('#v-train')).toBeEnabled({timeout:40000});const data=await exported(page);expect(data.model.memories).toHaveLength(0);expect(data.model.updates).toBe(0);expect(data.records.every(r=>r.spikes>0&&r.delta===0)).toBe(true);
 await page.screenshot({path:'/tmp/fruit-fly-visual-mobile.png',fullPage:true});
});
