import Papa from 'papaparse';
import { createCollector } from './data.js';
import { createEventCollector } from './signal.js';
import { stripPreamble } from './csv.js';
import { demoData, train } from './model.js';
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'train') {
      const result = train(data.samples, data.epochs, point => self.postMessage({ type: 'epoch', point }));
      self.postMessage({ type: 'trained', result }); return;
    }
    if (data.type === 'scan') {
      const counts = new Map(); let failed = false;
      Papa.parse(data.file, { beforeFirstChunk: stripPreamble, header: true, skipEmptyLines: 'greedy', encoding: data.encoding, chunkSize: 1024 * 1024,
        chunk(results, parser) {
          if (results.errors.length) { failed = true; parser.abort(); self.postMessage({type:'error',error:results.errors[0].message}); return; }
          for (const row of results.data) { const v=String(row[data.column]??'').trim(); if(v && (counts.has(v)||counts.size<500)) counts.set(v,(counts.get(v)||0)+1); }
          self.postMessage({type:'progress',rows:results.meta.cursor});
        },
        complete() { if(!failed)self.postMessage({type:'scanned',result:[...counts].sort((a,b)=>b[1]-a[1])}); },
        error(e) { self.postMessage({type:'error',error:e.message}); }
      }); return;
    }
    const collector = data.config.mode === 'events' ? createEventCollector(data.config) : createCollector(data.config);
    if (data.type === 'demo') {
      demoData().forEach(collector.add); self.postMessage({ type: 'loaded', result: collector.finish() }); return;
    }
    let failed = false;
    Papa.parse(data.file, {
      beforeFirstChunk: stripPreamble, header: true, skipEmptyLines: 'greedy', encoding: data.encoding, chunkSize: 1024 * 1024,
      chunk(results, parser) {
        try {
          if (results.errors.length) throw new Error(`CSVの形式エラー: ${results.errors[0].message}`);
          results.data.forEach(row => { if (data.type === 'predict' && data.config.mode !== 'events') row[data.config.label] = data.config.known; collector.add(row); });
          self.postMessage({ type: 'progress', rows: results.meta.cursor });
        } catch (e) { failed = true; parser.abort(); self.postMessage({ type: 'error', error: e.message }); }
      },
      complete() { if (!failed) { try { self.postMessage({ type: 'loaded', result: collector.finish() }); } catch (e) { self.postMessage({ type: 'error', error: e.message }); } } },
      error(e) { self.postMessage({ type: 'error', error: e.message }); }
    });
  } catch (e) { self.postMessage({ type: 'error', error: e.message }); }
};
