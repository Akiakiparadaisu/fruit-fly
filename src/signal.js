export const bands = [[1,4,'δ'],[4,8,'θ'],[8,13,'α'],[13,30,'β'],[30,45,'γ']];
export function signalFeatures(values, fs) {
  const n = values.length;
  if (n < 8) throw new Error('試行のサンプル数が不足しています。');
  const mean = values.reduce((a,b)=>a+b,0)/n;
  let covariance=0, variance=0;
  for(let i=0;i<n;i++){const t=i-(n-1)/2; covariance+=t*(values[i]-mean);variance+=t*t;}
  const slope=covariance/variance;
  const centered=values.map((v,i)=>v-mean-slope*(i-(n-1)/2));
  const std=Math.sqrt(centered.reduce((s,v)=>s+v*v,0)/n);
  const diff=centered.slice(1).reduce((s,v,i)=>s+Math.abs(v-centered[i]),0)/(n-1);
  let size=1; while(size<n)size*=2;
  const re=new Float64Array(size),im=new Float64Array(size);let energy=0;
  for(let i=0;i<n;i++){const w=.5-.5*Math.cos(2*Math.PI*i/(n-1));re[i]=centered[i]*w;energy+=w*w;}
  for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]];}
  for(let len=2;len<=size;len*=2){const a=-2*Math.PI/len;for(let i=0;i<size;i+=len){for(let j=0;j<len/2;j++){const c=Math.cos(a*j),s=Math.sin(a*j),k=i+j,l=k+len/2;const tr=re[l]*c-im[l]*s,ti=re[l]*s+im[l]*c;re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;}}}
  const powers=bands.map(([lo,hi])=>{let p=0;for(let k=1;k<size/2;k++){const f=k*fs/size;if(f>=lo&&f<hi)p+=2*(re[k]**2+im[k]**2)/(energy*size);}return Math.log10(p+1e-12);});
  return [std,diff,...powers];
}
export function createEventCollector(config) {
  const {channels,label,known,unknown,timestamp,fs,start,end}=config;
  if(!channels.length||channels.length>32)throw new Error('脳波列を1〜32列選択してください。');
  if(!label||!timestamp||!known||!unknown||known===unknown)throw new Error('マーカー列、時刻列、異なる既知・未知の値を指定してください。');
  if(channels.includes(label)||channels.includes(timestamp))throw new Error('マーカーと時刻は脳波列に含められません。');
  if(!(fs>=100&&fs<=10000&&start>=-10&&end>0&&end>start&&end-start>=.25&&end-start<=10&&end<=10))throw new Error('サンプリング周波数は100〜10,000 Hz、切り出しは−10〜10秒内・終了は0秒より後・長さ0.25〜10秒で指定してください。');
  const samples=[],preview=[];let rows=0,skipped=0,shortTrials=0,active=null,lastTime=-Infinity,trial=0,markers=0,invalid=0;
  const expected=Math.round((end-start)*fs);
  let history=[],head=0;
  function finishTrial(){
    if(!active)return;
    // Reject overlapping/incomplete epochs instead of silently changing their duration.
    if(active.bad||active.values[0].length<expected){shortTrials++;active=null;return;}
    if(samples.length>=50000)throw new Error('50,000試行の上限を超えました。ファイルを分割してください。');
    samples.push({x:active.values.flatMap(v=>signalFeatures(v,fs)),y:active.y,group:active.group,word:active.word});active=null;
  }
  function add(row){
    rows++;const raw=String(row[timestamp]??'').trim(),t=raw===''?NaN:Number(raw);
    if(!Number.isFinite(t)){skipped++;if(active)active.bad=true;return;}
    if(t<=lastTime)throw new Error('時刻が重複または逆転しています。時刻列（秒）を確認してください。');
    if(active&&t-lastTime>1.5/fs)active.bad=true;
    lastTime=t;
    const marker=String(row[label]??'').trim();
    if(active&&t>=active.onset+end-1e-7)finishTrial();
    while(head<history.length&&history[head].t<t+Math.min(start,0)-1e-7)head++;
    if(head>4096){history=history.slice(head);head=0;}
    if(marker===known||marker===unknown){
      finishTrial();markers++;active={onset:t,y:marker===known?1:0,group:`event-${++trial}`,word:`提示 ${trial} · ${t.toFixed(3)}s`,values:channels.map(()=>[]),bad:false};
      if(start<0){
        let previous=null;
        for(let j=head;j<history.length;j++){
          const h=history[j];
          if(h.bad||(previous!==null&&h.t-previous>1.5/fs))active.bad=true;
          channels.forEach((_,i)=>active.values[i].push(h.x[i]));previous=h.t;
        }
        if(previous===null||t-previous>1.5/fs||history[head].t>t+start+.5/fs)active.bad=true;
      }
    }
    if(active&&/^item\d+/i.test(marker)) active.word=marker;
    const x=channels.map(c=>String(row[c]??'').trim()).map(v=>v===''?NaN:Number(v));
    const bad=x.some(v=>!Number.isFinite(v)||Math.abs(v)>1e12);
    if(start<0)history.push({t,x,bad});
    if(bad){invalid++;if(active)active.bad=true;return;}
    if(preview.length<1000&&rows%Math.max(1,Math.round(fs/100))===0)preview.push([t,...x]);
    if(active&&t>=active.onset+start-1e-7&&t<active.onset+end-1e-7)channels.forEach((_,i)=>active.values[i].push(x[i]));
  }
  function finish(){finishTrial();if(!samples.length)throw new Error(`有効な試行がありません（一致マーカー${markers}件・不完全試行${shortTrials}件）。マーカー値、時刻列、切り出し範囲を確認してください。`);return {samples,rows,skipped:skipped+invalid,shortTrials,markers,preview,featureNames:channels.flatMap(c=>['std','meanAbsDiff',...bands.map(b=>`logPower${b[0]}-${b[1]}Hz`)].map(f=>`${c}:${f}`))};}
  return {add,finish};
}
