import test from 'node:test';
import assert from 'node:assert/strict';
import Papa from 'papaparse';
import {createCollector} from '../src/data.js';
import {createEventCollector,signalFeatures} from '../src/signal.js';
import {stripPreamble} from '../src/csv.js';
import {demoData,train,MushroomBody,splitTrials} from '../src/model.js';
const config={channels:['Fz','Cz','Pz'],label:'label',known:'known',unknown:'unknown',trial:'trial',word:'word',mode:'raw'};
function demo(){const c=createCollector(config);demoData().forEach(c.add);return c.finish().samples;}
test('deterministic training separates synthetic classes on held-out trials',()=>{const samples=demo(),r=train(samples,30);assert.equal(r.trainCount,64);assert.equal(r.testCount,16);assert.ok(r.evaluation.accuracy>.9);assert.ok(r.history.at(-1).loss<r.history[0].loss);assert.deepEqual(r.model,train(samples,30).model);});
test('group split prevents leakage, including repeated feature rows',()=>{const s=demo().flatMap(s=>[s,{...s}]);const{train,test}=splitTrials(s);const ids=new Set(train.map(s=>s.group));assert.ok(test.every(s=>!ids.has(s.group)));});
test('scaler uses training partition only',()=>{const s=demo(),split=splitTrials(s),r=train(s,1);const expected=split.train.reduce((n,s)=>n+s.x[0],0)/split.train.length;assert.equal(r.model.mean[0],expected);});
test('learning simulation increases known score without mutating classifier',()=>{const r=train(demo(),20),m=MushroomBody.fromJSON(r.model),copy=MushroomBody.fromJSON(r.model),sample=r.test.find(s=>s.y===0),p=m.predict(sample.x),a=copy.encode(sample.x);for(let i=0;i<50;i++)copy.learn(a,1);assert.ok(copy.predict(sample.x)>p+.5);assert.equal(m.predict(sample.x),p);assert.ok(a.filter(Boolean).length<=26);});
test('rejects label leakage, insufficient class trials and invalid values',()=>{assert.throws(()=>createCollector({...config,channels:['label']}),/含め/);assert.throws(()=>splitTrials(demo().slice(0,4)),/5試行/);const c=createCollector(config);c.add({trial:'1',label:'known',Fz:'',Cz:'1',Pz:'2'});assert.throws(c.finish,/有効/);});
test('Cygnus preamble is skipped and exact word markers form epochs',()=>{const cfg={mode:'events',channels:['Fp1'],label:'Software Marker Name',known:'word_onset_known',unknown:'word_onset_pseudo',timestamp:'Timestamp',fs:1000,start:0,end:.6};const c=createEventCollector(cfg);let csv='Cygnus version: 0.28.0.7,File version: 2021.11\nDevice sampling rate: 1000 samples/second\nTimestamp,Fp1,Software Marker Name\n';for(let i=0;i<1500;i++){const marker=i===100?'word_onset_known':i===101?'item1_s1_known':i===800?'word_onset_pseudo':'';csv+=`${i/1000},${80000+Math.sin(i*.06)},${marker}\n`;}const parsed=Papa.parse(stripPreamble(csv),{header:true,skipEmptyLines:true});assert.equal(parsed.errors.length,0);parsed.data.forEach(c.add);const d=c.finish();assert.equal(d.samples.length,2);assert.deepEqual(d.samples.map(s=>s.y),[1,0]);assert.equal(d.samples[0].word,'item1_s1_known');assert.equal(d.featureNames.length,7);});
test('incomplete and overlapping epochs are excluded',()=>{const c=createEventCollector({channels:['x'],label:'marker',known:'k',unknown:'u',timestamp:'t',fs:1000,start:0,end:.6});for(let i=0;i<1000;i++)c.add({t:i/1000,x:1,marker:i===0?'k':i===200?'u':''});const d=c.finish();assert.equal(d.samples.length,1);assert.equal(d.shortTrials,1);assert.equal(d.samples[0].y,0);});
test('linear drift and DC do not alter band powers; alpha tone dominates alpha band',()=>{const x=Array.from({length:1000},(_,i)=>Math.sin(2*Math.PI*10*i/1000));const a=signalFeatures(x,1000),b=signalFeatures(x.map((v,i)=>v+80000+i*.2),1000);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<.01));assert.ok(a[4]>a[2]+2);assert.ok(a[4]>a[5]+2);});
test('missing samples and invalid time ordering are detected',()=>{const cfg={channels:['x'],label:'m',known:'k',unknown:'u',timestamp:'t',fs:1000,start:0,end:.6};const c=createEventCollector(cfg);c.add({t:0,x:1,m:'k'});assert.throws(()=>c.add({t:0,x:1,m:''}),/時刻/);const d=createEventCollector(cfg);for(let i=0;i<700;i++)if(i!==100)d.add({t:i/1000,x:1,m:i===0?'k':''});assert.throws(d.finish,/有効/);});
test('negative start includes 200 ms before onset and rejects missing pre-stimulus data',()=>{
 const cfg={channels:['x'],label:'m',known:'k',unknown:'u',timestamp:'t',fs:1000,start:-.2,end:.8};
 const c=createEventCollector(cfg),values=Array.from({length:2200},(_,i)=>80000+Math.sin(i*.07));
 for(let i=0;i<2200;i++)c.add({t:i/1000,x:values[i],m:i===100?'k':i===1200?'u':''});
 const d=c.finish();assert.equal(d.shortTrials,1);assert.equal(d.samples.length,1);assert.equal(d.samples[0].y,0);
 assert.deepEqual(d.samples[0].x,signalFeatures(values.slice(1000,2000),1000));
 const missing=createEventCollector(cfg);
 for(let i=0;i<1100;i++)if(i!==100)missing.add({t:i/1000,x:values[i],m:i===200?'k':''});
 assert.throws(missing.finish,/有効/);
});
