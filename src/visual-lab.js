import {VisualMemory,TRAIN_WORDS,NOVEL_WORDS,WIDTH,HEIGHT,CELLS,THRESHOLD} from './visual-model.js';
import './visual.css';
const $=s=>document.querySelector(s);
const percent=v=>(v*100).toFixed(1)+'%';
const labelScore=v=>v>=THRESHOLD?'見覚えあり':'見覚えなし';
export function mountVisualLab(){
 const section=document.createElement('section');section.id='vision';section.className='tab-panel';section.hidden=true;
 section.innerHTML=`
 <div class="overview"><div><span class="pill">02 / VISUAL MEMORY</span><h2>単語を見せる。記憶が変わる瞬間を見る。</h2><p>脳波CSVは不要です。画面上の単語画像を入力し、繰り返し提示と学習信号で視覚的な記憶を形成します。</p></div><span class="simulation-badge">画像から学習 · 機能モデル</span></div>
 <div class="vision-controls card"><button id="v-train" class="button primary">▷ 8語を3周学習</button><button id="v-pause" class="button secondary" disabled>Ⅱ 一時停止</button><button id="v-step" class="button secondary" disabled>20 ms進める</button><label>再生速度<select id="v-speed"><option value="0.25">0.25× ゆっくり</option><option value="1" selected>1×</option><option value="4">4×</option></select></label><label>学習信号<select id="v-reward"><option value="on">あり</option><option value="off">なし（対照実験）</option></select></label><button id="v-reset" class="button secondary">記憶を初期化</button><button id="v-export" class="button secondary">↓ 実験を保存</button></div>
 <div id="v-status" class="status" role="status" aria-live="polite">準備完了。学習前のモデルには記憶がありません。</div>
 <div class="vision-stage"><div class="vision-stage-head"><div><span class="live-dot"></span> VISUAL MEMORY CIRCUIT <small>模式的な配置 / 計算中の状態</small></div><span id="v-clock">0 ms / 650 ms</span></div>
 <div class="vision-live"><div class="stimulus-panel"><span class="vision-label">DISPLAY → PIXELS</span><canvas id="v-screen" width="128" height="32" role="img" aria-label="モデルが見る単語の画像"></canvas><div id="v-word">APPLE</div><div class="retina-row"><canvas id="v-retina" width="64" height="16" role="img" aria-label="縮小した網膜入力"></canvas><canvas id="v-edges" width="64" height="16" role="img" aria-label="画像のエッジ特徴"></canvas></div><div class="retina-labels"><span>明暗</span><span>エッジ</span></div><p>128 × 32 px → 明暗・輪郭<br>文字列・単語IDはモデルに渡しません。</p><div class="phase-list"><span data-phase="fixation">01 注視</span><span data-phase="stimulus">02 視覚入力・発火</span><span data-phase="plasticity">03 学習信号・結合更新</span><span data-phase="rest">04 休止</span></div></div>
 <div class="circuit-panel"><canvas id="v-circuit" height="350" role="img" aria-label="視覚投射128ユニット、ケニオン細胞384個、記憶読み出しへの実際の活動"></canvas><div class="circuit-legend"><span><i class="cyan"></i>視覚投射 128</span><span><i class="green"></i>ケニオン細胞 384</span><span><i class="amber"></i>学習信号</span><span>線：実接続の一部</span></div></div></div>
 <div class="vision-metrics"><div>今回の提示<strong id="v-progress">0 / 24</strong></div><div>発火した細胞<strong id="v-active">0 / 384</strong></div><div>見覚えスコア <small>未校正</small><strong id="v-score">0.0%</strong></div><div>結合変化量 Σ|Δw|<strong id="v-delta">0.000</strong></div><div>記憶スロット<strong id="v-slots">0</strong></div></div></div>
 <div class="vision-plots"><section class="card"><div class="card-title"><h2>発火の時系列</h2><span class="subtle">SPIKE RASTER · ALL 384 CELLS</span></div><canvas id="v-raster" height="180" role="img" aria-label="実際の発火時刻と細胞番号"></canvas><p class="hint">横：モデル時刻（ms） / 縦：細胞番号。点は実際の発火イベント。橙の帯は学習信号の区間です。</p></section><section class="card"><div class="card-title"><h2>膜電位と記憶の変化</h2><span id="v-cell" class="subtle"></span></div><canvas id="v-trace" height="180" role="img" aria-label="代表細胞の膜電位、見覚えスコア、結合変化"></canvas><p class="hint"><span class="trace-cyan">青：代表KCの膜電位（閾値1）</span> / <span class="trace-green">緑：見覚えスコア</span>。発火後に膜電位がリセットされます。</p></section></div>
 <section class="card"><div class="card-title"><h2>記憶を支える結合</h2><span id="v-weight-info" class="subtle">KC → MEMORY READOUT</span></div><canvas id="v-weights" height="110" role="img" aria-label="各記憶スロットへの384個の結合強度"></canvas><p class="hint">横：KC 0〜383 / 縦：記憶スロット。明るいほど結合が強い状態です。スロットは画像由来の活動から割り当て、単語の正解IDを使いません。</p></section>
 <section class="card"><div class="card-title"><h2>繰り返し提示による記憶の強まり</h2></div><canvas id="v-learning-curve" height="170" role="img" aria-label="単語ごとの提示回数と見覚えスコア"></canvas><p class="hint">各線は学習語1語。横：その単語の提示回数 / 縦：提示後の見覚えスコア（0〜1）。破線は再認閾値0.72です。</p></section><div class="vision-bottom"><section class="card"><div class="card-title"><h2>自分で単語を見せる</h2></div><label>提示する単語<select id="v-probe-word">${[...TRAIN_WORDS,...NOVEL_WORDS].map(w=>`<option>${w}</option>`).join('')}</select></label><label>見た目<select id="v-font"><option value="sans">学習と同じ書体</option><option value="serif">未学習の書体（serif）</option></select></label><button id="v-probe" class="button secondary">画像を提示して再認する</button><p id="v-probe-result" class="hint">再認中は結合を更新しません。</p><details><summary>用意した単語セット</summary><p>学習語：${TRAIN_WORDS.join(' / ')}</p><p>未学習語：${NOVEL_WORDS.join(' / ')}</p><p>8語ずつの英単語。APPLE / MAPLE、LIGHT / NIGHTなど、文字の似た比較語を含みます。意味は学習しません。</p></details></section>
 <section class="card"><div class="card-title"><h2>学習前後の再認テスト</h2><button id="v-evaluate" class="button secondary">再評価</button></div><p class="hint">学習語8語＋未学習語8語。同じ画像の再認と、未学習の書体への汎化を分けて評価します。閾値は固定0.72。テスト時に学習しません。</p><div id="v-evaluation"></div><details><summary>16語のスコアを見る</summary><div id="v-test-table" class="table-scroll"></div></details></section></div>
 <section class="card"><div class="card-title"><h2>提示ごとの学習記録</h2></div><div class="table-scroll"><table><thead><tr><th>提示</th><th>単語</th><th>信号</th><th>学習前</th><th>学習後</th><th>Σ|Δw|</th></tr></thead><tbody id="v-log"></tbody></table></div></section>
 <details class="card vision-method"><summary>このモデルで「リアルに」観察できること・再現していないこと</summary><p>明暗・輪郭の画像処理 → 固定した視覚投射 → 上位32個の疎なKC活動 → 漏れ積分発火（LIF） → 活動の痕跡と学習信号による結合更新を計算しています。膜電位の時定数20 ms、不応期10 ms、活動痕跡の時定数100 ms、計算刻み5 ms。パラメータは説明用で、生体から同定した値ではありません。表示時刻も生物の学習速度の予測ではありません。</p><p>これはショウジョウバエの視覚学習・キノコ体に着想を得た小規模な機能モデルです。全脳コネクトーム、実際の細胞配置、実測スパイク、人間の言語理解を再現していません。記憶読み出しは人工的な連想記憶で、ハエが英語の意味を理解したことにはなりません。画面に示す発火・結合・スコアは計算結果です。信号伝搬の線は可視化用に間引いています。</p><p>学習信号は「この画像を記憶する」という外部のゲートです。信号を「なし」にして初期化から実行すると、発火しても結合が変わらない対照実験になります。記憶はこのページを開いている間だけ保持されます。</p></details>`;
 $('#about').before(section);
 let model=new VisualMemory(),queue=[],current=null,running=false,frame=0,last=0,accumulator=0,completed=0,records=[],evaluation=null,baseline=null,totalDelta=0,visible=false,stimulusImage=null;
 const screen=$('#v-screen'),ctx=screen.getContext('2d',{willReadFrequently:true});
 function image(word,font='sans'){
   const c=document.createElement('canvas');c.width=WIDTH;c.height=HEIGHT;const g=c.getContext('2d');
   g.fillStyle='#fff';g.fillRect(0,0,WIDTH,HEIGHT);g.fillStyle='#101820';g.font=`bold 21px ${font==='serif'?'serif':'sans-serif'}`;g.textAlign='center';g.textBaseline='middle';g.fillText(word,WIDTH/2,HEIGHT/2,120);return g.getImageData(0,0,WIDTH,HEIGHT);
 }
 function screenDraw(show){ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,HEIGHT);if(show&&stimulusImage)ctx.putImageData(stimulusImage,0,0);else{ctx.fillStyle='#657483';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText('+',64,21);}}
 function evaluate(){
   const rows=[...TRAIN_WORDS,...NOVEL_WORDS].map((word,i)=>({word,seen:i<8,same:model.predict(image(word).data),serif:model.predict(image(word,'serif').data)}));
   const summary=key=>({hits:rows.filter(r=>r.seen&&r[key]>=THRESHOLD).length,falseAlarms:rows.filter(r=>!r.seen&&r[key]>=THRESHOLD).length,accuracy:rows.filter(r=>(r[key]>=THRESHOLD)===r.seen).length/16});
   return {rows,same:summary('same'),serif:summary('serif')};
 }
 function renderEvaluation(){
   evaluation=evaluate();baseline??=evaluation;
   $('#v-evaluation').innerHTML=`<table><thead><tr><th>評価</th><th>学習前</th><th>現在</th></tr></thead><tbody><tr><td>同じ書体・正解率</td><td>${percent(baseline.same.accuracy)}</td><td>${percent(evaluation.same.accuracy)}</td></tr><tr><td>学習語の再認</td><td>${baseline.same.hits} / 8</td><td>${evaluation.same.hits} / 8</td></tr><tr><td>未学習語の誤再認</td><td>${baseline.same.falseAlarms} / 8</td><td>${evaluation.same.falseAlarms} / 8</td></tr><tr><td>別書体・正解率</td><td>${percent(baseline.serif.accuracy)}</td><td>${percent(evaluation.serif.accuracy)}</td></tr></tbody></table>`;
   $('#v-test-table').innerHTML=`<table><thead><tr><th>単語</th><th>学習対象</th><th>同じ書体</th><th>別書体</th></tr></thead><tbody>${evaluation.rows.map(r=>`<tr><td>${r.word}</td><td>${r.seen?'○':'—'}</td><td>${percent(r.same)}</td><td>${percent(r.serif)}</td></tr>`).join('')}</tbody></table>`;
 }
 function controls(){const occupied=!!current;$('#v-train').disabled=occupied;$('#v-probe').disabled=occupied;$('#v-evaluate').disabled=occupied;$('#v-pause').disabled=!occupied;$('#v-step').disabled=!occupied||running;$('#v-reward').disabled=occupied;$('#v-pause').textContent=running?'Ⅱ 一時停止':'▷ 再開';}
 function next(){
   current=queue.shift()||null;
   if(!current){running=false;renderEvaluation();$('#v-status').textContent='完了。再認テストで学習語と未学習語のスコアを比較できます。';controls();draw();return;}
   current.image=image(current.word,current.font);stimulusImage=current.image;model.begin(current.image.data);totalDelta=0;
   $('#v-word').textContent=current.word;$('#v-status').textContent=current.train?`${current.word} を提示します。${current.reward?'学習信号あり':'学習信号なし（対照）'}。`:`${current.word} を再認しています。記憶は更新しません。`;
   screenDraw(false);controls();draw();
 }
 function tick(){
   if(!current)return;
   const t=model.time,stimulus=t>=100&&t<500,reward=current.train&&current.reward&&t>=500&&t<600;
   model.step({stimulus,reward});totalDelta+=model.delta;
   if(model.time>=650){
     const row={word:current.word,train:current.train,reward:current.train&&current.reward,before:model.before,after:model.after,delta:totalDelta,spikes:model.spikes.length};
     records.push(row);if(current.train)completed++;
     $('#v-log').insertAdjacentHTML('afterbegin',`<tr><td>${records.length}</td><td>${row.word}</td><td>${row.reward?'あり':row.train?'なし':'再認'}</td><td>${percent(row.before)}</td><td>${percent(row.after)}</td><td>${row.delta.toFixed(3)}</td></tr>`);
     if(!current.train)$('#v-probe-result').textContent=`${row.word}：${labelScore(row.after)}（${percent(row.after)}）。再認のみ・結合変化 ${row.delta.toFixed(3)}。`;
     if(queue.length)next();else {current=null;running=false;renderEvaluation();$('#v-status').textContent=`完了。${completed}回の学習提示を記録しました。再認テストは結合を更新しません。`;controls();}
   }
 }
 function animate(now){frame=0;if(!running||!visible)return;if(!last)last=now;accumulator+=Math.min(100,now-last)*Number($('#v-speed').value);last=now;while(accumulator>=5&&running){tick();accumulator-=5;}draw();if(running)frame=requestAnimationFrame(animate);}
 function resume(){running=true;last=0;accumulator=0;controls();if(visible&&!frame)frame=requestAnimationFrame(animate);}
 function pause(){running=false;cancelAnimationFrame(frame);frame=0;last=0;controls();}
 $('#v-train').onclick=()=>{queue=Array.from({length:3},()=>TRAIN_WORDS).flat().map(word=>({word,font:'sans',train:true,reward:$('#v-reward').value==='on'}));completed=0;next();resume();};
 $('#v-probe').onclick=()=>{queue=[{word:$('#v-probe-word').value,font:$('#v-font').value,train:false,reward:false}];next();resume();};
 $('#v-pause').onclick=()=>running?pause():resume();
 $('#v-step').onclick=()=>{for(let i=0;i<4&&current;i++)tick();draw();};
 $('#v-reset').onclick=()=>{pause();model=new VisualMemory();queue=[];current=null;stimulusImage=null;records=[];completed=0;totalDelta=0;baseline=null;$('#v-log').innerHTML='';$('#v-word').textContent='APPLE';$('#v-probe-result').textContent='再認中は結合を更新しません。';$('#v-status').textContent='記憶を初期化しました。同じ乱数シードで再実験できます。';screenDraw(false);renderEvaluation();controls();draw();};
 $('#v-evaluate').onclick=renderEvaluation;
 $('#v-export').onclick=()=>{const data={format:'flylearn-visual-v1',model:model.snapshot(),trainWords:TRAIN_WORDS,novelWords:NOVEL_WORDS,threshold:THRESHOLD,records,baseline,evaluation:evaluate(),currentTrial:current?{word:current.word,time:model.time}:null,notes:'Pixel-input functional model. No connectome or semantic understanding. Font rendering is browser dependent.'};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='flylearn-visual-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function surface(id){const c=$(id),w=c.clientWidth;if(!w)return null;const h=Number(c.dataset.h||c.getAttribute('height'));c.dataset.h=h;const d=devicePixelRatio||1;c.width=w*d;c.height=h*d;c.style.height=h+'px';const g=c.getContext('2d');g.scale(d,d);return {g,w,h};}
 function dot(g,x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
 function circuit(){const s=surface('#v-circuit');if(!s)return;const{g,w,h}=s;
   const t=model.time,lit=t>=100&&t<510,spiked=new Set(model.spikes.filter(([time])=>t-time<25).map(([,i])=>i));
   const pnPos=i=>[w*.11+(i%8)*w*.018,65+Math.floor(i/8)*13];
   const kcPos=i=>{const side=i<192?-1:1,j=i%192,a=j*2.39996,r=Math.sqrt((j+.5)/192);return [w*.54+Math.cos(a)*r*w*.19, h/2+side*76+Math.sin(a)*r*65];};
   g.strokeStyle='#254755';g.lineWidth=1;for(const side of [-1,1]){g.beginPath();g.ellipse(w*.54,h/2+side*76,w*.21,74,0,0,Math.PI*2);g.stroke();}
   // Only actual PN→KC edges; show a stable subset to keep paths legible.
   for(let i=0;i<CELLS;i+=8){const [x,y]=kcPos(i);for(const [p] of model.connections[i].slice(0,2)){const [px,py]=pnPos(p);g.strokeStyle=lit&&model.code[i]?'#44b9c440':'#29465436';g.beginPath();g.moveTo(px,py);g.quadraticCurveTo(w*.3,h/2,x,y);g.stroke();}}
   for(let i=0;i<128;i++){const [x,y]=pnPos(i);dot(g,x,y,lit?2+Math.min(2,model.pn[i]*8):2,lit&&model.pn[i]>.03?'#63dae5':'#294c5c');}
   const count=Math.max(1,model.memories.length);for(let j=0;j<count;j++){const ox=w*.9,oy=65+j*(h-130)/Math.max(1,count-1),m=model.memories[j];
     if(m)for(let i=0;i<CELLS;i++){if(m.weights[i]<.15||!spiked.has(i))continue;const [x,y]=kcPos(i);g.strokeStyle=`rgba(95,230,183,${m.weights[i]*.35})`;g.lineWidth=.5+m.weights[i];g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(w*.8,y,ox,oy);g.stroke();}
     dot(g,ox,oy,6+(m?.strength||0)*5,m?'#5bdfb1':'#355461');g.fillStyle='#aec4cc';g.font='9px system-ui';g.fillText(String(j+1),ox+14,oy+3);
   }
   for(let i=0;i<CELLS;i++){const[x,y]=kcPos(i);if(spiked.has(i)){g.shadowBlur=12;g.shadowColor='#83ffd1';dot(g,x,y,3.2,'#b5ffe1');g.shadowBlur=0;}else dot(g,x,y,1.7+model.voltage[i],model.eligibility[i]>.1?'#35aa91':'#375568');}
   dot(g,w*.51,h/2,10,model.dopamine?'#ffc66b':'#685642');g.fillStyle=model.dopamine?'#ffd390':'#89969f';g.font='10px system-ui';g.textAlign='center';g.fillText(model.dopamine?'学習信号 ON':'学習信号',w*.51,h/2+25);
   g.fillStyle='#afc6cf';g.fillText('視覚投射',w*.17,34);g.fillText('疎な活動 / KC',w*.54,24);g.fillText('記憶読み出し',w*.88,34);
 }
 function axes(id){const s=surface(id);if(!s)return null;const {g,w,h}=s;g.strokeStyle='#e8edef';g.fillStyle='#8496a2';g.font='9px system-ui';for(let t=0;t<=600;t+=100){const x=28+t/650*(w-38);g.beginPath();g.moveTo(x,8);g.lineTo(x,h-24);g.stroke();g.fillText(t+'',x-5,h-7);}g.fillStyle='#f5c56c24';g.fillRect(28+500/650*(w-38),8,100/650*(w-38),h-32);return {...s,x:t=>28+t/650*(w-38),y:v=>h-24-v*(h-36)};}
 function plots(){let s=axes('#v-raster');if(s){const{g,x,y}=s;g.fillStyle='#138d7b';for(const[t,i]of model.spikes)g.fillRect(x(t),y(1-i/CELLS),2,2);g.fillStyle='#8193a0';g.fillText('0',2,15);g.fillText('383',0,s.h-24);}
   s=axes('#v-trace');if(s){const{g,x,y}=s;for(const[key,color]of [['voltage','#448bba'],['score','#149877']]){g.strokeStyle=color;g.lineWidth=1.6;g.beginPath();model.trace.forEach((p,i)=>i?g.lineTo(x(p.t),y(p[key])):g.moveTo(x(p.t),y(p[key])));g.stroke();}g.fillStyle='#8193a0';g.fillText('1',2,15);g.fillText('0',2,s.h-24);}
   s=surface('#v-weights');if(s){const{g,w,h}=s;g.fillStyle='#0f2536';g.fillRect(0,0,w,h);if(!model.memories.length){g.fillStyle='#8aa4b5';g.font='12px system-ui';g.fillText('まだ記憶結合がありません',18,h/2);}
     model.memories.forEach((m,j)=>{const rh=(h-16)/model.memories.length;g.fillStyle='#acc8cf';g.font='9px system-ui';g.fillText(String(j+1),5,8+j*rh+rh/2);m.weights.forEach((v,i)=>{g.fillStyle=`rgb(${20+v*75},${45+v*180},${60+v*120})`;g.fillRect(24+i*(w-30)/CELLS,8+j*rh,Math.ceil((w-30)/CELLS),Math.max(1,rh-2));});});}
 }
 function learningCurve(){
   const s=surface('#v-learning-curve');if(!s)return;const{g,w,h}=s;
   const series=TRAIN_WORDS.map(word=>records.filter(r=>r.train&&r.word===word).map(r=>r.after));
   const n=Math.max(3,...series.map(a=>a.length)),x=i=>32+i/n*(w-50),y=v=>h-28-v*(h-42);
   g.font='9px system-ui';g.fillStyle='#8193a0';g.strokeStyle='#e5ecee';
   for(let i=0;i<=4;i++){g.beginPath();g.moveTo(32,y(i/4));g.lineTo(w-18,y(i/4));g.stroke();g.fillText((i/4).toFixed(2),0,y(i/4)+3);}
   for(let i=0;i<=n;i++)g.fillText(String(i),x(i)-3,h-9);
   g.setLineDash([4,4]);g.strokeStyle='#b89c71';g.beginPath();g.moveTo(32,y(THRESHOLD));g.lineTo(w-18,y(THRESHOLD));g.stroke();g.setLineDash([]);
   series.forEach((values,j)=>{g.strokeStyle=`hsl(${155+j*23} 50% 45%)`;g.lineWidth=1.5;g.beginPath();g.moveTo(x(0),y(0));values.forEach((v,i)=>g.lineTo(x(i+1),y(v)));g.stroke();values.forEach((v,i)=>dot(g,x(i+1),y(v),2,`hsl(${155+j*23} 50% 45%)`));});
 }
 $('#v-weights').addEventListener('pointermove',event=>{const r=event.currentTarget.getBoundingClientRect(),i=Math.floor((event.clientX-r.left-24)/(r.width-30)*CELLS),j=Math.floor((event.clientY-r.top-8)/(r.height-16)*model.memories.length);const m=model.memories[j];if(m&&i>=0&&i<CELLS)$('#v-weight-info').textContent=`スロット ${j+1} / KC ${i} / w = ${m.weights[i].toFixed(4)}`;});
 function retina(){for(const[id,data]of [['#v-retina',model.image.ink],['#v-edges',model.image.edges]]){const c=$(id),g=c.getContext('2d'),im=g.createImageData(64,16);for(let i=0;i<data.length;i++){const v=Math.min(255,data[i]*255);im.data.set([v,v,v,255],i*4);}g.putImageData(im,0,0);}}
 function draw(){if(!visible)return;screenDraw((model.time>=100&&model.time<500)||(!current&&!!stimulusImage));$('#v-cell').textContent=`KC #${Math.max(0,model.code.findIndex(v=>v>0))}`;$('#v-clock').textContent=`${model.time} ms / 650 ms`;$('#v-progress').textContent=`${completed} / 24`;$('#v-active').textContent=`${new Set(model.spikes.map(([,i])=>i)).size} / ${CELLS}`;$('#v-score').textContent=percent(model.after);$('#v-delta').textContent=totalDelta.toFixed(3);$('#v-slots').textContent=model.memories.length;
   const phase=model.time<100?'fixation':model.time<500?'stimulus':model.time<600?'plasticity':'rest';section.querySelectorAll('[data-phase]').forEach(e=>e.classList.toggle('active',e.dataset.phase===phase));circuit();plots();retina();learningCurve();}
 screenDraw(false);renderEvaluation();
 window.addEventListener('resize',draw);
 return {show(value){visible=value;if(!value)pause();else requestAnimationFrame(draw);}};
}
