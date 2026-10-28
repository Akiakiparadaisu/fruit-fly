import {random} from './model.js';

export const TRAIN_WORDS=['APPLE','RIVER','MUSIC','CLOUD','STONE','LIGHT','FOREST','BIRD'];
export const NOVEL_WORDS=['MAPLE','RIDER','MAGIC','CROWN','STORE','NIGHT','FLOWER','FISH'];
export const WIDTH=128, HEIGHT=32, CELLS=384;
export const THRESHOLD=.72;
const norm=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0));
const cosine=(a,b)=>{const d=norm(a)*norm(b);return d?Math.max(0,a.reduce((s,v,i)=>s+v*b[i],0)/d):0;};

// Pixels only. No word strings, word IDs or test labels enter this model.
export function imageFeatures(rgba) {
  if(rgba.length!==WIDTH*HEIGHT*4)throw new Error('128×32 RGBA画像が必要です。');
  const ink=new Float64Array(64*16),edges=new Float64Array(64*16);
  for(let y=0;y<16;y++)for(let x=0;x<64;x++){
    let sum=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const k=((y*2+dy)*WIDTH+x*2+dx)*4;sum+=1-(rgba[k]+rgba[k+1]+rgba[k+2])/765;}
    ink[y*64+x]=sum/4;
  }
  for(let y=0;y<16;y++)for(let x=0;x<64;x++){const i=y*64+x;edges[i]=Math.abs(ink[i]-(x?ink[i-1]:0))+Math.abs(ink[i]-(y?ink[i-64]:0));}
  const features=Array.from(ink,(v,i)=>v+.5*edges[i]),n=norm(features);
  return {ink,edges,features:features.map(v=>n?v/n:0)};
}
export class VisualMemory {
  constructor(seed=73){
    const rng=random(seed);this.seed=seed;
    this.receptive=Array.from({length:128},()=>Array.from({length:48},()=>[Math.floor(rng()*1024),rng()<.5?-1:1]));
    this.connections=Array.from({length:CELLS},()=>Array.from({length:8},()=>[Math.floor(rng()*128),rng()<.5?-1:1]));
    this.memories=[];this.updates=0;this.begin(new Float64Array(WIDTH*HEIGHT*4).fill(255));
  }
  encode(rgba){
    const image=imageFeatures(rgba);
    const pn=this.receptive.map(c=>Math.max(0,c.reduce((s,[i,w])=>s+image.features[i]*w,0)));
    const raw=this.connections.map(c=>c.reduce((s,[i,w])=>s+pn[i]*w,0));
    const ranked=raw.map((v,i)=>[v,i]).sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
    const code=new Float64Array(CELLS),drive=new Float64Array(CELLS);
    if(norm(image.features)>0)for(const [v,i] of ranked.slice(0,32)){code[i]=1;drive[i]=1.7+Math.max(0,v)*.1;}
    return {image,pn,code,drive};
  }
  score(code){return this.memories.reduce((best,m)=>Math.max(best,cosine(code,m.weights)*m.strength),0);}
  predict(rgba){const e=this.encode(rgba);return this.score(e.code);}
  begin(rgba){
    Object.assign(this,this.encode(rgba));this.voltage=new Float64Array(CELLS);this.refractory=new Float64Array(CELLS);this.eligibility=new Float64Array(CELLS);this.spikes=[];this.trace=[];this.time=0;this.slot=-1;this.dopamine=0;this.delta=0;this.before=this.score(this.code);this.after=this.before;
  }
  step({stimulus=true,reward=false}={}){
    const dt=5;this.time+=dt;const fired=[];this.delta=0;this.dopamine=reward?1:0;
    for(let i=0;i<CELLS;i++){
      this.eligibility[i]*=Math.exp(-dt/100);
      if(this.refractory[i]>0){this.refractory[i]-=dt;continue;}
      this.voltage[i]+=(dt/20)*(-this.voltage[i]+(stimulus?this.drive[i]:0));
      if(this.voltage[i]>=1){this.voltage[i]=0;this.refractory[i]=10;this.eligibility[i]+=1;fired.push(i);this.spikes.push([this.time,i]);}
    }
    if(reward&&norm(this.eligibility)>0){
      if(this.slot<0){let best=.7;this.memories.forEach((m,i)=>{const s=cosine(this.eligibility,m.weights);if(s>best){best=s;this.slot=i;}});
        if(this.slot<0&&this.memories.length<32){this.slot=this.memories.length;this.memories.push({weights:new Float64Array(CELLS),strength:0});}
      }
      if(this.slot>=0){const m=this.memories[this.slot],peak=Math.max(...this.eligibility);
        for(let i=0;i<CELLS;i++){const change=.045*(this.eligibility[i]/peak-m.weights[i]);m.weights[i]+=change;this.delta+=Math.abs(change);}
        m.strength+=.045*(1-m.strength);this.updates++;
      }
    }
    this.after=this.score(this.code);this.trace.push({t:this.time,voltage:this.voltage[this.code.findIndex(v=>v>0)]||0,score:this.after,reward:this.dopamine,delta:this.delta,spikes:fired.length});
    return fired;
  }
  snapshot(){return {seed:this.seed,updates:this.updates,memories:this.memories.map(m=>({strength:m.strength,weights:Array.from(m.weights)}))};}
}
