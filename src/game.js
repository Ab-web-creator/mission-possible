// Game engine: state, movement, demons' AI, drawing, sound, screens.
// Data (levels, demons, texts, themes) lives in ./data/ — edit those for content changes.
import { BASE_FUSE, ETYPES, FAST_SPEED, FAST_TIME, ITEMS, MIN_FUSE, SPEED_MAX, SPEED_STEP } from './data/enemies.js';
import { INTRO } from './data/intros.js';
import { LEVEL23_NEW, LEVEL_MAPS } from './data/levels.js';
import { LORE, LORE_ORDER } from './data/lore.js';
import { BOSS_THEME, MEADOW_THEME, THEMES, themeFor, worldOf } from './data/themes.js';

(()=>{
let COLS=15,ROWS=13;const EMPTY=0,WALL=1,CRATE=2;
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const DLIST=[[0,-1],[0,1],[-1,0],[1,0]];
const FLAME_LIFE=0.55,FLAME_HOT=0.15;
const hot=(x,y)=>flameT[y][x]>FLAME_LIFE-FLAME_HOT;
const cv=document.getElementById('game');let ctx=cv.getContext('2d');
const stage=document.getElementById('stage');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const rand=n=>Math.floor(Math.random()*n);
const key=(x,y)=>x+','+y;


let S=32,DPR=1;
function widen(n){
  if(!grid||!flameT||n<=COLS)return;
  const old=COLS;
  for(let y=0;y<ROWS;y++){const row=grid[y];row.pop();
    for(let x=old-1;x<n-1;x++){let c=EMPTY;
      if(y===0||y===ROWS-1||(x%2===0&&y%2===0))c=WALL;
      else if(Math.random()<0.45)c=CRATE;
      else if(coins&&Math.random()<0.12){coins.add(key(x,y));coinsTotal++}
      row.push(c)}
    row.push(WALL)}
  const grow=(arr,mk)=>arr.map(r=>{const nr=mk();for(let i=0;i<old-1;i++)nr[i]=r[i];return nr});
  flameT=grow(flameT,()=>new Float32Array(n));flameD=grow(flameD,()=>new Uint8Array(n));
  flameK=grow(flameK,()=>new Array(n).fill('c'));danger=Array.from({length:ROWS},()=>new Uint8Array(n));
  COLS=n;
}
let camX=0;
function updateCamera(dt){
  const sw=stage.clientWidth-2*BD,bw=(COLS-2)*S;
  if(!grid||bw<=sw+1){if(camX!==0){camX=0;cv.style.transform=''}return}
  const [px]=rpos(player),target=Math.max(0,Math.min(bw-sw,(px-.5)*S-sw/2));
  camX=state==='play'&&dt>0?camX+(target-camX)*Math.min(1,dt*6):target;
  if(Math.abs(camX-target)<0.5)camX=target;
  cv.style.transform=`translateX(${-Math.round(camX)}px)`;
}
function resize(){
  const a=playArea();
  S=Math.max(12,Math.floor(Math.min((a.h-2*BD)/(ROWS-2),(a.w-SIDE_MIN-2*BD)/(COLS-2))));
  stage.style.width=(COLS-2)*S+2*BD+'px';
  DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1,1500/((COLS-2)*S)));
  cv.style.width=(COLS-2)*S+'px';cv.style.height=(ROWS-2)*S+'px';
  cv.width=(COLS-2)*S*DPR;cv.height=(ROWS-2)*S*DPR;
}
// The outer wall ring stays in the grid but is cropped from view; BD is the frame drawn instead.
const BD=7,SIDE_MIN=200,SIDE_PREF=320,APP=document.getElementById('app');
function playArea(){const cs=getComputedStyle(APP);const w=APP.clientWidth-18,h=APP.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);return{w,h}}
new ResizeObserver(resize).observe(APP);
function fitCols(){
  const r=stage.getBoundingClientRect();if(!r.width||!r.height)return 15;
  let c=Math.floor(r.width/(r.height/ROWS));if(c%2===0)c--;
  return Math.max(15,Math.min(31,c));
}
function fitRows(){
  const r=stage.getBoundingClientRect();if(!r.width||!r.height)return 13;
  let n=Math.floor(r.height/(r.width/COLS));if(n%2===0)n--;
  return Math.max(13,Math.min(35,n));
}
function heighten(n){
  if(!grid||!flameT||n<=ROWS)return;
  const old=ROWS;grid.pop();
  for(let y=old-1;y<n-1;y++){const row=[];
    for(let x=0;x<COLS;x++){let c=EMPTY;
      if(x===0||x===COLS-1||(x%2===0&&y%2===0))c=WALL;
      else if(Math.random()<0.45)c=CRATE;
      else if(coins&&Math.random()<0.12){coins.add(key(x,y));coinsTotal++}
      row.push(c)}
    grid.push(row)}
  grid.push(new Array(COLS).fill(WALL));
  const keep=(arr,mk)=>{const a=arr.slice(0,old-1);while(a.length<n)a.push(mk());return a};
  flameT=keep(flameT,()=>new Float32Array(COLS));flameD=keep(flameD,()=>new Uint8Array(COLS));
  flameK=keep(flameK,()=>new Array(COLS).fill('c'));danger=Array.from({length:n},()=>new Uint8Array(COLS));
  ROWS=n;
}
function bestFit(minC,minR,grow){
  const pa=playArea(),r={width:pa.w-SIDE_PREF,height:pa.h};if(r.width<=0||!r.height)return{c:Math.max(minC,15),r:Math.max(minR,13)};
  let best=null;
  const minT=grow?Math.max(20,Math.floor(Math.min(r.width/minC,r.height/minR))-1):Math.max(28,Math.min(r.width,r.height)/17);
  for(let c=minC;c<=31;c+=2)for(let n=minR;n<=Math.max(minR,31);n+=2){
    const t=Math.floor(Math.min(r.width/c,r.height/n));if(t<minT&&!(c===minC&&n===minR))continue;
    const cov=(t*c*t*n)/(r.width*r.height);
    if(!best||cov>best.cov+0.004||(Math.abs(cov-best.cov)<=0.004&&c*n<best.c*best.r))best={c,r:n,cov};
  }
  return best||{c:minC,r:minR};
}
const areaK=()=>1;

/* ---------- state ---------- */
let state='title',level=1,score=0,lives=3,best=0;
let flameD,grid,hidden,items,bombs,enemies,flameT,flameK,danger,exit,particles,player;
// How long a pickup lies on the floor once revealed; Light of Truth is short-lived.
const LIFE_OF={reveal:6},lifeOf=t=>LIFE_OF[t]||ITEM_LIFE;
const ITEM_LIFE=20,END_TIME=6,DEATH_TIME=4;
const BASE_BOMBS=5,MAX_BOMBS=8,BASE_FIRE=2,MAX_FIRE=4,MAX_HP=12,EXTRA_TIME=20,LETTERS=['G','R','A','C','E'];
let coins=new Set(),coinsTotal=0,extraT=0,extraUsed=false,extraBanner=0,endWait=0,letters=new Set();
let shake=0,grace=0,banner=0,clearT=0,clearBonus=0,time=0,last=0,openedSfx=false;
try{best=+localStorage.getItem('fusewarren-best')||0}catch(e){}

function makePlayer(){return{x:1,y:1,tx:1,ty:1,prog:0,moving:false,dx:0,dy:0,face:'down',
  bombs:BASE_BOMBS,fire:BASE_FIRE,speed:3.6,shield:0,hp:MAX_HP,hurtT:0,alive:true,deathT:0}}

function occ(o){return o.moving?(o.prog<0.5?[o.x,o.y]:[o.tx,o.ty]):[o.x,o.y]}
function rpos(o){return o.moving?[o.x+(o.tx-o.x)*o.prog,o.y+(o.ty-o.y)*o.prog]:[o.x,o.y]}
function bombAt(x,y){return bombs.find(b=>b.x===x&&b.y===y)}
function inB(x,y){return x>=0&&y>=0&&x<COLS&&y<ROWS}
function blocked(x,y,ghost){
  if(!inB(x,y))return true;const c=grid[y][x];
  if(c===WALL)return true; if(c===CRATE&&!ghost)return true;
  return false;
}

const isBoss=()=>level%10===0;
const bossK=()=>Math.min(4,Math.floor(level/10));
const lionHP=()=>Math.min(6,3+Math.floor((level-10)/10));
// Lamp hits each Death takes; some levels set their own (level 50: four Deaths, so fewer each).
const GIANT_HP_LEVEL={50:6};
// Levels whose Deaths sit at set map rows (top to bottom); half rows are fine since Deaths never move.
// Level 50: evenly spaced (8/3 rows apart), keeping the top and bottom rows free to walk.
const GIANT_ROWS={50:[2,2+8/3,2+16/3,10]};
function placeGiants(){const rows=GIANT_ROWS[level];if(!rows)return;
  enemies.filter(e=>e.type==='giant').sort((a,b)=>a.y-b.y).forEach((e,i)=>{if(rows[i]!==undefined)e.y=e.ty=rows[i]+1})}
const giantHP=()=>GIANT_HP_LEVEL[level]||Math.min(16,10+2*(bossK()-1));
const idolHP=()=>Math.min(11,5+2*(bossK()-1));
let spawnX=1,spawnY=1,bossMax=0;
function bossHPNow(){let h=0;for(const e of enemies)if(e.type==='lion'||e.type==='idol'||e.type==='giant')h+=Math.max(0,e.hp);return h}
function calcBossMax(){bossMax=0;for(const e of enemies){if(e.type==='giant')bossMax+=giantHP();if(e.type==='lion')bossMax+=lionHP();if(e.type==='idol')bossMax+=idolHP()}}
function lionCount(){return level%10===0?Math.min(5,level/10):0}
function roster(){
  if(level===1)return ['doubt','doubt'];
  if(level===2)return ['doubt','doubt','doubt','doubt'];
  const n=Math.min(Math.round((3+Math.floor((level-1)/4))*areaK()),9);
  const unlock={suspect:31,accuse:21,doubt:2,gloop:1,skitter:4,spitter:6,wisp:23,brute:22,lies:34,theft:29,greed:11,murder:41};
  const capFor=u=>level===u?1:level<=u+2?2:99;
  const cap={suspect:2,accuse:level===21?2:2,doubt:level<=4?1:2,gloop:99,skitter:level===4?1:2,spitter:level===6?1:level<=7?2:3,wisp:level===23?1:2,brute:level<=24?1:2,lies:1,theft:level===29?1:2,greed:level===11?1:2,murder:1};
  const weight={suspect:1,accuse:1,doubt:1,gloop:3,skitter:2,spitter:2,wisp:2,brute:1,lies:2,theft:2,greed:1,murder:1};
  const list=[],count={gloop:0,skitter:0,spitter:0,wisp:0,brute:0,lion:0,lies:0,theft:0,greed:0,murder:0};
  const add=t=>{list.push(t);count[t]=(count[t]||0)+1};
  const lions=lionCount();for(let i=0;i<lions;i++)add('lion');
  const goal=lions?Math.max(lions+2,n-lions):n;
  if(INTRO[level]&&INTRO[level].type!=='lion')add(INTRO[level].type);
  while(list.length<goal){
    const pool=[];
    for(const t in unlock)if(level>=unlock[t]&&(count[t]||0)<cap[t])for(let i=0;i<weight[t];i++)pool.push(t);
    add(pool[rand(pool.length)]);
  }
  return list;
}
function makeEnemy(type,x,y){const T=ETYPES[type];
  return{type,x,y,tx:x,ty:y,prog:0,moving:false,dx:0,dy:1,hp:T.hp,inv:0,
    speed:type==='greed'?T.speed:T.speed*(1+Math.min(Math.max(0,level-3),12)*0.0125),wob:Math.random()*6,dead:false,tpT:5+Math.random()*4,vanish:0,loot:[],lamps:0,coins:0,grow:0,fleeT:0,cd:type==='doubt'||type==='skitter'||type==='spitter'||type==='accuse'||type==='suspect'?0.5:1+Math.random()*2,windup:0,burst:0,burstT:0,shots:0,aim:[0,1],...(type==='lion'?{hp:lionHP()}:type==='idol'?{hp:idolHP()}:type==='giant'?{hp:giantHP(),gx:x,gy:y,cd:2.2,pat:0}:{})}}

const STONE_PATS=[
  (x,y)=>x%2===0&&y%2===0,
  (x,y)=>y%2===0&&(x+y)%4===0,
  (x,y)=>(y===3||y===7||y===11)?x%4!==1:(y===5||y===9)&&x%4===3,
  (x,y)=>(x===4||x===8||x===12)?y%4!==1:x%4===2&&y%4===0&&x>2&&x<14,
  (x,y)=>{for(const [cx,cy] of [[4,4],[12,4],[4,10],[12,10],[8,7]])if(Math.abs(x-cx)+Math.abs(y-cy)<=1&&(x===cx||y===cy))return true;return false},
  (x,y)=>{const d=Math.abs(x-8)+Math.abs(y-7);if(d===4)return x!==8&&y!==7;return d>5&&x%4===2&&y%4===2},
  (x,y)=>x%4>=2&&y%4>=2&&x<15&&y<13,
  (x,y)=>(x%4===2&&y%4===0)||(x%4===0&&y%4===2)];
const BOSS_PATS=[
  (x,y)=>((y===5||y===9)&&x%4>=2)||(y===7&&x%4===0)||((x===3||x===13)&&y===3),
  (x,y)=>(x===8&&y>=2&&y<=10&&y!==6)||(x%4===2&&y%4===3)||(y===9&&(x===4||x===12)),
  (x,y)=>(y===6&&x%4!==1)||(y>=8&&x%4>=2&&y%4<=1&&y<13)];
function stonesOK(){
  const seen=new Set(),st=[[1,1]];let open=0;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]!==WALL)open++;
  while(st.length){const [x,y]=st.pop(),k=x+','+y;if(seen.has(k)||!inB(x,y)||grid[y][x]===WALL)continue;seen.add(k);st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])}
  return seen.size===open;
}
function layStones(boss,gs){
  const pat=boss?BOSS_PATS[(bossK()-1)%BOSS_PATS.length]:STONE_PATS[level<=1?0:(level-1)%STONE_PATS.length];
  const mk=f=>{grid=[];for(let y=0;y<ROWS;y++){const row=[];for(let x=0;x<COLS;x++){
    const edge=x===0||y===0||x===COLS-1||y===ROWS-1,ring=x===1||y===1||x===COLS-2||y===ROWS-2;
    const nearG=(gs||[]).some(([gx,gy])=>Math.abs(x-gx)<=1.5&&Math.abs(y-gy)<=1.5);
    row.push(edge||(!ring&&!nearG&&f(x,y))?WALL:EMPTY)}grid.push(row)}};
  mk(pat);if(!stonesOK())mk(STONE_PATS[0]);
}
// Every boss level hides this set of pickups, in different crates each time it is played.
const BOSS_LOOT=['shield','shield','shield','heal','heal','heal','fullheal','fire','quick'];
// Pickups some levels always hide in a crate in the lower half of the board (level 20: a Shield and a Full health).
const LOWER_LOOT={20:['shield','fullheal']};
// Put these pickups into these crates at random, honouring LOWER_LOOT. Crates are [x,y] pairs.
function hideLoot(vals,cr){vals=[...vals];cr=[...cr].sort(()=>Math.random()-.5);const used=new Set();
  for(const t of LOWER_LOOT[level]||[]){const vi=vals.indexOf(t),c=cr.find(([x,y])=>y>(ROWS-1)/2&&!used.has(key(x,y)));
    if(vi<0||!c)continue;vals.splice(vi,1);used.add(key(c[0],c[1]));hidden[key(c[0],c[1])]=t}
  const rest=cr.filter(([x,y])=>!used.has(key(x,y)));vals.forEach((t,i)=>{if(rest[i])hidden[key(rest[i][0],rest[i][1])]=t})}
function genBoss(){
  const k=bossK();tunnels=[];
  if(LEVEL_MAPS[level]){spawnX=1;spawnY=1;genMap(LEVEL_MAPS[level]);hidden={};items={};exit={x:-1,y:-1,revealed:false};
    {const cr=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(grid[y][x]===CRATE)cr.push([x,y]);hideLoot(BOSS_LOOT,cr)}coinsTotal=coins.size;
    flameT=Array.from({length:ROWS},()=>new Float32Array(COLS));flameD=Array.from({length:ROWS},()=>new Uint8Array(COLS));
    flameK=Array.from({length:ROWS},()=>new Array(COLS).fill('c'));danger=Array.from({length:ROWS},()=>new Uint8Array(COLS));return}
  const gs=[];for(let i=0;i<k;i++)gs.push([1.5+(i+0.5)*(COLS-4)/k,2.5+(i%2)*1.5]);
  const first=level===10;if(first){gs[0]=[(COLS-1)/2,(ROWS-1)/2-0.8]}
  layStones(true,gs);
  if(first){grid=[];for(let y=0;y<ROWS;y++){const row=[];for(let x=0;x<COLS;x++){const edge=x===0||y===0||x===COLS-1||y===ROWS-1;
    const nearG=Math.abs(x-gs[0][0])<=1&&Math.abs(y-gs[0][1])<=1;row.push(edge||(!nearG&&x%2===0&&y%2===0)?WALL:EMPTY)}grid.push(row)}}
  hidden={};items={};exit={x:-1,y:-1,revealed:false};
  // level 10 has no map: put the boss pickups in crates on random free squares, away from the start and from Death
  {const sx=first?1:(COLS>>1),sy=ROWS-2,free=[];
   for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(grid[y][x]===EMPTY&&Math.abs(x-sx)+Math.abs(y-sy)>3&&!gs.some(([gx,gy])=>Math.abs(x-gx)<=2.2&&Math.abs(y-gy)<=2.2))free.push([x,y]);
   free.sort(()=>Math.random()-.5);BOSS_LOOT.forEach((t,i)=>{const c=free[i];if(c){grid[c[1]][c[0]]=CRATE;hidden[key(c[0],c[1])]=t}})}
  enemies=[];
  for(let i=0;i<k;i++){const [x,gy]=gs[i];const g=makeEnemy('giant',x,gy);g.cd=2.2+i*1.1;enemies.push(g)}
  spawnX=first?1:(COLS>>1);spawnY=ROWS-2;
  coins=new Set();coinsTotal=0;
  flameT=Array.from({length:ROWS},()=>new Float32Array(COLS));flameD=Array.from({length:ROWS},()=>new Uint8Array(COLS));
  flameK=Array.from({length:ROWS},()=>new Array(COLS).fill('c'));
  danger=Array.from({length:ROWS},()=>new Uint8Array(COLS));
}
function genMap(rows){
  grid=[];for(let y=0;y<ROWS;y++){const row=[];for(let x=0;x<COLS;x++){const ch=(y>0&&y<ROWS-1&&x>0&&x<COLS-1)?rows[y-1][x-1]:'#';row.push(ch==='#'?WALL:ch==='c'?CRATE:EMPTY)}grid.push(row)}
  enemies=[];coins=new Set();tunnels=[];
  rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch==='M'||ch==='D')enemies.push(makeEnemy('doubt',x+1,y+1));if(ch==='A')enemies.push(makeEnemy('skitter',x+1,y+1));if(ch==='N')enemies.push(makeEnemy('spitter',x+1,y+1));if(ch==='P'){spawnX=x+1;spawnY=y+1}if(ch==='T')tunnels.push([x+1,y+1]);if(ch==='L')enemies.push(makeEnemy('lies',x+1,y+1));if(ch==='Z')enemies.push(makeEnemy('accuse',x+1,y+1));if(ch==='H')enemies.push(makeEnemy('brute',x+1,y+1));if(ch==='W')enemies.push(makeEnemy('suspect',x+1,y+1));if(ch==='K')enemies.push(makeEnemy('murder',x+1,y+1));if(ch==='Y')enemies.push(makeEnemy(LEVEL23_NEW,x+1,y+1));if(ch==='X'){const g=makeEnemy('giant',x+1,y+1);g.cd=2.2+enemies.filter(o=>o.type==='giant').length*1.3;enemies.push(g)}if(ch==='G')enemies.push(makeEnemy('greed',x+1,y+1));if(ch==='O')enemies.push(makeEnemy('gossip',x+1,y+1));if(ch==='E')enemies.push(makeEnemy('temper',x+1,y+1));if(ch==='V')enemies.push(makeEnemy('critic',x+1,y+1));if(ch==='$')coins.add(key(x+1,y+1))}));
}
function gen(){
  spawnX=1;spawnY=1;
  if(isBoss())return genBoss();
  const MAP=LEVEL_MAPS[level];tunnels=[];
  const dens=level===1?0.36:Math.min(0.42+level*0.02,0.62);
  if(MAP)genMap(MAP);else{layStones(false);
  for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(grid[y][x]===EMPTY&&x+y>3&&Math.random()<dens)grid[y][x]=CRATE;
  enemies=[];}const list=MAP?[]:roster(),n=list.length;let tries=0;
  while(enemies.length<n&&tries++<800){
    const x=1+rand(COLS-2),y=1+rand(ROWS-2);
    if(grid[y][x]===WALL||x+y<9||enemies.some(e=>e.x===x&&e.y===y)||(level===1&&(x+y<13||enemies.some(e=>Math.abs(e.x-x)+Math.abs(e.y-y)<7)))||(level===2&&(x+y<10||enemies.some(e=>Math.abs(e.x-x)+Math.abs(e.y-y)<4))))continue;
    grid[y][x]=EMPTY;
    if(!DLIST.some(([dx,dy])=>grid[y+dy][x+dx]===EMPTY)){
      const cr=DLIST.filter(([dx,dy])=>grid[y+dy][x+dx]===CRATE);
      if(cr.length){const [dx,dy]=cr[rand(cr.length)];grid[y+dy][x+dx]=EMPTY}
    }
    enemies.push(makeEnemy(list[enemies.length],x,y));
  }
  hidden={};items={};
  const crates=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]===CRATE)crates.push([x,y]);
  crates.sort(()=>Math.random()-.5);
  exit={x:-1,y:-1,revealed:false};
  const pool=['fire','fire','fire','fire','quick','quick','quick','bomb','bomb','speed','shield','heal','fullheal'];
  const count=Math.min(16,Math.max(Math.round((3+Math.ceil(level/2))*areaK()),Math.round(crates.length/6)));
  if(level===1){
    const dm=bfs(1,1,true),order=['bomb','fire','quick','speed','bomb','shield','fire','quick','heal','reveal'];
    const near=crates.slice().sort((a,b)=>dm[a[0]+a[1]*COLS]-dm[b[0]+b[1]*COLS]);
    order.forEach((t,i)=>{const c=near[Math.min(near.length-1,1+i*3)];if(c&&!hidden[key(c[0],c[1])])hidden[key(c[0],c[1])]=t});
    if(near[0])hidden[key(near[0][0],near[0][1])]='trumpet';// the Horn of Jericho waits in the crate closest to the Pilgrim
  }else
  {for(let i=0;i<count&&i<crates.length;i++){const [x,y]=crates[i];hidden[key(x,y)]=pool[rand(pool.length)]}
   if(crates.length>count+4){const [x,y]=crates[count+2+rand(Math.min(6,crates.length-count-3))];hidden[key(x,y)]='reveal'}
   if(Object.values(hidden).includes('reveal')){
     const need={speed:1+rand(2),shield:1};
     for(const t in need){let have=Object.values(hidden).filter(v=>v===t).length;
       for(const [x,y] of crates){if(have>=need[t])break;const k=key(x,y);if(!hidden[k]){hidden[k]=t;have++}}}}
   if(level>=TRUMPET_FROM&&Math.random()<TRUMPET_CHANCE){const fr=crates.filter(([x,y])=>!hidden[key(x,y)]);
     if(fr.length){const [x,y]=fr[rand(fr.length)];hidden[key(x,y)]='trumpet'}}}
  if(!MAP){coins=new Set();
  const free=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)
    if(grid[y][x]===EMPTY&&x+y>2&&!enemies.some(e=>e.x===x&&e.y===y))free.push(key(x,y));
  free.sort(()=>Math.random()-.5);
  for(const k of free.slice(0,Math.min(free.length,Math.round((12+level)*areaK()))))coins.add(k);}
  coinsTotal=coins.size;
  flameT=Array.from({length:ROWS},()=>new Float32Array(COLS));flameD=Array.from({length:ROWS},()=>new Uint8Array(COLS));
  flameK=Array.from({length:ROWS},()=>new Array(COLS).fill('c'));
  danger=Array.from({length:ROWS},()=>new Uint8Array(COLS));
}

let curLayout=null;
function layoutOf(){const [px,py]=occ(player);const it={};for(const k in items)it[k]=items[k].type==='letter'?'letter:'+items[k].letter:items[k].type;
  return{cols:COLS,rows:ROWS,g:grid.map(r=>r.join('')).join(''),hidden:{...hidden},en:enemies.map(e=>{const [x,y]=occ(e);return[e.type,x,y,e.hp]}),coins:[...coins],it,px,py,tun:tunnels.map(t=>[...t])}}
function applyLayout(L){
  COLS=L.cols;ROWS=L.rows||13;grid=[];for(let y=0;y<ROWS;y++)grid.push([...L.g.slice(y*COLS,(y+1)*COLS)].map(Number));
  hidden={};items={};exit={x:-1,y:-1,revealed:false};tunnels=(L.tun||[]).map(t=>[...t]);
  // same pickups, but shuffled into different crates, so a restart or a loaded save isn't a memory game
  {const cr=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]===CRATE)cr.push([x,y]);hideLoot(Object.values(L.hidden||{}),cr)}
  for(const k in (L.it||{})){const v=L.it[k];items[k]=v.startsWith('letter:')?{type:'letter',letter:v.slice(7),born:-9,life:15}:{type:v,born:-9,life:lifeOf(v)}}
  enemies=L.en.map(([t,x,y,hp])=>{const e=makeEnemy(t,x,y);if(hp)e.hp=hp;return e});coins=new Set(L.coins);coinsTotal=coins.size;
  flameT=Array.from({length:ROWS},()=>new Float32Array(COLS));flameD=Array.from({length:ROWS},()=>new Uint8Array(COLS));
  flameK=Array.from({length:ROWS},()=>new Array(COLS).fill('c'));
  danger=Array.from({length:ROWS},()=>new Uint8Array(COLS));
}
/* The live bits of a mid-level save: lit lamps, flames, melting crates, item timers and power-ups.
   Kept apart from the layout so restarting after a death still starts from a calm board. */
function momentOf(){const p=player,fl=[],il={};
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(flameT[y][x]>0)fl.push([x,y,+flameT[y][x].toFixed(3),flameK[y][x],flameD[y][x]]);
  for(const k in items)il[k]=+items[k].life.toFixed(2);
  return{bm:bombs.map(b=>[b.x,b.y,+b.t.toFixed(3),b.f,b.range,b.slide]),fl,ml:melts.map(m=>[m.x,m.y,+m.t.toFixed(3)]),il,
    shield:+p.shield.toFixed(2),shieldPick:!!p.shieldPick,fastT:+(p.fastT||0).toFixed(2),hurtT:+(p.hurtT||0).toFixed(2),face:p.face,extraT:+extraT.toFixed(2),extraUsed}}
function applyMoment(M){const p=player;
  bombs=(M.bm||[]).filter(([x,y])=>inB(x,y)).map(([x,y,t,f,range,slide])=>({x,y,t,f,range,slide:slide||null,sp:0}));
  for(const [x,y,t,k,d] of M.fl||[])if(inB(x,y)){flameT[y][x]=t;flameK[y][x]=k;flameD[y][x]=d}
  melts=(M.ml||[]).filter(([x,y])=>inB(x,y)).map(([x,y,t])=>({x,y,t}));
  for(const k in M.il||{})if(items[k])items[k].life=M.il[k];
  Object.assign(p,{shield:Math.max(2,M.shield||0),shieldPick:!!M.shieldPick,fastT:M.fastT||0,hurtT:M.hurtT||0,face:M.face||'down'});
  extraUsed=!!M.extraUsed;extraT=M.extraT||0;if(extraT>0)for(const e of enemies){e.letter=pickLetter();e.ltT=2.5}}
function startLevel(L,M){
  if(!jumped)markReached(level);
  trumpetWave=null;jFires=[];bombs=[];particles=[];shots=[];melts=[];coinFx=[];levelStartScore=score;
  if(L&&L.g)applyLayout(L);else{COLS=17;ROWS=15;gen()}
  placeGiants();
  const sx=L&&L.g&&L.px||spawnX,sy=L&&L.g&&L.py||spawnY;calcBossMax();
  Object.assign(player,{x:sx,y:sy,tx:sx,ty:sy,prog:0,moving:false,alive:true,deathT:0,face:'down',fastT:0,tpLock:false,stay:[],stayT:0,cheer:0});
  curLayout=L&&L.g?L:layoutOf();
  player.shield=Math.max(player.shield,2);
  const special=INTRO[level]||lionCount()||(level>1&&(level-1)%5===0);
  grace=special?2.6:1.3;banner=special?3.2:1.8;openedSfx=false;
  extraT=0;extraUsed=false;extraBanner=0;endWait=0;if(M&&L&&L.g)applyMoment(M);resize();
  hud();
}
const SAVE_KEY='fusewarren-save';
let savedFlash=0,playerName='';
try{playerName=localStorage.getItem('mp-name')||''}catch(e){}
function loadSave(){try{const v=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return v&&v.level?v:null}catch(e){return null}}
function writeSave(o){try{localStorage.setItem(SAVE_KEY,JSON.stringify(o));return true}catch(e){return false}}
const SLOTS_KEY='fusewarren-levels';
const LAYOUT_V=3;
try{if(!localStorage.getItem('mp-noauto')){const sl=JSON.parse(localStorage.getItem('fusewarren-levels')||'{}')||{};
  for(const k in sl)if(k[0]!=='m')delete sl[k];localStorage.setItem('fusewarren-levels',JSON.stringify(sl));localStorage.removeItem('fusewarren-save');localStorage.setItem('mp-noauto','1')}}catch(e){}
function loadSlots(){try{return JSON.parse(localStorage.getItem(SLOTS_KEY)||'{}')||{}}catch(e){return {}}}
// Highest level reached: the level picker only offers levels up to this one. Losing every life resets it to 1.
// Players from before this existed get it seeded from their saves and last picked level.
const REACH_KEY='mp-reached';
function reachedLevel(){
  let n=0;try{n=+localStorage.getItem(REACH_KEY)||0}catch(e){}
  if(!n){n=1;const sv=loadSave();if(sv)n=Math.max(n,sv.max||0,sv.level||0);
    for(const sl of Object.values(loadSlots()))n=Math.max(n,+sl.level||0);
    try{n=Math.max(n,+localStorage.getItem('mp-pick')||0);localStorage.setItem(REACH_KEY,n)}catch(e){}}
  return Math.min(50,Math.max(1,n));
}
function setReached(n){try{localStorage.setItem(REACH_KEY,n)}catch(e){}}
function markReached(n){if(n>reachedLevel())setReached(n)}
let jumped=false; // true while playing a run started with the L-N jump: it doesn't open levels in the picker
function snapshot(){return{level,score,lives,letters:[...letters],bombs:player.bombs,fire:player.fire,speed:player.speed,fuse:player.fuse||BASE_FUSE,hp:player.hp,layout:curLayout,v:LAYOUT_V,when:Date.now()}}
function saveProgress(){}
function saveProgressOld(){
  const sv=loadSave();let ok=writeSave({level,score,lives,letters:[...letters],bombs:player.bombs,fire:player.fire,speed:player.speed,hp:player.hp,
    max:Math.max(sv?sv.max||1:1,level)});
  const slots=loadSlots();slots[level]=snapshot();
  try{localStorage.setItem(SLOTS_KEY,JSON.stringify(slots))}catch(e){ok=false}
  if(ok){savedFlash=2.5;flashMsg='\u2713 PROGRESS SAVED'}renderSlots();
}
let flashMsg='';
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function saveNow(){
  if(state!=='play'||!player.alive){flashMsg='Can\u2019t save right now';savedFlash=2;return}
  curLayout=layoutOf();const snap={...snapshot(),mid:true,moment:momentOf()};
  audio();pause();
  const d=new Date(),def='Level '+level+' \u00b7 '+d.toLocaleDateString([], {day:'numeric',month:'short'})+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  showOverlay(`<h2>Save level ${level}</h2>
    <label class="sec" for="saveName">Name this save</label>
    <input id="saveName" type="text" maxlength="32" value="${esc(def)}" autocomplete="off">
    <p class="muted">Saves this moment: the board, lit lamps, power-ups, ${slotLine(snap)} and ${snap.score} points.</p>
    <div class="btns"><button class="go" id="saveOk" type="button">Save</button>
    <button class="go alt" id="saveCancel" type="button">Cancel</button></div>`);
  const inp=$('saveName');inp.focus();inp.select();
  const done=()=>{state='play';hideOverlay();last=0};
  const ok=()=>{const name=(inp.value.trim()||def).slice(0,32);
    const sv=loadSave();writeSave({level,score,lives,letters:[...letters],bombs:player.bombs,fire:player.fire,speed:player.speed,hp:player.hp,max:Math.max(sv?sv.max||1:1,level)});
    const slots=loadSlots();slots['m'+Date.now()]={...snap,name};
    try{localStorage.setItem(SLOTS_KEY,JSON.stringify(slots));flashMsg='\u2713 SAVED: '+name.toUpperCase();tone(880,0.08,'triangle',0.05);tone(1320,0.12,'triangle',0.05,0,0.08)}
    catch(e){flashMsg='Save failed: browser storage is full or blocked'}
    savedFlash=2.5;renderSlots();done()};
  $('saveOk').onclick=ok;$('saveCancel').onclick=done;
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();ok()}else if(e.key==='Escape'){e.preventDefault();done()}});
}
function slotKeys(slots){const ks=Object.keys(slots);
  const man=ks.filter(k=>k[0]==='m').sort((a,b)=>(slots[b].when||0)-(slots[a].when||0));
  const auto=ks.filter(k=>k[0]!=='m').sort((a,b)=>+b-+a);return man.concat(auto)}
function slotTitle(sl){return sl.name?esc(sl.name):'Level '+sl.level+(sl.mid?' <small>\u00b7 mid-level</small>':'')}
let met=new Set();try{met=new Set(JSON.parse(localStorage.getItem('mp-met')||'[]'))}catch(e){}
const iconCache={};
function itemIcon(t){
  if(iconCache[t])return iconCache[t];
  const size=64,c=document.createElement('canvas');c.width=c.height=size*2;const oc=ctx,oS=S,oT=time;
  try{ctx=c.getContext('2d');ctx.setTransform(2,0,0,2,0,0);S=size;time=0;drawItem('0,0',{type:t,life:99})}
  finally{ctx=oc;S=oS;time=oT}
  return iconCache[t]=c.toDataURL();
}
const portraitCache={};
function portrait(t){
  if(portraitCache[t])return portraitCache[t];
  const size=96,c=document.createElement('canvas');c.width=c.height=size*2;const oc=ctx,oS=S,oX=extraT;
  try{ctx=c.getContext('2d');ctx.setTransform(2,0,0,2,0,0);extraT=0;
    {S=t==='giant'?size/3.4:size/1.05;const e=makeEnemy(t,size/(2*S)-0.5,size/(2*S)-0.5);if(t==='greed')e.grow=1;e.sees=true;e.portrait=true;drawEnemy(e)}
  }finally{ctx=oc;S=oS;extraT=oX}
  return portraitCache[t]=c.toDataURL();
}
let introOpen=false,introAt=0,saveTipDue=false;const INTRO_MIN=1500;
function canSave(){try{localStorage.setItem('mp-test','1');localStorage.removeItem('mp-test');return true}catch(e){return false}}
function showIntroCard(col,kind,name,desc,wis,tip,img){
  const el=$('intro');el.style.setProperty('--c',col);
  const im=$('introImg');im.hidden=!img;if(img)im.src=img;$('introKind').textContent=kind;
  $('introName').textContent=name;$('introDesc').textContent=desc;const w=$('introWis');w.textContent=wis?'“'+wis+'”':'';w.hidden=!wis;const tp=$('introTip');tp.textContent=tip?'Tip: '+tip:'';tp.hidden=!tip;
  el.hidden=false;el.classList.remove('out');const hn=$('introHint');hn.style.animation='none';void hn.offsetWidth;hn.style.animation='';introOpen=true;stage.classList.add('dim');introAt=performance.now();held.length=0;
}
function showSaveTip(){
  saveTipDue=false;try{localStorage.setItem('mp-savetip','1')}catch(e){}
  showIntroCard('#6ee08a','Good to know','You can save your game','Press Save level any time while playing. Your saves appear under Saved levels on the right and on the start screen, so you can come back to them later.','','Saves stay in this browser on this device. Clearing browsing data or playing in a private window removes them.','');
}
function closeIntro(){if(!introOpen)return;if(saveTipDue&&state==='play'){showSaveTip();return}introOpen=false;banner=0;stage.classList.remove('dim');held.length=0;bombHeld=false;last=0;
  const el=$('intro');el.classList.add('out');setTimeout(()=>{if(!introOpen)el.hidden=true},300)}
function loreName(t){return LORE[t].name||ETYPES[t].name}
function loreCol(t){return LORE[t].col||ETYPES[t].col}
function checkIntros(){
  if(state!=='play')return;
  let seen=true;try{seen=!!localStorage.getItem('mp-savetip')}catch(e){}
  saveTipDue=level===1&&!seen&&canSave();
  const types=[...new Set(enemies.map(e=>e.type))];
  const I=INTRO[level],it=I?(I.type==='lion'?'giant':I.type):null;
  const t=it&&types.includes(it)?it:LORE_ORDER.find(x=>types.includes(x)&&!met.has(x));if(!t){if(saveTipDue)showSaveTip();return}
  met.add(t);try{localStorage.setItem('mp-met',JSON.stringify([...met]))}catch(e){}
  showIntroCard(loreCol(t),LORE[t].kind||(t==='giant'?'Boss':'New demon'),loreName(t),LORE[t].desc,LORE[t].wis,LORE[t].tip,portrait(t));
}
function tickIntro(dt){if(introOpen&&state!=='play'&&state!=='pause')closeIntro()}
function openGuide(){
  audio();resumeTo=state;if(state==='play')pause();
  // every demon introduced up to the current level, plus whatever is on the board now
  const first={};for(const n in INTRO){const t=INTRO[n].type==='lion'?'giant':INTRO[n].type;first[t]=Math.min(first[t]||99,+n)}
  const here=new Set(enemies.map(e=>e.type));
  const list=LORE_ORDER.filter(t=>first[t]<=level||here.has(t));
  showOverlay(`<h2 class="fgh">Field guide</h2>
    ${list.length?list.map(t=>`<div class="fg"><img src="${portrait(t)}" alt=""><div><b style="color:${loreCol(t)}">${loreName(t)}</b><span>${LORE[t].desc}</span><i>“${LORE[t].wis}”</i>${LORE[t].tip?`<span class="fgtip">Tip: ${LORE[t].tip}</span>`:''}</div></div>`).join(''):'<p class="muted">You haven’t met anyone yet. Demons appear here once you meet them.</p>'}
    <p class="muted">${LORE_ORDER.length-list.length?(LORE_ORDER.length-list.length)+' more still to meet.':'You have met them all.'}</p>
    <button class="go" id="fgClose" type="button">Close</button>`);
  $('fgClose').onclick=backFromClear;$('fgClose').focus();
}
function updateName(){$('pName').textContent=playerName?'Pilgrim '+playerName+' ✎':'Set your name ✎'}
function askName(after){
  audio();const prev=state;if(state==='play')pause();
  showOverlay(`<h2>What’s your name, Pilgrim?</h2>
    <input id="nameIn" type="text" maxlength="16" autocomplete="off" value="${esc(playerName)}" placeholder="Your name">
    <p class="muted">The game will call you by this name. You can change it any time by clicking it in the sidebar.</p>
    <button class="go" id="nameOk" type="button">${after?'Start the mission':'Save'}</button>`);
  const inp=$('nameIn');inp.focus();inp.select();
  const ok=()=>{playerName=inp.value.trim().slice(0,16);try{localStorage.setItem('mp-name',playerName)}catch(e){}updateName();
    if(after)after();else if(prev==='title'){titleCard()}else{resumeTo=prev;backFromClear()}};
  $('nameOk').onclick=ok;inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();ok()}});
}
function beginPlay(L,M){startLevel(L,M);state='play';hideOverlay();hud();saveProgress();checkIntros()}
function newGame(){jumped=false;level=1;score=0;lives=3;letters=new Set();player=makePlayer();beginPlay()}
function loadSlot(n){
  const sl=loadSlots()[n];if(!sl)return false;jumped=false;
  level=sl.level;score=sl.score||0;lives=Math.max(1,sl.lives||3);letters=new Set((sl.letters||[]).filter(c=>LETTERS.includes(c)));
  player=makePlayer();Object.assign(player,{bombs:sl.bombs||BASE_BOMBS,fire:sl.fire||BASE_FIRE,speed:sl.speed||3.6,fuse:sl.fuse||BASE_FUSE,hp:Math.min(MAX_HP,sl.hp||MAX_HP)});
  music.lastLevel=-1;beginPlay(sl.v===LAYOUT_V?sl.layout:null,sl.v===LAYOUT_V&&sl.moment);return true;
}
function startAt(n,any){jumped=!!any;n=Math.max(1,Math.min(any?FINAL_LEVEL:reachedLevel(),Math.floor(+n)||1));try{localStorage.setItem('mp-pick',n)}catch(e){}level=n;score=0;lives=3;letters=new Set();player=makePlayer();music.lastLevel=-1;beginPlay()}
function pickedLevel(){const i=$('lvlNum');if(i)return i.value;const b=$('goBtn');return b&&b.dataset.l||lastPick()}
function continueGame(){
  const sv=loadSave();if(!sv)return newGame();
  if(loadSlot(sv.level))return;
  level=sv.level;score=sv.score||0;lives=Math.max(1,sv.lives||3);letters=new Set((sv.letters||[]).filter(c=>LETTERS.includes(c)));
  player=makePlayer();Object.assign(player,{bombs:sv.bombs||BASE_BOMBS,fire:sv.fire||BASE_FIRE,speed:sv.speed||3.6,hp:Math.min(MAX_HP,sv.hp||MAX_HP)});
  beginPlay();
}
function slotLine(sl){return '<i class="hearts">'+'♥'.repeat(Math.min(sl.lives,5))+(sl.lives>5?'+':'')+'</i> · Lamps '+sl.bombs+' · Reach '+sl.fire}
function lastPick(){let n=1;try{n=+localStorage.getItem('mp-pick')||1}catch(e){}return Math.min(reachedLevel(),Math.max(1,n))}
function startBlock(over){
  const n=over?1:lastPick();
  return `<div class="startrow"><button class="go big" id="goBtn" type="button" data-l="${n}">${over?'Start again at level 1':'Start level '+n}</button></div>`;
}
let pickFrom=null,pickHTML='';
function levelPicker(){
  if(introOpen||!['title','over','play','pause'].includes(state))return;
  audio();pickFrom=state;pickHTML=state==='play'?'':$('card').innerHTML;state='pick';held.length=0;bombHeld=false;
  const last=pickFrom==='over'?1:lastPick(),has=slotKeys(loadSlots()).length;
  showOverlay(`<h2>Choose a level</h2>
    <div class="btns">
      <div class="pick"><label class="sec" for="lvlNum">Start at level</label>
        <select id="lvlNum">${Array.from({length:reachedLevel()},(_,i)=>i+1).map(n=>`<option value="${n}"${n===last?' selected':''}>Level ${n}${n%10===0?' \u00b7 Boss':INTRO[n]?' \u00b7 new demon':''}</option>`).join('')}</select>
        <button class="go" id="goBtn" type="button" style="padding:8px 16px">Start</button></div>
      ${has?`<div class="pick"><label class="sec" for="lvlPick">Or load a saved game</label>${slotSelect()}<button class="go alt" id="pickBtn" type="button" style="padding:8px 14px">Load</button></div>`:''}
    </div>
    ${reachedLevel()<50?'<p class="muted">Levels open up here as you reach them. Losing all your lives closes them again.</p>':''}
    ${pickFrom==='play'||pickFrom==='pause'?'<p class="muted">Starting another level ends the game you are playing now.</p>':''}
    <button class="go alt" id="pickCancel" type="button">Back <span class="sec">Esc</span></button>`);
  $('pickCancel').onclick=closePicker;wireSave();$('lvlNum').focus();
}
// Hidden jump: press L (opens the picker) then N within a moment to type any level, reached or not.
function jumpDialog(){
  if(state!=='pick')return;
  showOverlay(`<h2>Jump to a level</h2>
    <label class="sec" for="jumpNum">Level number (1–50)</label>
    <input id="jumpNum" type="number" min="1" max="50" step="1" inputmode="numeric" value="${level}" autocomplete="off">
    <div class="btns"><button class="go" id="jumpOk" type="button">Jump</button></div>`);
  $('card').classList.add('jumpcard');  const inp=$('jumpNum');inp.focus();inp.select();
  const ok=()=>{const n=Math.max(1,Math.min(FINAL_LEVEL,Math.floor(+inp.value)||1));
    audio();if(!playerName){askName(()=>startAt(n,true));return}startAt(n,true)};
  $('jumpOk').onclick=ok;
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();ok()}});
}
function closePicker(){
  if(state!=='pick')return;state=pickFrom;
  if(pickFrom==='play'){hideOverlay();last=0;return}
  showOverlay(pickHTML,pickFrom==='title');wireSave();
}
function slotSelect(){
  const slots=loadSlots(),ks=slotKeys(slots);
  if(!ks.length)return '<select id="lvlPick" disabled><option>No saved levels yet</option></select>';
  return '<select id="lvlPick">'+ks.map(k=>{const sl=slots[k];return `<option value="${esc(k)}">${sl.name?esc(sl.name)+' (L'+sl.level+')':'Level '+sl.level+(sl.mid?' (mid)':'')} \u00b7 ${sl.lives} lives \u00b7 ${sl.bombs} lamps \u00b7 reach ${sl.fire}</option>`}).join('')+'</select>';
}
function wireSave(){
  const g=$('pickBtn');if(g)g.onclick=()=>{const v=$('lvlPick').value;if(loadSlots()[v]){audio();loadSlot(v)}};
  const n=$('newBtn');if(n)n.onclick=()=>{audio();newGame()};
  const li=$('lvlNum');if(li)li.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();primary()}});
}
function renderSlots(){
  const slots=loadSlots(),ks=slotKeys(slots),box=$('slotList');
  $('slotCount').textContent=ks.length?ks.length:'';$('btnClearSaves').hidden=!ks.length&&!loadSave();
  if(!ks.length){box.innerHTML='<p class="slotempty">Nothing saved yet. Press Save level while playing.</p>';return}
  box.innerHTML=ks.map(k=>{const sl=slots[k];return `<button class="slot${sl.name?' named':''}${sl.level===level&&!sl.name&&state!=='title'?' cur':''}" type="button" data-l="${esc(k)}"><b>${slotTitle(sl)}</b><span>${sl.name?'Level '+sl.level+' \u00b7 ':''}${slotLine(sl)}</span></button>`}).join('');
}
let resumeTo=null;
function askClear(){
  audio();resumeTo=state;
  if(state==='play')pause();
  showOverlay(`<h2>Delete all saved levels?</h2>
    <p>This removes every saved level, your Continue point, your best score, the levels you've reached and your name from this browser. It can't be undone.</p>
    <div class="btns"><button class="go danger" id="delBtn" type="button">Delete all saved levels</button>
    <button class="go alt" id="keepBtn" type="button">Keep them</button></div>`);
  $('delBtn').onclick=()=>{try{localStorage.removeItem(SLOTS_KEY);localStorage.removeItem(SAVE_KEY);localStorage.removeItem('fusewarren-best');localStorage.removeItem('mp-name')}catch(e){}setReached(1);
    best=0;playerName='';updateName();renderSlots();hud();
    showOverlay(`<h2>Saved levels deleted</h2><p>Everything is cleared. Your next game starts fresh from level 1 and asks for your name again.</p><button class="go" id="okBtn" type="button">OK</button>`);
    $('okBtn').onclick=backFromClear;$('okBtn').focus()};
  $('keepBtn').onclick=backFromClear;$('keepBtn').focus();
}
function backFromClear(){
  if(resumeTo==='title'||resumeTo==='over'){state='title';titleCard()}
  else if(resumeTo==='play'){state='play';hideOverlay();last=0}
  else{state='play';pause()}
}
function askLoad(n){
  const sl=loadSlots()[n];if(!sl)return;audio();
  if(state==='title'||state==='over'){loadSlot(n);return}
  if(state==='play')pause();else if(state!=='pause')return;
  const L=sl.level,title=sl.name?'Load \u201c'+esc(sl.name)+'\u201d?':'Load level '+L+'?';
  showOverlay(`<h2>${title}</h2>
    <p>You'll ${sl.mid?'return to the spot where you saved level '+L:'start level '+L+' on its saved board'} with ${slotLine(sl)}, speed ${Math.round((sl.speed-3.6)/SPEED_STEP)+1} and ${sl.score} points.</p>
    <p class="muted">Your progress in the current level will be lost.</p>
    <div class="btns"><button class="go" id="loadBtn" type="button">Load ${sl.name?'save':'level '+L}</button>
    <button class="go alt" id="goBtn" type="button">Keep playing</button></div>`);
  $('loadBtn').onclick=()=>loadSlot(n);$('loadBtn').focus();
}

/* ---------- audio ---------- */
let ac=null,muted=false,noiseBuf=null;
function audio(){
  if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)();
    noiseBuf=ac.createBuffer(1,ac.sampleRate*0.6,ac.sampleRate);const d=noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}catch(e){ac=null}}
  if(ac&&ac.state==='suspended')ac.resume();
}
function tone(f,d,type='square',v=0.06,slide=0,delay=0){
  if(!ac||muted)return;const t=ac.currentTime+delay;
  const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d+0.02);
}
function boom(){
  if(!ac||muted)return;const t=ac.currentTime;
  const s=ac.createBufferSource();s.buffer=noiseBuf;
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(1800,t);f.frequency.exponentialRampToValueAtTime(90,t+0.5);
  const g=ac.createGain();g.gain.setValueAtTime(0.35,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
  s.connect(f).connect(g).connect(ac.destination);s.start(t);s.stop(t+0.6);
  tone(110,0.3,'sine',0.16,-60);tone(1046,0.35,'triangle',0.05);tone(1568,0.45,'sine',0.035,0,0.04);
}
function iceBreak(n){
  if(!ac||muted)return;const t=ac.currentTime+0.03;
  const s=ac.createBufferSource();s.buffer=noiseBuf;
  const f=ac.createBiquadFilter();f.type='highpass';f.frequency.setValueAtTime(2600,t);
  const g=ac.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.32,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
  s.connect(f).connect(g).connect(ac.destination);s.start(t,Math.random()*0.3);s.stop(t+0.18);
  const s2=ac.createBufferSource();s2.buffer=noiseBuf;const f2=ac.createBiquadFilter();f2.type='bandpass';f2.frequency.setValueAtTime(5200,t);f2.Q.value=1.5;
  const g2=ac.createGain();g2.gain.setValueAtTime(0.0001,t+0.05);g2.gain.exponentialRampToValueAtTime(0.12,t+0.06);g2.gain.exponentialRampToValueAtTime(0.0001,t+0.45);
  s2.connect(f2).connect(g2).connect(ac.destination);s2.start(t+0.05,Math.random()*0.1);s2.stop(t+0.5);
  const k=Math.min(10,5+2*n);
  for(let i=0;i<k;i++)tone(2200+Math.random()*3600,0.05+Math.random()*0.12,i%2?'sine':'triangle',0.03+Math.random()*0.025,-Math.random()*400,0.04+i*0.025+Math.random()*0.03);
}
function noiseHit(t,dur,type,f0,f1,vol,q=1,out=ac.destination){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noiseBuf;n.loop=true;
  f.type=type;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*0.25);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  n.connect(f).connect(g).connect(out);n.start(t);n.stop(t+dur+0.05)}
function deathGrowl(){if(!ac||muted||!noiseBuf)return;const t=ac.currentTime;
  noiseHit(t,0.9,'lowpass',220,520,0.18,0.7);
  for(const [f,d] of [[55,0],[82.4,0.04]]){const o=ac.createOscillator(),g=ac.createGain(),lfo=ac.createOscillator(),lg=ac.createGain();o.type='sine';o.frequency.value=f;
    lfo.frequency.value=6;lg.gain.value=f*0.04;lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(0.12,t+d+0.35);g.gain.exponentialRampToValueAtTime(0.0001,t+0.9);
    o.connect(g).connect(ac.destination);o.start(t+d);lfo.start(t+d);o.stop(t+0.95);lfo.stop(t+0.95)}
  [523,494,466].forEach((f,i)=>tone(f,0.25,'triangle',0.018,0,0.25+i*0.18))}
function deathCast(k){if(!ac||muted||!noiseBuf)return;const t=ac.currentTime;
  noiseHit(t,0.45*k+0.15,'bandpass',1800,300,0.22*k+0.05,1.2);
  tone(220,0.35*k+0.1,'triangle',0.05*k+0.02,-120);tone(330,0.3*k+0.1,'sine',0.03*k+0.01,-180,0.02)}
const sfx={
  place:()=>tone(330,0.08,'square',0.05,-120),
  kick:()=>tone(200,0.1,'triangle',0.08,200),
  pick:()=>{tone(660,0.08,'square',0.05);tone(990,0.12,'square',0.05,0,0.07)},
  kill:()=>tone(520,0.18,'sawtooth',0.05,-400),
  hurt:()=>tone(300,0.12,'square',0.05,-150),
  die:()=>{tone(440,0.5,'sawtooth',0.07,-380)},
  open:()=>{[523,659,784].forEach((f,i)=>tone(f,0.14,'triangle',0.07,0,i*0.09))},
  clear:()=>{[523,659,784,1046].forEach((f,i)=>tone(f,0.18,'square',0.05,0,i*0.1))}
};

/* ---------- music ---------- */
const music={on:true,mode:'chip',el:null,timer:null,step:0,next:0,playing:false,gain:null,name:''};
let STEP=60/132/4;
const LEAD=[69,0,72,0,76,0,74,72, 71,0,67,0,69,0,0,0, 69,0,72,0,76,0,79,77, 76,0,74,0,72,0,71,0,
            72,0,74,0,76,0,77,76, 74,0,72,0,71,0,67,0, 69,0,0,72,71,0,69,0, 68,0,71,0,69,0,0,0];
const ROOTS=[45,45,41,43,41,43,40,45];
const BLEAD=[64,0,64,67,0,64,70,69, 64,0,64,67,0,64,62,0, 64,0,64,67,0,64,70,72, 71,0,67,0,64,0,0,0,
             76,0,76,74,0,72,74,0, 71,0,71,72,0,71,67,0, 69,0,69,71,0,72,71,69, 67,0,66,0,64,0,0,0];
const BROOTS=[40,40,43,40,45,43,42,40];
const mf=m=>440*Math.pow(2,(m-69)/12);
function note(f,t,d,type,v){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g).connect(music.gain);o.start(t);o.stop(t+d+0.02)}
function schedule(){
  while(music.next<ac.currentTime+0.15){
    const s=music.step%64,t=music.next;
    const LD=music.boss?BLEAD:LEAD,RT=music.boss?BROOTS:ROOTS;
    if(LD[s])note(mf(LD[s]),t,STEP*1.8,music.boss?'sawtooth':'square',music.boss?0.035:0.045);
    if(s%2===0||music.boss){const r=RT[Math.floor(s/8)]+((s/2)%2?12:0);note(mf(r),t,STEP*1.6,'triangle',0.12)}
    if(s%8===0){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+0.12);
      g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.15);o.connect(g).connect(music.gain);o.start(t);o.stop(t+0.16)}
    if(s%4===2&&noiseBuf){const n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noiseBuf;f.type='highpass';f.frequency.value=7000;
      g.gain.setValueAtTime(0.05,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.connect(f).connect(g).connect(music.gain);n.start(t);n.stop(t+0.06)}
    music.step++;music.next+=STEP;
  }
}
function musicStart(){
  clearInterval(music.fadeT);clearTimeout(music.stopT);
  const fresh=music.lastLevel!==level;music.lastLevel=level;
  if(music.mode==='file'&&music.el){if(fresh)try{music.el.currentTime=0}catch(e){}
    music.el.volume=0.6;const r=music.el.play();if(r&&r.catch)r.catch(()=>{});return}
  if(!ac)return;
  if(!music.gain){music.gain=ac.createGain();music.gain.connect(ac.destination)}
  const t=ac.currentTime;music.gain.gain.cancelScheduledValues(t);music.gain.gain.setValueAtTime(0.5,t);
  if(fresh)music.step=0;music.boss=isBoss();STEP=music.boss?60/152/4:60/132/4;
  music.next=t+0.05;clearInterval(music.timer);music.timer=setInterval(schedule,25);
}
function musicStop(fade){
  clearInterval(music.fadeT);clearTimeout(music.stopT);
  if(fade){
    if(music.mode==='file'&&music.el){const el=music.el;let v=el.volume;
      music.fadeT=setInterval(()=>{v-=0.03;if(v<=0){clearInterval(music.fadeT);el.pause();el.volume=0.6}else el.volume=v},50)}
    else if(ac&&music.gain){const t=ac.currentTime;music.gain.gain.cancelScheduledValues(t);
      music.gain.gain.setValueAtTime(music.gain.gain.value,t);music.gain.gain.linearRampToValueAtTime(0,t+1.6);
      music.stopT=setTimeout(()=>{clearInterval(music.timer);music.timer=null},1700)}
    return}
  clearInterval(music.timer);music.timer=null;if(music.el)music.el.pause();
}
function musicTick(){
  const want=music.on&&state==='play'&&!!enemies&&enemies.length>0&&!!player&&player.alive;
  if(want!==music.playing){music.playing=want;want?musicStart():musicStop(state==='play'||state==='clear')}
}
function useSong(el,name){
  const was=music.playing;if(was){musicStop();music.playing=false}
  music.el=el;el.loop=true;music.mode='file';music.name=name;
  $('btnSong').textContent='Song: '+(name.length>18?name.slice(0,17)+'…':name);
}

/* ---------- particles ---------- */
function burst(x,y,col,n=12,spd=3,r=0.08){
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=spd*(0.4+Math.random());
    particles.push({x:x+.5,y:y+.5,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0.5+Math.random()*0.4,max:0.9,c:col,r:r*(0.6+Math.random()),g:4})}
}
function floatText(x,y,text,col='#ffd36b'){particles.push({x:x+.5,y:y+.3,vx:0,vy:-1.2,life:1,max:1,c:col,text,g:0})}
function updateParticles(dt){
  for(const p of particles){if(p.delay>0){p.delay-=dt;continue}p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;p.vx*=0.96}
  particles=particles.filter(p=>p.life>0);
}

/* ---------- bombs and flames ---------- */
function placeBomb(){
  if(state!=='play'||!player.alive)return;
  if(bombs.length>=player.bombs)return;
  const [x,y]=occ(player);if(bombAt(x,y)||grid[y][x]!==EMPTY)return;
  player.fuse=Math.max(MIN_FUSE,player.fuse||BASE_FUSE);player.fire=Math.min(MAX_FIRE,player.fire);
  bombs.push({x,y,t:player.fuse||BASE_FUSE,f:player.fuse||BASE_FUSE,range:player.fire,slide:null,sp:0});sfx.place();
}
function slideFree(x,y,b){
  if(!inB(x,y)||grid[y][x]!==EMPTY)return false;
  if(bombs.some(o=>o!==b&&o.x===x&&o.y===y))return false;
  if(enemies.some(e=>{const [ex,ey]=occ(e);return ex===x&&ey===y}))return false;
  const [px,py]=occ(player);return !(px===x&&py===y);
}
function kickBomb(b,dx,dy){if(slideFree(b.x+dx,b.y+dy,b)){b.slide=[dx,dy];b.sp=0;sfx.kick()}}
function addFlame(x,y,k,d){flameT[y][x]=FLAME_LIFE;flameK[y][x]=k;flameD[y][x]=d||4}
let melts=[],tunnels=[];const TOUCH=0.15;
// After coming out of a tunnel, keys already held are ignored this long: a tap stops at the exit,
// holding on carries the Pilgrim on after a short look around. A newly pressed key works at once.
const TUNNEL_PAUSE=0.35;
function tryTunnel(){const p=player;if(!p.alive||!tunnels.length)return;
  const ti=tunnelAt(p.x,p.y);if(ti<0||p.moving){if(ti<0&&!p.moving)p.tpLock=false;return}
  if(p.tpLock)return;const d=tunnels[(ti+1)%tunnels.length];if(!d||tunnels.length<2)return;
  for(const o of enemies){if(o.dead||o.type==='giant')continue;const [ox,oy]=occ(o);if(ox!==d[0]||oy!==d[1])continue;
    const fr=DLIST.map(([dx,dy])=>[d[0]+dx,d[1]+dy]).filter(([x,y])=>inB(x,y)&&grid[y][x]===EMPTY&&tunnelAt(x,y)<0&&!enemyAt(x,y,o));
    const alt=tunnels.find((t,k)=>k!==ti&&t!==d&&!enemies.some(q=>q!==o&&occ(q)[0]===t[0]&&occ(q)[1]===t[1]));
    const to=fr.length?fr[rand(fr.length)]:alt;if(to){o.x=o.tx=to[0];o.y=o.ty=to[1];o.moving=false;o.prog=0;o.tpLock=tunnelAt(to[0],to[1])>=0}}
  burst(p.x,p.y,'#7ae8ff',14,3,0.08);p.x=p.tx=d[0];p.y=p.ty=d[1];p.moving=false;p.prog=0;p.tpLock=true;p.stay=[...held];p.stayT=TUNNEL_PAUSE;tunnelWhoosh();burst(p.x,p.y,'#7ae8ff',14,3,0.08)}
function tunnelAt(x,y){for(let i=0;i<tunnels.length;i++)if(tunnels[i][0]===x&&tunnels[i][1]===y)return i;return -1}
function tunnelWhoosh(){if(!ac||muted||!noiseBuf)return;noiseHit(ac.currentTime,0.35,'bandpass',400,2400,0.12,2);tone(330,0.3,'sine',0.04,500)}
function tunnelDest(i,avoidPlayer){const n=tunnels.length;for(let s=1;s<n;s++){const [x,y]=tunnels[(i+s)%n];
    if(avoidPlayer&&player.alive&&occ(player)[0]===x&&occ(player)[1]===y)continue;
    if(enemies.some(o=>!o.dead&&occ(o)[0]===x&&occ(o)[1]===y))continue;return tunnels[(i+s)%n]}return null}
function meltAll(px,py){
  const list=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(grid[y][x]===CRATE)list.push([x,y]);
  melts=list.map(([x,y])=>({x,y,t:0.15+Math.hypot(x-px,y-py)*0.07}));
  floatText(px,py-0.6,'Everything hidden is revealed!','#bff4ff');shake=Math.max(shake,0.15);
  [784,988,1175,1568].forEach((f,i)=>tone(f,0.5,'sine',0.045,0,i*0.09));
  if(ac&&!muted&&noiseBuf){const t=ac.currentTime+0.15,n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();n.buffer=noiseBuf;n.loop=true;
    f.type='bandpass';f.frequency.setValueAtTime(3000,t);f.frequency.exponentialRampToValueAtTime(600,t+1.4);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.08,t+0.15);g.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
    n.connect(f).connect(g).connect(ac.destination);n.start(t);n.stop(t+1.7)}
}
function updateMelts(dt){
  if(!melts.length)return;
  for(const m of melts){m.t-=dt;if(m.t<=0&&grid[m.y][m.x]===CRATE){
    for(let i=0;i<6;i++)particles.push({x:m.x+.2+Math.random()*.6,y:m.y+.2+Math.random()*.3,vx:(Math.random()-.5)*0.6,vy:0.4+Math.random()*1.2,life:0.7,max:0.7,c:i%2?theme().c:'#bff4ff',g:2.5,r:0.045});
    if(hidden[key(m.x,m.y)]==='reveal')hidden[key(m.x,m.y)]='heal';
    breakCrate(m.x,m.y)}}
  melts=melts.filter(m=>m.t>0);
}
function breakCrate(x,y){
  grid[y][x]=EMPTY;score+=10;burst(x,y,theme().c,10,3.2,0.1);
  const k=key(x,y),h=hidden[k];
  if(h){delete hidden[k];if(h==='exit')exit.revealed=true;else items[k]={type:h,born:time,life:lifeOf(h)}}
}
function explode(b){
  const i=bombs.indexOf(b);if(i<0)return;bombs.splice(i,1);
  boom();
  addFlame(b.x,b.y,'c',6);burst(b.x,b.y,'#9fd3f5',3,2,0.04);
  for(const e of enemies)if(e.type==='giant'&&!e.dead&&Math.abs(b.x-e.x)<=1.05&&Math.abs(b.y-e.y)<=1.05){e.hp=1;e.inv=0;floatText(e.x,e.y-1.2,'Light from within!','#fff3b0')}
  const cells=[[b.x,b.y]];let broke=0;
  for(const [dx,dy] of DLIST){
    let lastX=-1,lastY=-1;
    for(let r=1;r<=b.range;r++){
      const x=b.x+dx*r,y=b.y+dy*r;
      if(!inB(x,y)||grid[y][x]===WALL)break;
      const k=dx?'h':'v';
      if(grid[y][x]===CRATE){if(r===1){breakCrate(x,y);broke++;addFlame(x,y,k,Math.max(3,6-r));lastX=x;lastY=y;cells.push([x,y])}break}
      const ob=bombAt(x,y);if(ob){ob.t=Math.min(ob.t,0.06);addFlame(x,y,k,Math.max(3,6-r));lastX=x;lastY=y;cells.push([x,y]);break}
      const it=items[key(x,y)];
      addFlame(x,y,k,Math.max(3,6-r));lastX=x;lastY=y;cells.push([x,y]);
    }
    if(lastX>=0)flameK[lastY][lastX]='e'+(dx>0?'R':dx<0?'L':dy>0?'D':'U');
  }
  if(broke&&theme().st==='ice')iceBreak(broke);
  hud();
}
function updateBombs(dt){
  for(const b of [...bombs]){
    if(!bombs.includes(b))continue;
    b.t-=dt;
    if(b.slide){b.sp+=10*dt;
      if(b.sp>=1){b.x+=b.slide[0];b.y+=b.slide[1];b.sp=0;
        if(flameT[b.y][b.x]>0)b.t=Math.min(b.t,0.05);
        if(!slideFree(b.x+b.slide[0],b.y+b.slide[1],b))b.slide=null}}
    if(b.t<=0)explode(b);
  }
}
function computeDanger(){
  for(const row of danger)row.fill(0);
  for(const b of bombs){if(b.t>1.9)continue;danger[b.y][b.x]=1;
    for(const [dx,dy] of DLIST)for(let r=1;r<=b.range;r++){const x=b.x+dx*r,y=b.y+dy*r;
      if(!inB(x,y)||grid[y][x]===WALL)break;danger[y][x]=1;if(grid[y][x]===CRATE||bombAt(x,y))break}}
}

/* ---------- player ---------- */
const held=[];
function curDir(){return held[held.length-1]}
function tryStart(d){
  const p=player,[dx,dy]=DIRS[d];
  const nx=p.x+dx,ny=p.y+dy;
  if(blocked(nx,ny,false))return false;
  p.face=d;p.tx=nx;p.ty=ny;p.dx=dx;p.dy=dy;p.prog=0;p.moving=true;return true;
}
function tryHeld(){
  for(let i=held.length-1;i>=0;i--)if(!(player.stay&&player.stay.includes(held[i]))&&tryStart(held[i]))return true;
  if(held.length)player.face=held[held.length-1];
  return false;
}
function arrive(){
  const p=player;
  tryTunnel();
  pickUp(p.x,p.y);
}
// Trumpet of Jericho: rare (at most one per level, from level 3, never on boss levels). Picking it up sends a
// golden wave across the board that defeats every demon it reaches, except the bosses.
const TRUMPET_FROM=3,TRUMPET_CHANCE=0.35,BOSS_TYPES=new Set(['giant','lion','idol']);let trumpetWave=null;
// First the horn sounds one long blast (HORN_TIME); only when it ends does the wave set off and the walls fall.
const HORN_TIME=2.3;
function blowTrumpet(x,y){trumpetWave={x,y,r:0,wait:HORN_TIME};shofar()}
// A ram's horn: a breathy, buzzing low note that scoops up, wavers as it is held, then breaks up to the fifth.
function shofar(){if(!ac||muted)return;const t=ac.currentTime,end=t+HORN_TIME-0.05,f0=196,brk=t+HORN_TIME-0.65;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.Q.value=4;lp.frequency.setValueAtTime(500,t);lp.frequency.linearRampToValueAtTime(1600,t+0.35);
  lp.frequency.setValueAtTime(1500,brk);lp.frequency.linearRampToValueAtTime(2600,brk+0.12);
  const g=ac.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.11,t+0.12);g.gain.linearRampToValueAtTime(0.085,brk-0.05);
  g.gain.linearRampToValueAtTime(0.12,brk+0.08);g.gain.setValueAtTime(0.12,end-0.25);g.gain.exponentialRampToValueAtTime(0.0001,end);
  lp.connect(g).connect(ac.destination);
  const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=5.2;lg.gain.value=3;lfo.start(t);lfo.stop(end+0.05);
  for(const [type,mul,det] of [['sawtooth',1,0],['sawtooth',1,7],['square',2,-5]]){const o=ac.createOscillator(),og=ac.createGain();o.type=type;o.detune.value=det;
    o.frequency.setValueAtTime(f0*0.82*mul,t);o.frequency.exponentialRampToValueAtTime(f0*mul,t+0.18);o.frequency.setValueAtTime(f0*1.02*mul,brk-0.1);
    o.frequency.exponentialRampToValueAtTime(f0*1.5*mul,brk+0.06);o.frequency.exponentialRampToValueAtTime(f0*1.53*mul,end);
    og.gain.value=type==='square'?0.25:0.5;lfo.connect(lg).connect(o.frequency);o.connect(og).connect(lp);o.start(t);o.stop(end+0.05)}
  if(noiseBuf){noiseHit(t,0.35,'bandpass',900,1400,0.05,1.5);noiseHit(t+0.2,HORN_TIME-0.3,'bandpass',1200,1600,0.025,2)}}// the breath
// Walls of a city coming down: a huge first crash, a long deep rumble, big blocks slamming down one after another,
// masonry cracking, and rubble trickling for a few seconds. It all goes through a compressor so it is loud without clipping.
function collapse(){if(!ac||muted||!noiseBuf)return;const t=ac.currentTime,c=ac.createDynamicsCompressor();
  c.threshold.value=-18;c.knee.value=10;c.ratio.value=6;c.attack.value=0.004;c.release.value=0.3;
  const out=ac.createGain();out.gain.value=1.25;c.connect(out).connect(ac.destination);
  const thud=(f,d,v,at)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(f,t+at);
    o.frequency.exponentialRampToValueAtTime(Math.max(25,f*0.45),t+at+d);g.gain.setValueAtTime(v,t+at);g.gain.exponentialRampToValueAtTime(0.0001,t+at+d);
    o.connect(g).connect(c);o.start(t+at);o.stop(t+at+d+0.02)};
  thud(80,1.2,0.5,0);thud(52,2.2,0.4,0.12);thud(38,3,0.3,0.4);// the first great crash
  noiseHit(t,0.7,'lowpass',2400,110,0.6,0.7,c);noiseHit(t,0.25,'highpass',1800,900,0.25,0.7,c);
  noiseHit(t+0.1,4,'lowpass',420,70,0.4,0.6,c);noiseHit(t+0.3,3.2,'bandpass',800,220,0.14,0.8,c);// the ground keeps rumbling
  for(let i=0;i<14;i++){const d=0.25+i*0.2+Math.random()*0.15;// big blocks slamming down, one after another
    thud(60+Math.random()*50,0.4+Math.random()*0.3,0.22+Math.random()*0.15,d);noiseHit(t+d,0.35,'lowpass',1500,150,0.3+Math.random()*0.2,0.8,c)}
  for(let i=0;i<45;i++){const d=0.05+Math.pow(Math.random(),1.3)*3.4;// stones cracking and tumbling, thicker at the start
    noiseHit(t+d,0.05+Math.random()*0.2,'bandpass',400+Math.random()*2600,120+Math.random()*300,0.1+Math.random()*0.18,1+Math.random()*2,c)}
  for(let i=0;i<30;i++){const d=2+Math.random()*2.5;// rubble and dust settling
    noiseHit(t+d,0.03+Math.random()*0.06,'highpass',2000+Math.random()*3000,1500,0.04+Math.random()*0.05,1,c)}}
// Like the walls of Jericho, the wave also brings down every crate and stone wall it passes (the outer frame
// stays), and leaves harmless fires burning in the rubble here and there. The fires are only a picture: they
// don't hurt anyone and don't set off lamps.
let jFires=[];
function updateTrumpet(dt){
  const [ppx,ppy]=player?rpos(player):[-9,-9];
  for(const f of jFires){f.t-=dt;f.spark-=dt;
    if(Math.abs(f.x-ppx)<0.9&&Math.abs(f.y-ppy)<0.9&&f.t>0.4)f.t=0.4;// the Pilgrim's spot stays clear: a fire there dies down
    if(f.spark<=0&&f.t>0.3){f.spark=0.15+Math.random()*0.15;// a stray ember now and then
      particles.push({x:f.x+0.35+Math.random()*0.3,y:f.y+0.1,vx:(Math.random()-.5)*0.5,vy:-(1.4+Math.random()),life:0.5,max:0.5,c:'#ffb347',r:0.05,g:-0.5})}}
  jFires=jFires.filter(f=>f.t>0);
  const w=trumpetWave;if(!w)return;
  if(w.wait>0){w.wait-=dt;if(w.wait>0)return;shake=Math.max(shake,0.6);collapse()}// the horn has ended: down they come
  w.r+=10*dt;
  for(const e of enemies){if(BOSS_TYPES.has(e.type)||e.dead||e.dying>0)continue;const [ex,ey]=rpos(e);
    if(Math.hypot(ex-w.x,ey-w.y)<=w.r){e.hp=1;e.inv=0;damageEnemy(e)}}
  let fell=0;
  for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){const c=grid[y][x];if(c!==CRATE&&c!==WALL)continue;
    if(Math.hypot(x-w.x,y-w.y)>w.r)continue;fell++;
    if(c===CRATE)breakCrate(x,y);else{grid[y][x]=EMPTY;burst(x,y,theme().w,7,3,0.11);burst(x,y,theme().hi,4,2.2,0.07)}
    if(Math.random()<0.3&&Math.hypot(x-ppx,y-ppy)>1.5)jFires.push({x,y,t:1.6+Math.random()*1.4,max:0,ph:Math.random()*9,spark:Math.random()*0.2})}
  if(fell){shake=Math.max(shake,0.32);w.rumble=(w.rumble||0)-dt;
    if(w.rumble<=0){w.rumble=0.08;if(ac&&!muted&&noiseBuf){const t=ac.currentTime;noiseHit(t,0.3,'lowpass',320,700,0.14,0.7);if(Math.random()<0.5)noiseHit(t,0.12,'bandpass',900+Math.random()*1500,300,0.08,1.5)}}}
  if(w.r>Math.hypot(COLS,ROWS))trumpetWave=null}
function drawJFires(){if(!jFires.length)return;// a few flickering tongues of flame in the rubble
  ctx.save();
  for(const f of jFires){if(!f.max)f.max=f.t;
    const grow=Math.min(1,(f.max-f.t)/0.3,f.t/0.6);if(grow<=0)continue;
    const cx=(f.x+.5)*S,base=(f.y+.86)*S;ctx.globalAlpha=Math.min(1,grow*1.5);
    for(const [ox,hk,wk,ph] of [[-0.16,0.5,0.15,0],[0.16,0.56,0.15,2.1],[0,0.9,0.21,4.2]]){
      const fl=0.86+0.14*Math.sin(time*13+ph+f.ph)+0.07*Math.sin(time*29+ph*1.7+f.ph),
        h=S*hk*grow*fl,w=S*wk*Math.max(0.45,grow),sw=Math.sin(time*9+ph+f.ph)*S*0.06*grow,x=cx+ox*S;
      const al=ctx.globalAlpha;ctx.globalCompositeOperation='lighter';// a soft glow in the shape of the flame, not a round halo
      for(const [kw,kh,c] of [[2.2,1.3,'rgba(255,110,30,.13)'],[1.65,1.16,'rgba(255,140,40,.16)'],[1.3,1.07,'rgba(255,170,60,.18)']]){
        ctx.fillStyle=c;flamePath(x,base+S*0.04,w*kw,h*kh,sw*1.1);ctx.fill()}
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=al;
      ctx.fillStyle='#e8401c';flamePath(x,base,w,h,sw);ctx.fill();
      ctx.fillStyle='#ff8f24';flamePath(x,base-S*0.01,w*0.72,h*0.78,sw*0.8);ctx.fill();
      ctx.fillStyle='#ffd96e';flamePath(x,base-S*0.02,w*0.42,h*0.5,sw*0.6);ctx.fill();
      ctx.fillStyle='#fff6cf';flamePath(x,base-S*0.02,w*0.2,h*0.26,sw*0.4);ctx.fill()}}
  ctx.restore()}
function drawTrumpetWave(){const w=trumpetWave;if(!w||w.wait>0)return;const cx=(w.x+.5)*S,cy=(w.y+.5)*S,R=w.r*S,fade=Math.max(0,1-w.r/Math.hypot(COLS,ROWS));
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(cx,cy,Math.max(0,R-S*0.9),cx,cy,R);g.addColorStop(0,'rgba(255,230,150,0)');g.addColorStop(0.8,`rgba(255,236,170,${0.35*fade})`);g.addColorStop(1,'rgba(255,240,190,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=`rgba(255,246,210,${0.85*fade})`;ctx.lineWidth=Math.max(2,S*0.08);ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();ctx.restore()}
function pickUp(x,y){
  const p=player,k=key(x,y),it=items[k];
  if(coins.has(k)){coins.delete(k);coinFx.push({x,y,t:0});score+=20;tone(1320,0.06,'square',0.04);tone(1760,0.08,'square',0.04,0,0.05);
    if(!coins.size&&!extraUsed)startExtra();hud()}
  if(it&&it.type==='letter'){delete items[k];score+=100;sfx.pick();gainLetter(it.letter,x,y)}
  else if(it){delete items[k];score+=50;sfx.pick();floatText(x,y,ITEMS[it.type].label,ITEMS[it.type].col);
    if(it.type==='bomb')p.bombs=Math.min(MAX_BOMBS,p.bombs+1);
    if(it.type==='fire')p.fire=Math.min(MAX_FIRE,p.fire+1);
    if(it.type==='speed'){p.fastT=Math.min(30,(p.fastT>0?p.fastT:0)+FAST_TIME);p.fastWarn=0;[660,880,1175].forEach((f,i)=>tone(f,0.08,'square',0.04,0,i*0.05))}
    if(it.type==='shield'){p.shield=10;p.shieldPick=true;p.warnSec=0}
    if(it.type==='heal')p.hp=Math.min(MAX_HP,p.hp+2);
    if(it.type==='reveal')meltAll(x,y);
    if(it.type==='trumpet')blowTrumpet(x,y);
    if(it.type==='quick')p.fuse=Math.max(MIN_FUSE,+((p.fuse||BASE_FUSE)-0.3).toFixed(2));
    if(it.type==='fullheal'){p.hp=MAX_HP;[523,659,784,1046].forEach((f,i)=>tone(f,0.12,'triangle',0.05,0,i*0.07))}
    hud()}
}
function updatePlayer(dt){
  const p=player;
  if(!p.alive){p.deathT+=dt;if(p.deathT>DEATH_TIME)loseLife();return}
  if(p.hurtT>0)p.hurtT-=dt;
  if(p.shield>0){p.shield-=dt;
    if(p.shieldPick){const s=Math.ceil(p.shield);
      if(s<=4&&s!==p.warnSec&&p.shield>0){p.warnSec=s;tone(s<=2?1100:800,0.09,'square',0.06)}
      if(p.shield<=0){p.shieldPick=false;p.warnSec=0;tone(400,0.25,'sawtooth',0.06,-250)}}}
  if(p.fastT>0){p.fastT-=dt;const s=Math.ceil(p.fastT);
    if(s<=3&&s!==p.fastWarn&&p.fastT>0){p.fastWarn=s;tone(s<=1?990:740,0.07,'triangle',0.05)}
    if(p.fastT<=0){p.fastT=0;p.fastWarn=0;tone(500,0.3,'triangle',0.05,-300);hud()}}
  if(!p.moving)tryTunnel();
  if(p.stay&&p.stay.length){p.stay=p.stay.filter(k=>held.includes(k));p.stayT-=dt;if(p.stayT<=0)p.stay=[]}
  const d=curDir();
  if(p.moving){
    if(tunnelAt(p.x,p.y)>=0&&tunnelAt(p.tx,p.ty)<0&&p.prog>=0.5)p.tpLock=false;
    if(p.prog>=TOUCH&&tunnelAt(p.tx,p.ty)>=0&&tunnelAt(p.x,p.y)<0){p.x=p.tx;p.y=p.ty;p.moving=false;p.prog=0;arrive();return}
    if(p.prog>=TOUCH)pickUp(p.tx,p.ty);
    if(d&&DIRS[d][0]===-p.dx&&DIRS[d][1]===-p.dy){
      [p.x,p.tx]=[p.tx,p.x];[p.y,p.ty]=[p.ty,p.y];p.dx=-p.dx;p.dy=-p.dy;p.prog=1-p.prog;p.face=d}
    p.prog+=(p.fastT>0?Math.max(FAST_SPEED,p.speed):p.speed)*dt;
    if(p.prog>=1){const extra=p.prog-1;p.x=p.tx;p.y=p.ty;p.moving=false;p.prog=0;arrive();
      if((bombHeld||pendingBomb)&&state==='play'){placeBomb();pendingBomb=false}
      if(d&&tryHeld())p.prog=Math.min(extra,0.5)}
  }else if(d)tryHeld();
}
function killPlayer(){
  if(!player.alive||player.shield>0||(state==='play'&&!enemies.length))return;
  player.alive=false;player.deathT=0;sfx.die();
  [392,349,311,262].forEach((f,i)=>tone(f,i===3?0.9:0.32,'triangle',0.08,i===3?-60:0,0.7+i*0.34));
  const [x,y]=rpos(player);burst(x,y,'#ffb347',22,4,0.1);shake=0.35;
}
function hurtPlayer(n,blast){
  const p=player;if(!p.alive||p.shield>0||p.hurtT>0)return;
  if(state==='play'&&!enemies.length)return;
  p.hp=Math.max(0,p.hp-n);p.hurtT=1;sfx.hurt();shake=Math.max(shake,blast?0.3:0.12);
  const [x,y]=rpos(p);floatText(x,y,'-'+(n/2)+'\u2665','#ff5a5a');
  hud();
  if(p.hp<=0)killPlayer();
}
function loseLife(){
  lives--;music.lastLevel=-1;
  Object.assign(player,{bombs:BASE_BOMBS,fire:BASE_FIRE,speed:3.6,shield:0,shieldPick:false,hp:MAX_HP,hurtT:0,fastT:0,fuse:BASE_FUSE});
  hud();if(lives<=0)gameOver();else startLevel(curLayout)}
function startExtra(){
  if(!enemies.length)return;
  extraUsed=true;extraT=EXTRA_TIME;extraBanner=2.4;sfx.open();
  for(const e of enemies){e.letter=pickLetter();e.ltT=2.5;e.hp=1}
  hud();
}
let letterSeq=0,letterTick=0;
function nextDropLetter(){const used=new Set(Object.values(items).filter(i=>i.type==='letter').map(i=>i.letter));
  for(let n=0;n<5;n++){const l=LETTERS[(letterSeq+n)%5];if(!used.has(l)){letterSeq=(letterSeq+n+1)%5;return l}}const l=LETTERS[letterSeq%5];letterSeq++;return l}
function pickLetter(){const miss=LETTERS.filter(l=>!letters.has(l));const pool=miss.length?miss:LETTERS;return pool[rand(pool.length)]}
function gainLetter(l,x,y){
  letters.add(l);floatText(x,y,l,LCOL[l]||'#ffb347');
  if(LETTERS.every(c=>letters.has(c))){letters.clear();lives++;sfx.clear();floatText(x,y-0.6,'GRACE! +1 LIFE','#ffd21f')}
  hud();
}
function gameOver(){
  state='over';
  // Out of lives: the levels are lost too, so the next game starts back at level 1.
  {const sv=loadSave();if(sv){Object.assign(sv,{level:1,lives:3,hp:MAX_HP,bombs:BASE_BOMBS,fire:BASE_FIRE,speed:3.6,score:0,letters:[]});writeSave(sv)}}
  try{localStorage.setItem('mp-pick',1)}catch(e){}setReached(1);
  const newBest=score>best;if(newBest){best=score;try{localStorage.setItem('fusewarren-best',best)}catch(e){}}
  hud();
  showOverlay(`<h2 class="overh">Out of lives</h2>
    <p>You reached level ${level}. Your journey starts again from level 1.</p>
    <div class="legend scores"><div><span class="sec">Score</span></div><div><span class="big">${score}</span></div>
    <div><span class="sec">Best</span></div><div><span class="big">${best}</span>${newBest?' <span class="sec" style="color:var(--amber)">new</span>':''}</div></div>
    ${startBlock(true)}`);
  wireSave();
}
// Level 50 is the last level. Winning it plays the finale, then the Pilgrim starts again at level 1
// keeping lives, score, letters and power-ups.
const FINAL_LEVEL=50,FINALE_READY=10.5;let finaleT=0;
function startFinale(){state='finale';finaleT=0;held.length=0;bombHeld=false;shots=[];bombs=[]}
function newRound(){level=1;music.lastLevel=-1;beginPlay()}
let clearSwitched=false,clearLevel=0,levelStartScore=0,clearScore=0;
function levelClear(){
  state='clear';clearT=0;clearSwitched=false;clearLevel=level;clearBonus=250*level;
  if(isBoss()){clearBonus+=2500*bossK();lives++;player.hp=MAX_HP;floatText(player.x,player.y-0.6,'+1 LIFE','#e0457b')}
  score+=clearBonus;clearScore=score-levelStartScore;sfx.clear();
  hud();
}

/* ---------- enemies ---------- */
function bfs(sx,sy,ghost){
  const dist=new Array(COLS*ROWS).fill(Infinity);const q=[sx+sy*COLS];dist[q[0]]=0;
  for(let h=0;h<q.length;h++){const c=q[h],x=c%COLS,y=(c-x)/COLS;
    for(const [dx,dy] of DLIST){const nx=x+dx,ny=y+dy,ni=nx+ny*COLS;
      if(blocked(nx,ny,ghost)||dist[ni]!==Infinity)continue;dist[ni]=dist[c]+1;q.push(ni)}}
  return dist;
}
function enemyAt(nx,ny,me){return enemies.some(o=>o!==me&&((o.x===nx&&o.y===ny)||(o.moving&&o.tx===nx&&o.ty===ny)))}
function bfsMulti(src){
  const dist=new Array(COLS*ROWS).fill(Infinity);const q=[];
  for(const [x,y] of src){const i=x+y*COLS;if(dist[i]!==0){dist[i]=0;q.push(i)}}
  for(let h=0;h<q.length;h++){const c=q[h],x=c%COLS,y=(c-x)/COLS;
    for(const [dx,dy] of DLIST){const nx=x+dx,ny=y+dy,ni=nx+ny*COLS;
      if(blocked(nx,ny,false)||dist[ni]!==Infinity)continue;dist[ni]=dist[c]+1;q.push(ni)}}
  return dist;
}
function nearFree(x,y,n){const out=[],seen=new Set([key(x,y)]),q=[[x,y]];
  while(q.length&&out.length<n){const [cx,cy]=q.shift();const k=key(cx,cy);
    if(grid[cy][cx]===EMPTY&&!items[k]&&!coins.has(k))out.push([cx,cy]);
    for(const [dx,dy] of DLIST){const nx=cx+dx,ny=cy+dy,nk=key(nx,ny);if(inB(nx,ny)&&!seen.has(nk)&&grid[ny][nx]!==WALL){seen.add(nk);q.push([nx,ny])}}}
  return out}
function enemyArrive(e){
  {const ti=tunnelAt(e.x,e.y);if(ti>=0){if(!e.tpLock){const d=tunnelDest(ti,true);if(d){e.x=e.tx=d[0];e.y=e.ty=d[1];e.tpLock=true;burst(d[0],d[1],'#7ae8ff',8,2,0.06)}}}else e.tpLock=false}
  if(extraT>0)return;const k=key(e.x,e.y);
  if(e.type==='theft'){
    if(items[k]&&items[k].type!=='letter'){e.loot.push(items[k].type);delete items[k];tone(500,0.08,'square',0.04,-200)}
    else if(coins.has(k)){coins.delete(k);e.coins++;tone(700,0.05,'square',0.03,-300)}}
}
function onDeath(e){
  if(e.type==='theft'||e.type==='greed'){
    const back=[...e.loot.slice(-3)];for(let i=0;i<Math.min(2,e.lamps);i++)back.push('bomb');
    const spots=nearFree(e.x,e.y,back.length+e.coins);
    back.forEach((t,i)=>{if(spots[i])items[key(spots[i][0],spots[i][1])]={type:t,born:time,life:lifeOf(t)}});
    for(let i=0;i<e.coins;i++){const sp=spots[back.length+i];if(sp)coins.add(key(sp[0],sp[1]))}
    if(back.length||e.coins)floatText(e.x,e.y-0.5,'Returned!','#ffd36b')}
}
const DIE_TIME=0.85,GREED_SENSE=7;
function chew(){if(!ac||muted||!noiseBuf)return;const t=ac.currentTime;
  for(const d of [0,0.11]){noiseHit(t+d,0.09,'lowpass',1400,300,0.22,1.5);tone(140,0.06,'square',0.03,-60,d)}}
function greedBites(dt){
  if(!player.alive)return;const [rx,ry]=rpos(player);
  for(const e of enemies){if(e.type!=='greed'||e.dying>0)continue;const [ex,ey]=rpos(e);
    e.biting=Math.hypot(ex-rx,ey-ry)<0.7&&extraT<=0;if(!e.biting){e.biteT=0;continue}
    e.biteT=(e.biteT||0)-dt;if(e.biteT>0)continue;e.biteT=0.45;chew();
    if(player.shield>0||(state==='play'&&!enemies.some(o=>!o.dying)))continue;
    player.hp=Math.max(0,player.hp-1);shake=Math.max(shake,0.1);floatText(rx,ry-0.3,'Chomp!','#ffd36b');hud();
    if(player.hp<=0){killPlayer();return}}
}
function damageEnemy(e){
  e.hp--;e.inv=0.7;
  if(e.hp<=0){e.dying=DIE_TIME;e.moving=false;e.windup=0;e.burst=0;const T=ETYPES[e.type];sfx.kill();const [rx,ry]=rpos(e);
    if(extraT>0){score+=300;burst(rx,ry,'#e6dcff',18,3,0.1);let [lx,ly]=occ(e);if(items[key(lx,ly)]){const sp=nearFree(lx,ly,1)[0];if(sp)[lx,ly]=sp}// never cover a letter already there
      if(!items[key(lx,ly)])items[key(lx,ly)]={type:'letter',letter:nextDropLetter(),born:time,life:20};tone(880,0.1,'triangle',0.05)}
    else{score+=T.pts;burst(rx,ry,T.col,16,3.5,0.1);floatText(rx,ry,'+'+T.pts);onDeath(e)}}
  else sfx.hurt();
}
const STRAIGHT_CLOUD_LEVELS=new Set([46]);
function choose(e){
  const T=extraT>0?{...ETYPES.gloop,ghost:ETYPES[e.type].ghost}:ETYPES[e.type],here=danger[e.y][e.x];
  e.leanOn=(e.dx||e.dy)&&enemyAt(e.x+e.dx,e.y+e.dy,e);if(e.leanOn){e.ldx=e.dx;e.ldy=e.dy}// press up against the one ahead
  let opts=DLIST.filter(([dx,dy])=>{const nx=e.x+dx,ny=e.y+dy;
    if(blocked(nx,ny,T.ghost)||flameT[ny][nx]>0||enemyAt(nx,ny,e))return false;
    if(tunnelAt(nx,ny)>=0&&player.alive&&!player.moving&&player.x===nx&&player.y===ny)return false;
    if(T.avoid&&danger[ny][nx]&&!here)return false;return true});
  // Hatred never turns back unless it is in a dead end
  if(e.type==='brute'&&extraT<=0&&(e.dx||e.dy)){const fw=opts.filter(o=>!(o[0]===-e.dx&&o[1]===-e.dy));if(fw.length)opts=fw}
  if(!opts.length)return null;
  if(T.avoid&&here){const safe=opts.filter(([dx,dy])=>!danger[e.y+dy][e.x+dx]);
    if(safe.length)opts=safe;
    else{const dm=bfs(e.x,e.y,T.ghost);void dm}}
  if((T.ai==='thief'||T.ai==='glutton')&&!here&&extraT<=0){
    if(e.fleeT>0&&player.alive){const [px,py]=occ(player),dp=bfs(px,py,false);let best=null,bd=-1;
      for(const o of opts){const d=dp[(e.x+o[0])+(e.y+o[1])*COLS];if(d!==Infinity&&d>bd){bd=d;best=o}}if(best)return best}
    const src=[...coins].map(k=>k.split(',').map(Number));
    if(T.ai==='thief')for(const k in items)if(items[k].type!=='letter')src.push(k.split(',').map(Number));
    if(src.length){const dist=bfsMulti(src);let best=null,bd=Infinity;
      for(const o of opts){const d=dist[(e.x+o[0])+(e.y+o[1])*COLS];if(d<bd){bd=d;best=o}}
      if(best&&bd<=14)return best}
  }
  if(player.alive&&!here&&!(extraT<=0&&(T.ai==='chase'||T.ai==='drift')&&pursuitRank(e)>=MAX_PURSUERS)){
    const [px,py]=occ(player);
    if(T.ai==='chase'){const dist=bfs(px,py,T.ghost);let best=null,bd=Infinity;
      for(const o of opts){const d=dist[(e.x+o[0])+(e.y+o[1])*COLS];if(d<bd){bd=d;best=o}}
      if(best&&bd<=T.range-(level<=4?2:0))return best}
    if(T.ai==='drift'&&Math.random()<0.65){
      const away=nearPlayer('lies',5,e)?-1:1;
      opts=[...opts].sort((a,b)=>away*((Math.abs(e.x+a[0]-px)+Math.abs(e.y+a[1]-py))-(Math.abs(e.x+b[0]-px)+Math.abs(e.y+b[1]-py))));
      return opts[0]}
  }
  e.rush=false;
  if(e.type==='greed'&&extraT<=0){
    const moving=e.dx||e.dy,fwdSide=moving?opts.filter(o=>!(o[0]===-e.dx&&o[1]===-e.dy)):opts,cand=fwdSide.length?fwdSide:opts;
    let dist=null;if(player.alive){const [px,py]=occ(player);dist=bfs(px,py,false);if(!(dist[e.x+e.y*COLS]<=GREED_SENSE))dist=null}
    const here2=e.x+','+e.y;e.trail=e.trail||[];e.loopCD=Math.max(0,(e.loopCD||0)-1);
    if(!fwdSide.length){e.trail=[];return opts[0]}
    if(e.loopCD<=0&&e.trail.slice(-8).includes(here2)){e.straightN=3;e.loopCD=10}
    e.trail.push(here2);if(e.trail.length>12)e.trail.shift();
    const looping=(e.straightN||0)>0;if(looping)e.straightN--;
    let best=null,bs=Infinity;
    for(const o of cand){const straight=o[0]===e.dx&&o[1]===e.dy;let d=dist?dist[(e.x+o[0])+(e.y+o[1])*COLS]:0;if(d===Infinity)d=50;
      const nk=(e.x+o[0])+','+(e.y+o[1]),recent=e.trail.slice(-8).includes(nk);
      const sc=(looping?d*0.3:d)+(looping?(straight?-3:0):(straight?0.7:0))+(recent?2:0)+Math.random()*0.6;if(sc<bs){bs=sc;best=o}}
    return best}
  // Level 46: clouds keep going straight and only turn when blocked; they go back only at a dead end
  if(extraT>0&&STRAIGHT_CLOUD_LEVELS.has(level)){const f=opts.find(o=>o[0]===e.dx&&o[1]===e.dy);if(f)return f;
    const side=opts.filter(o=>o[0]*e.dx+o[1]*e.dy===0);return side.length?side[rand(side.length)]:opts[0]}
  if(extraT>0&&!here){const back=opts.find(o=>o[0]===-e.dx&&o[1]===-e.dy),f=opts.find(o=>o[0]===e.dx&&o[1]===e.dy),r=Math.random();
    if(back&&r<0.18)return back;if(f&&r<0.55)return f;const other=opts.filter(o=>o!==back);return (other.length?other:opts)[rand((other.length?other:opts).length)]}
  if(e.followAim&&extraT<=0&&!here){e.followAim=false;const f=opts.find(o=>o[0]===e.dx&&o[1]===e.dy);if(f)return f}
  if(e.type==='critic'&&extraT<=0&&!here){
    const m=e.mem||(e.mem={});m[e.x+','+e.y]=time;
    // it saw you a moment ago: go to where you were, by the shortest way
    if(e.lastSeen&&time-e.seenT<5){const [lx,ly]=e.lastSeen,dist=bfs(lx,ly,false),dh=dist[e.x+e.y*COLS];
      if(dh>0&&dh!==Infinity){let best=null,bd=dh;for(const o of opts){const d=dist[(e.x+o[0])+(e.y+o[1])*COLS];if(d<bd){bd=d;best=o}}if(best)return best}
      e.lastSeen=null}
    // lost you: explore squares seen longest ago (or never), drawn to tunnels, keeping away from other Criticisms
    let best=null,bs=Infinity;
    for(const o of opts){const nx=e.x+o[0],ny=e.y+o[1];let sc=(m[nx+','+ny]??-60)+Math.random()*1.5;
      if(tunnelAt(nx,ny)>=0&&!e.tpLock)sc-=8;if(o[0]===-e.dx&&o[1]===-e.dy)sc+=1;
      for(const q of enemies)if(q!==e&&q.type==='critic'&&!(q.dying>0)){const d=Math.abs(q.x-nx)+Math.abs(q.y-ny);if(d<=3)sc+=(4-d)*3}
      if(sc<bs){bs=sc;best=o}}
    return best}
  if(e.type==='gossip'&&extraT<=0&&!here){// follows the hero it can see (ahead or to the side, up to 7 steps); otherwise likes to turn
    // it can't see behind, but if it saw you a moment ago and you slipped past, it turns back and chases
    const a=player.alive?lineOfFire(e,T.follow):null,behind=a&&(e.dx||e.dy)&&a[0]===-e.dx&&a[1]===-e.dy;
    if(a&&(!behind||time-(e.seenT??-9)<2.5)){e.seenT=time;const t=opts.find(o=>o[0]===a[0]&&o[1]===a[1]);if(t)return t}
    const side=opts.filter(o=>o[0]*e.dx+o[1]*e.dy===0),f=opts.find(o=>o[0]===e.dx&&o[1]===e.dy);
    if(side.length&&(Math.random()<0.65||!f))return side[rand(side.length)];
    return f||opts[0]}
  if(e.type==='skitter'&&extraT<=0&&!here&&player.alive){const a=lineOfFire(e,99);
    if(a){const f=opts.find(o=>o[0]===a[0]&&o[1]===a[1]);if(f){e.rush=true;e.pace=0;return f}}}
  if((e.type==='spitter'||e.type==='suspect'||e.type==='murder')&&extraT<=0){
    if(e.type==='spitter'&&(e.dx||e.dy)&&enemyAt(e.x+e.dx,e.y+e.dy,e)){const back=opts.find(o=>o[0]===-e.dx&&o[1]===-e.dy);if(back&&Math.random()<0.8)return back}
    const f=opts.find(o=>o[0]===e.dx&&o[1]===e.dy),side=opts.filter(o=>o[0]*e.dx+o[1]*e.dy===0);
    if(f)return side.length&&Math.random()<0.3?side[rand(side.length)]:f;
    if(side.length)return side[rand(side.length)];
    return opts[0]}
  if((e.type==='doubt'||e.type==='skitter'||e.type==='accuse')&&extraT<=0&&!here){
    const has=(dx,dy)=>opts.find(o=>o[0]===dx&&o[1]===dy);
    if(e.pace===undefined)e.pace=2+rand(3);
    const f=has(e.dx,e.dy);if(e.pace>0&&f){e.pace--;return f}
    const back=has(-e.dx,-e.dy),side=opts.filter(o=>o[0]*e.dx+o[1]*e.dy===0);
    const nd=back&&(Math.random()<0.65||!side.length)?back:side.length?side[rand(side.length)]:opts[rand(opts.length)];
    e.dx=nd[0];e.dy=nd[1];e.pace=1+rand(4);e.idle=0.25+Math.random()*0.55;return null}
  const fwd=opts.find(o=>o[0]===e.dx&&o[1]===e.dy);
  if(fwd&&Math.random()<0.8)return fwd;
  const nonRev=opts.filter(o=>!(o[0]===-e.dx&&o[1]===-e.dy));
  const pool=nonRev.length?nonRev:opts;return pool[rand(pool.length)];
}
let shots=[];
const MAX_PURSUERS=2;
function pursuitRank(e){const [px,py]=occ(player),d=Math.abs(e.x-px)+Math.abs(e.y-py);let r=0;
  for(const o of enemies){if(o===e||o.dead||o.dying>0)continue;const a=ETYPES[o.type].ai;if(a!=='chase'&&a!=='drift')continue;
    const od=Math.abs(o.x-px)+Math.abs(o.y-py);if(od<d||(od===d&&enemies.indexOf(o)<enemies.indexOf(e)))r++}
  return r}
function nearPlayer(type,r,skip){if(!player.alive)return false;const [px,py]=occ(player);
  return enemies.some(o=>o!==skip&&!o.dead&&!(o.dying>0)&&o.type===type&&!(type==='lies'&&o.vanish>0.5)&&Math.abs(o.x-px)+Math.abs(o.y-py)<=r)}
function lineOfFire(e,maxd){
  const [ex,ey]=occ(e),[px,py]=occ(player);
  if(ex!==px&&ey!==py)return null;
  const dx=Math.sign(px-ex),dy=Math.sign(py-ey),d=Math.abs(px-ex)+Math.abs(py-ey);
  if(!d||d>maxd)return null;
  for(let i=1;i<d;i++){const c=grid[ey+dy*i][ex+dx*i];if(c===WALL||c===CRATE)return null}
  return [dx,dy];
}
function fireShot(e,dx,dy){
  const T=ETYPES[e.type],[ox,oy]=occ(e);let [rx,ry]=rpos(e);
  if(dx!==0)ry=oy;if(dy!==0)rx=ox;
  shots.push({x:rx+dx*0.35,y:ry+dy*0.35,dx,dy,v:T.shoot==='lion'?5.5:T.shoot==='auto'?6:T.shoot==='stream'?7.5:4.5,dmg:T.sdmg,big:T.shoot==='lion',pellet:T.shoot==='pellet'||T.shoot==='auto'||T.shoot==='stream',red:T.shoot==='auto',cyan:T.shoot==='stream',life:4,from:e});
  if(T.shoot==='stream'){// rapid-fire rattle: sharp crack plus a low punch
    if(ac&&!muted&&noiseBuf)noiseHit(ac.currentTime,0.05,'bandpass',2600,900,0.09,1.2);tone(95+Math.random()*15,0.045,'square',0.03,-40)}
  else if(T.shoot==='auto'){tone(900,0.035,'square',0.03,-500);tone(220,0.04,'triangle',0.04,-80)}else if(T.shoot==='pellet'){tone(620,0.05,'square',0.035,-300);tone(180,0.06,'triangle',0.05,-60)}else tone(T.shoot==='lion'?180:320,0.12,'sawtooth',0.04,-120);
}
function updateShooter(e,dt){
  const T=ETYPES[e.type];if(!T.shoot)return false;
  if(extraT>0){e.windup=0;e.burst=0;return false}
  if(T.shoot==='flame'){// Temper: stops and breathes a short, endless flame while you are close and in line
    const a=player.alive&&!e.moving?lineOfFire(e,T.range):null;
    if(a){e.aim=a;e.flaming=0.5}else if(e.flaming>0)e.flaming-=dt;
    if(!(e.flaming>0))return false;
    e.dx=e.aim[0];e.dy=e.aim[1];const [ex,ey]=occ(e),[px,py]=occ(player);
    for(let r=1;r<=T.range;r++){const x=ex+e.dx*r,y=ey+e.dy*r;if(!inB(x,y)||grid[y][x]!==EMPTY)break;if(player.alive&&px===x&&py===y)hurtPlayer(T.sdmg)}
    e.crackle=(e.crackle||0)-dt;if(e.crackle<=0){e.crackle=0.14;tone(120+Math.random()*80,0.08,'sawtooth',0.018,-40)}
    return true}
  if(T.shoot==='stream'){// Criticism: sees every side, turns at once and keeps firing while you are in its line
    const a=player.alive?lineOfFire(e,T.range):null;
    if(!a){e.firing=false;return false}
    if(!e.firing)e.cd=0;e.firing=true;// first shot the moment it sees you
    e.lastSeen=occ(player);e.seenT=time;e.aim=a;if(!e.moving){e.dx=a[0];e.dy=a[1]}
    e.cd-=dt;if(e.cd<=0){e.cd=T.cd;fireShot(e,a[0],a[1])}
    return !e.moving}// keeps firing while it finishes its step, then stands
  if(T.shoot==='spray'){// Gossip: starts spraying when it sees you, keeps coming until its fire reaches, then stands and sprays; not behind
    let a=player.alive?lineOfFire(e,T.sight||T.range):null;
    if(a&&(e.dx||e.dy)&&a[0]===-e.dx&&a[1]===-e.dy&&!(time-(e.seenT??-9)<2.5))a=null;
    if(a)e.seenT=time;
    if(a){e.aim=a;e.spraying=0.3}else if(e.spraying>0)e.spraying-=dt;
    e.talking=e.spraying>0;if(!e.talking)return false;
    e.dx=e.aim[0];e.dy=e.aim[1];e.followAim=true;
    const [ex,ey]=occ(e),[px,py]=occ(player);
    for(let r=1;r<=T.range;r++){const x=ex+e.aim[0]*r,y=ey+e.aim[1]*r;if(!inB(x,y)||grid[y][x]!==EMPTY)break;if(player.alive&&px===x&&py===y)hurtPlayer(T.sdmg)}
    e.hiss=(e.hiss||0)-dt;if(e.hiss<=0){e.hiss=0.12;if(ac&&!muted&&noiseBuf)noiseHit(ac.currentTime,0.2,'highpass',3800,5200,0.05,0.7)}
    return !!a&&!e.moving&&Math.abs(px-ex)+Math.abs(py-ey)<=T.range}
  if(e.burst>0){e.burstT-=dt;if(e.burstT<=0){fireShot(e,e.aim[0],e.aim[1]);e.burst--;e.burstT=T.shoot==='auto'?0.13:0.2}return true}
  if(e.windup>0){e.windup-=dt;
    if(e.windup<=0){e.shots++;e.cd=T.cd*(0.8+Math.random()*0.4);
      if(T.shoot==='lion'&&e.shots%3===0){for(const [dx,dy] of DLIST)fireShot(e,dx,dy)}
      else{fireShot(e,e.aim[0],e.aim[1]);if(T.shoot==='lion'){e.burst=2;e.burstT=0.2}if(T.shoot==='auto'){e.burst=4+rand(2);e.burstT=0.13}}}
    return true}
  e.cd-=dt;
  if(e.cd<=0&&(!e.moving||T.shoot==='pellet'||e.type==='spitter'||e.type==='suspect')&&player.alive){
    const a=lineOfFire(e,T.srange||T.range||8);
    if(a&&e.type==='spitter'&&!(a[0]===e.dx&&a[1]===e.dy))return false;
    if(a&&e.type==='suspect'&&(e.dx||e.dy)&&!(a[0]===e.dx&&a[1]===e.dy)){
      if(a[0]===-e.dx&&a[1]===-e.dy){e.dx=a[0];e.dy=a[1];e.windup=0.35;e.aim=a;e.spun=0.5;tone(300,0.12,'triangle',0.04,200);return true}
      return false}
    if(a&&e.type==='accuse'&&(e.dx||e.dy)&&a[0]===-e.dx&&a[1]===-e.dy)return false;
    if(a){e.aim=a;e.windup=T.shoot==='lion'?0.6:T.shoot==='pellet'?0.08:T.shoot==='auto'?0.3:e.type==='spitter'?0.22:0.45;return true}
    if(T.shoot==='lion'&&e.cd<-1.5&&(e.shots%3===2)){e.windup=0.6;return true}
  }
  return false;
}
const GIANT_SIGHT=7,GIANT_GAP=5;
// Levels where every boss keeps firing and its fire passes through crates (only demons block it)
const OPEN_FIRE_LEVELS=new Set([50]);
// Levels where each boss breathes a long stream of fireballs aimed at the Pilgrim, but locked on where
// the Pilgrim stood when it started (never re-aiming): a Pilgrim who keeps running gets away.
const STREAM_FIRE_LEVELS=new Set([50]),STREAM_N=10,STREAM_GAP=0.08;
const giantAim=(e,px,py)=>Math.atan2(py-e.y,px-e.x);
function giantFire(e,angles){
  for(const a of angles){const dx=Math.cos(a),dy=Math.sin(a);shots.push({x:e.x+dx*0.9,y:e.y+dy*0.9,dx,dy,v:3.2,dmg:2,big:true,life:7,lob:true,from:e})}
}
function updateGiant(e,dt){
  if(!player.alive)return;
  const k=bossK(),[px,py]=rpos(player);
  if(e.stream>0){e.streamT-=dt;if(e.streamT<=0){e.stream--;e.streamT=STREAM_GAP;
      giantFire(e,[e.streamA+(Math.random()-0.5)*0.16]);if(e.stream%3===0)deathCast(0.3)}return}
  if(e.burst>0){e.burstT-=dt;if(e.burstT<=0){e.burst--;e.burstT=0.45;
      giantFire(e,[giantAim(e,px,py)]);deathCast(0.5)}return}
  if(e.windup>0){e.windup-=dt;
    if(e.windup<=0){const a0=giantAim(e,px,py),pat=e.pat++%3;
      if(STREAM_FIRE_LEVELS.has(level)){e.stream=STREAM_N;e.streamT=0;e.streamA=a0}
      else if(pat===0)giantFire(e,[-1,0,1].map(i=>a0+i*0.2));
      else if(pat===1){e.burst=3;e.burstT=0}
      else giantFire(e,[-2,-1,0,1,2].map(i=>a0+i*0.14));
      deathCast(1);shake=Math.max(shake,STREAM_FIRE_LEVELS.has(level)?0.04:0.2);// level 50: four Deaths fire non-stop, so only a faint tremor
      e.cd=Math.max(1.4,2.6-0.25*(k-1))*(0.85+Math.random()*0.3)}
    return}
  const open=OPEN_FIRE_LEVELS.has(level),myD=Math.hypot(px-e.x,py-e.y),sees=open||myD<=GIANT_SIGHT;e.sees=sees;
  const other=!open&&enemies.some(o=>o!==e&&o.type==='giant'&&!o.dead&&!(o.dying>0)&&Math.hypot(px-o.x,py-o.y)<myD-2);
  e.cd-=dt*(other?0.35:1);
  if(e.cd<=0&&sees){e.windup=0.9;deathGrowl();return}
  if(e.cd<0)e.cd=0;
}
function updateIdol(e,dt){
  if(!player.alive)return;
  if(e.windup>0){e.windup-=dt;
    if(e.windup<=0){e.shots++;const [px,py]=rpos(player),a0=Math.atan2(py-e.y,px-e.x);
      const dirs=[];
      if(e.shots%3===0){for(let i=0;i<8;i++)dirs.push(i/8*Math.PI*2+Math.PI/8)}
      else{const n=e.shots%3===1?5:3,sp=0.28;for(let i=0;i<n;i++)dirs.push(a0+(i-(n-1)/2)*sp)}
      for(const a of dirs){const dx=Math.cos(a),dy=Math.sin(a);shots.push({x:e.x+dx*0.45,y:e.y+0.15+dy*0.45,dx,dy,v:3.8,dmg:2,big:true,life:6,lob:true,from:e})}
      tone(140,0.3,'sawtooth',0.07,-60);shake=Math.max(shake,0.12);
      e.cd=Math.max(1.8,3.4-0.3*bossK())*(0.85+Math.random()*0.3)}
    return}
  e.cd-=dt;if(e.cd<=0){e.windup=0.85;tone(90,0.6,'square',0.03,40)}
}
function updateShots(dt){
  const [px,py]=rpos(player);
  for(const b of shots){
    b.x+=b.dx*b.v*dt;b.y+=b.dy*b.v*dt;b.life-=dt;
    const cx=Math.round(b.x),cy=Math.round(b.y);
    const pillar=b.lob&&inB(cx,cy)&&(grid[cy][cx]===WALL||(grid[cy][cx]===CRATE&&OPEN_FIRE_LEVELS.has(level)))&&cx>0&&cy>0&&cx<COLS-1&&cy<ROWS-1;
    if(!inB(cx,cy)||(grid[cy][cx]!==EMPTY&&!pillar)||b.life<=0){b.dead=true;burst(b.x-.5,b.y-.5,'#ff8a3d',6,2,0.06);continue}
    if(enemies.some(e=>e!==b.from&&e.type!=='giant'&&!(e.type==='lies'&&e.vanish>0.25)&&Math.hypot(b.x-rpos(e)[0],b.y-rpos(e)[1])<0.45)){b.dead=true;burst(b.x-.5,b.y-.5,'#d8d4c0',6,2,0.06);continue}
    if(player.alive&&Math.hypot(b.x-px,b.y-py)<0.5){b.dead=true;burst(b.x-.5,b.y-.5,'#ffd36b',8,2.5,0.07);if(b.red&&player.hurtT>0&&player.shield<=0)player.hurtT=0;hurtPlayer(b.dmg)}
  }
  shots=shots.filter(b=>!b.dead);
}
// A spinning, spiky fire star: red points, orange middle, yellow core, with a short trail (no blur glow: too costly).
function starPath(cx,cy,R,rot,n,inner){ctx.beginPath();
  for(let i=0;i<n*2;i++){const a=rot+i*Math.PI/n,rr=i%2?R*inner:R*(i%4===0?1:0.86);i?ctx.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):ctx.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}ctx.closePath()}
function drawFireStar(b,cx,cy,R){
  const rot=time*7*(b.dx>=0?1:-1)+b.x*1.7+b.y*1.3;ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(let i=3;i>=1;i--){ctx.fillStyle=`rgba(255,${80+i*30},20,${0.14*(4-i)})`;ctx.beginPath();ctx.arc(cx-b.dx*S*0.16*i,cy-b.dy*S*0.16*i,R*(0.55-i*0.1),0,Math.PI*2);ctx.fill()}
  ctx.globalCompositeOperation='source-over';
  starPath(cx,cy,R,rot,5,0.42);ctx.fillStyle='#e8301c';ctx.fill();
  ctx.lineWidth=Math.max(1,S*0.02);ctx.strokeStyle='rgba(110,12,4,.85)';ctx.stroke();
  starPath(cx,cy,R*0.68,rot+0.3,5,0.5);ctx.fillStyle='#ff8a1c';ctx.fill();
  starPath(cx,cy,R*0.38,rot+0.6,5,0.55);ctx.fillStyle='#ffe45a';ctx.fill();
  ctx.fillStyle='#fffbe0';ctx.beginPath();ctx.arc(cx,cy,R*0.12,0,Math.PI*2);ctx.fill();
  ctx.restore()}
function drawShots(){
  for(const b of shots){const cx=(b.x+.5)*S,cy=(b.y+.5)*S,r=S*(b.big?0.2:0.15);
    if(b.pellet){ctx.save();
      for(let i=1;i<=3;i++){ctx.fillStyle=`rgba(200,196,170,${0.22-i*0.06})`;ctx.beginPath();ctx.arc(cx-b.dx*S*0.13*i,cy-b.dy*S*0.13*i,S*0.075*(1-i*0.15),0,Math.PI*2);ctx.fill()}
      ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.14,S*0.07,S*0.03,0,0,Math.PI*2);ctx.fill();
      const g=ctx.createRadialGradient(cx-S*0.03,cy-S*0.03,0,cx,cy,S*0.09);if(b.cyan){g.addColorStop(0,'#ecfff6');g.addColorStop(0.45,'#3fe0bc');g.addColorStop(1,'#0a4a3c')}else if(b.red){g.addColorStop(0,'#ffe0e0');g.addColorStop(0.45,'#e04a5a');g.addColorStop(1,'#5a1020')}else{g.addColorStop(0,'#f4f1e2');g.addColorStop(0.45,'#9a9682');g.addColorStop(1,'#3e3c32')}
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,S*0.09,0,Math.PI*2);ctx.fill();ctx.restore();continue}
    if(b.lob&&b.from&&b.from.type==='giant'){drawFireStar(b,cx,cy,S*0.27);continue}
    if(b.lob){ctx.save();const R0=S*0.19,pu=1+0.1*Math.sin(time*14+b.x*3);
      for(let i=4;i>=1;i--){ctx.fillStyle=`rgba(60,10,30,${0.13*(5-i)})`;ctx.beginPath();ctx.arc(cx-b.dx*S*0.17*i,cy-b.dy*S*0.17*i,R0*(1-i*0.15),0,Math.PI*2);ctx.fill()}
      ctx.shadowColor='rgba(200,20,60,.9)';ctx.shadowBlur=S*0.25;
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R0*pu);g.addColorStop(0,'#1a0610');g.addColorStop(0.6,'#4a0c22');g.addColorStop(0.85,'#c0183c');g.addColorStop(1,'rgba(220,30,70,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R0*pu,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='rgba(255,90,120,.85)';for(const sd of[-1,1]){ctx.beginPath();ctx.arc(cx+sd*R0*0.3,cy-R0*0.1,R0*0.12,0,Math.PI*2);ctx.fill()}
      ctx.restore();continue}
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=3;i>=1;i--){ctx.fillStyle=`rgba(255,${90+i*25},30,${0.18*(4-i)})`;ctx.beginPath();ctx.arc(cx-b.dx*S*0.16*i,cy-b.dy*S*0.16*i,r*(1-i*0.18),0,Math.PI*2);ctx.fill()}
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.6);g.addColorStop(0,'#fffbe0');g.addColorStop(0.35,'#ffd04a');g.addColorStop(0.7,'#ff6a1c');g.addColorStop(1,'rgba(255,60,20,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r*1.6,0,Math.PI*2);ctx.fill();ctx.restore()}
}
function updateLies(e,dt){
  if(e.vanish>0){const was=e.vanish;e.vanish-=dt;
    if(was>0.5&&e.vanish<=0.5&&player.alive){const [px,py]=occ(player),c=[];
      if(enemies.some(o=>o!==e&&o.type==='lies'&&Math.abs(o.x-px)+Math.abs(o.y-py)<=5)||nearPlayer('wisp',5)){e.vanish=0;e.tpT=2+Math.random()*2;return true}
      for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){const d=Math.abs(x-px)+Math.abs(y-py);
        if(d>=4&&d<=6&&grid[y][x]===EMPTY&&tunnelAt(x,y)<0&&flameT[y][x]<=0&&!danger[y][x]&&!enemyAt(x,y,e))c.push([x,y])}
      if(c.length){const [x,y]=c[rand(c.length)];e.x=e.tx=x;e.y=e.ty=y;e.moving=false;e.prog=0;tone(900,0.15,'sine',0.03,-500)}}
    if(e.vanish<0)e.vanish=0;return true}
  e.tpT-=dt;if(e.tpT<=0&&!e.moving){e.tpT=10+Math.random()*5;e.vanish=1;return true}
  return false;
}
// Level 50: a line of frogs sitting still in one column presses together towards its middle, so they
// touch. Only the drawing moves (e.sqy, in squares); their real squares stay put for biting and blocking.
const SQUEEZE_LEVELS=new Set([50]),SQUEEZE_GAP=0.58;
function squeezeFrogs(dt){
  const still=enemies.filter(e=>e.type==='greed'&&!e.moving&&!(e.dying>0)),at=new Map(),want=new Map();
  for(const e of still)at.set(key(e.x,e.y),e);
  for(const e of still){if(at.has(key(e.x,e.y-1)))continue;const run=[e];
    while(at.has(key(e.x,e.y+run.length)))run.push(at.get(key(e.x,e.y+run.length)));
    if(run.length>1)run.forEach((f,i)=>want.set(f,(i-(run.length-1)/2)*(SQUEEZE_GAP-1)))}
  for(const e of enemies)if(e.type==='greed'){const t=want.get(e)||0;e.sqy=(e.sqy||0)+(t-(e.sqy||0))*Math.min(1,dt*(t?4:10))}
}
function updateEnemies(dt){
  if(SQUEEZE_LEVELS.has(level))squeezeFrogs(dt);
  for(const e of enemies){
    if(e.dying>0){e.dying-=dt;if(e.dying<=0)e.dead=true;continue}
    e.lean=(e.lean||0)+(((e.leanOn&&!e.moving)?0.26:0)-(e.lean||0))*Math.min(1,dt*5);// heavy: slides up slowly, no bounce
    e.wob+=dt;if(e.inv>0)e.inv-=dt;
    if(extraT>0){e.ltT-=dt;if(e.ltT<=0){e.ltT=2.5;e.letter=pickLetter()}}
    if(grace>0)continue;
    if(e.type==='giant'){updateGiant(e,dt);continue}
    if(e.type==='idol'){updateIdol(e,dt);continue}
    if(e.fleeT>0)e.fleeT-=dt;
    if(e.type==='lies'&&extraT<=0&&updateLies(e,dt))continue;
    if(updateShooter(e,dt))continue;
    if(e.type==='murder'&&extraT<=0&&!e.moving){
      if(e.rest>0){e.rest-=dt;continue}
      if(!(e.flyN>0)&&player.alive){const a=lineOfFire(e,99);
        if(a&&(a[0]===e.dx&&a[1]===e.dy||a[0]===-e.dx&&a[1]===-e.dy||!(e.dx||e.dy))){const [px,py]=occ(player);
          e.dx=a[0];e.dy=a[1];e.flyN=Math.abs(px-e.x)+Math.abs(py-e.y)+2;e.flying=true;e.idle=0;
          if(ac&&!muted&&noiseBuf)noiseHit(ac.currentTime,0.5,'bandpass',600,2600,0.12,1.5);tone(260,0.3,'sawtooth',0.035,300)}}
      if(e.flyN>0){const nx=e.x+e.dx,ny=e.y+e.dy;
        if(blocked(nx,ny,false)||enemyAt(nx,ny,e)||bombAt(nx,ny)){e.flyN=0;e.flying=false;e.rest=0.8;shake=Math.max(shake,0.08);continue}
        e.flyN--;e.tx=nx;e.ty=ny;e.prog=0;e.moving=true;continue}
      if(e.flying){e.flying=false;e.rest=0.8}
    }
    if(e.type==='greed'&&e.biting&&!e.moving)continue;
    if(!e.moving&&e.idle>0){e.idle-=dt;continue}
    if(!e.moving){const d=choose(e);
      if(d){e.dx=d[0];e.dy=d[1];e.tx=e.x+d[0];e.ty=e.y+d[1];e.prog=0;e.moving=true}}
    else{e.prog+=(extraT>0?Math.min(e.speed,1.5):e.flying?8:e.speed*(e.rush?1.5:1))*dt;if(e.prog>=1){e.x=e.tx;e.y=e.ty;e.moving=false;e.prog=0;enemyArrive(e)}}
  }
}
function checkHits(){
  for(const e of enemies){if(e.type!=='giant'||e.inv>0)continue;let hit=false;
    for(let y=Math.floor(e.y-0.6);y<=Math.ceil(e.y+0.6);y++)for(let x=Math.floor(e.x-0.6);x<=Math.ceil(e.x+0.6);x++)
      if(inB(x,y)&&flameT[y][x]>0&&Math.abs(x-e.x)<=1.05&&Math.abs(y-e.y)<=1.05)hit=true;
    if(hit){e.hp--;e.inv=0.7;sfx.hurt();shake=Math.max(shake,0.15);
      if(e.hp<=0){e.dead=true;score+=ETYPES.giant.pts;sfx.kill();for(let i=0;i<4;i++)burst(e.x+(i%2-.5),e.y+(i>>1)-.5,i%2?'#ff7a1c':'#ffd36b',22,4.5,0.12);floatText(e.x,e.y,'+'+ETYPES.giant.pts);shake=0.5}}}
  for(const e of enemies){if(e.type==='giant'||e.dying>0)continue;const [cx,cy]=occ(e);
    const big=(e.type==='skitter'||e.type==='lion')&&e.moving;
    let burning=flameT[cy][cx]>0||(big&&(flameT[e.y][e.x]>0||flameT[e.ty][e.tx]>0));
    if(!burning&&(e.type==='doubt'||e.type==='skitter')){const [rx,ry]=rpos(e),h=0.62;
      for(let y=Math.round(ry-h);y<=Math.round(ry+h)&&!burning;y++)for(let x=Math.round(rx-h);x<=Math.round(rx+h);x++)
        if(inB(x,y)&&flameT[y][x]>0&&Math.abs(x-rx)<0.5+h&&Math.abs(y-ry)<0.5+h){
          const ox=Math.abs(x-rx)>=0.5,oy=Math.abs(y-ry)>=0.5,k=flameK[y][x];
          const vert=k==='v'||k==='eU'||k==='eD',horz=k==='h'||k==='eL'||k==='eR';
          if((!ox&&!oy)||(ox&&!oy&&vert)||(oy&&!ox&&horz)){burning=true;break}}}
    if(burning&&e.inv<=0&&!(e.type==='lies'&&e.vanish>0.25))damageEnemy(e)}
  const before=enemies.length;enemies=enemies.filter(e=>!e.dead);
  if(before!==enemies.length){hud();if(!enemies.length&&!openedSfx){openedSfx=true;sfx.open()}}
  if(player.alive){
    const [px,py]=occ(player);if(hot(px,py))hurtPlayer(flameD[py][px],true);
    const [rx,ry]=rpos(player);
    greedBites(curDt);
    for(const e of enemies){if(e.dying>0||e.type==='greed'||(e.type==='lies'&&e.vanish>0.25))continue;const [ex,ey]=rpos(e);if(Math.hypot(ex-rx,ey-ry)<(e.type==='giant'?1.25:0.62)){
      if(e.type==='giant'){if(player.shield<=0&&extraT<=0){player.hp=0;sfx.hurt();shake=0.4;hud();killPlayer();return}continue}
      const vul=player.hurtT<=0&&player.shield<=0;hurtPlayer(extraT>0?1:ETYPES[e.type].dmg);
      if(vul&&e.type==='theft'&&extraT<=0&&player.bombs>1){player.bombs--;e.lamps++;e.fleeT=3;floatText(rx,ry-0.4,'Lamp stolen!','#c0c8d8');hud()}
      break}}
  }
}

/* ---------- loop ---------- */
let curDt=1/60;
function update(dt){
  curDt=dt;
  if(grace>0)grace-=dt;if(banner>0)banner-=dt;if(savedFlash>0&&banner<=0)savedFlash-=dt;if(extraBanner>0)extraBanner-=dt;
  letterTick+=dt;const adv=letterTick>=2.5;if(adv)letterTick=0;
  for(const k in items){const it=items[k];it.life-=dt;if(adv&&it.type==='letter')it.letter=LETTERS[(LETTERS.indexOf(it.letter)+1)%5];
    if(it.life<=0){delete items[k];const [x,y]=k.split(',').map(Number);burst(x,y,it.type==='letter'?(LCOL[it.letter]||'#fff'):ITEMS[it.type].col,8,1.5,0.06);tone(260,0.08,'triangle',0.03,-120)}}
  {const onBoard=new Set();for(const k in items)if(items[k].type==='letter')onBoard.add(items[k].letter);
    for(const sp of $('extraRow').children)sp.classList.toggle('avail',onBoard.has(sp.textContent))}
  if(extraT>0){extraT-=dt;if(extraT<=0){extraT=0;floatText(player.x,player.y,'Extra game over','#c46bff');hud()}}
  for(const row of flameT)for(let i=0;i<COLS;i++)if(row[i]>0)row[i]-=dt;
  updateBombs(dt);updateMelts(dt);computeDanger();updatePlayer(dt);
  if(state!=='play')return;
  if(bombHeld&&player.alive&&!player.moving)placeBomb();
  updateTrumpet(dt);updateEnemies(dt);updateShots(dt);checkHits();updateParticles(dt);
  const p=player;
  if(p.alive&&!enemies.length){const before=Math.ceil(END_TIME-endWait);endWait+=dt;const now=Math.ceil(END_TIME-endWait);
    if(now!==before&&now>0)tone(now<=2?1000:760,0.07,'square',0.04);
    if(endWait>END_TIME)levelClear()}
}
// Lag meter (G): frame times in the corner. Red bars are frames over 25ms (hiccups); a purple mark means the
// Pilgrim stood still while a direction key was held and the way was open (a stop with no reason).
let lagOn=false,lagCv=null,lagT=[],lagStats={worst:0,freezes:0,stops:0};
function toggleLag(){lagOn=!lagOn;
  if(!lagCv){lagCv=document.createElement('canvas');lagCv.width=480;lagCv.height=150;
    Object.assign(lagCv.style,{position:'fixed',left:'8px',bottom:'8px',width:'240px',height:'75px',zIndex:50,pointerEvents:'none',borderRadius:'4px'});document.body.appendChild(lagCv)}
  lagCv.hidden=!lagOn;lagT=[];lagStats={worst:0,freezes:0,stops:0}}
function lagSample(raw){
  const p=player;let stop=false;
  if(state==='play'&&!introOpen&&p&&p.alive&&!p.moving&&held.length){const d=curDir(),[dx,dy]=DIRS[d];
    stop=!blocked(p.x+dx,p.y+dy,false)&&!(p.stay&&p.stay.includes(d))}
  if(raw>0){lagT.push([raw,stop]);if(lagT.length>120)lagT.shift();lagStats.worst=Math.max(lagStats.worst,raw);if(raw>25)lagStats.freezes++}
  if(stop)lagStats.stops++;
  const c=lagCv.getContext('2d'),W=480,H=150,top=40;c.clearRect(0,0,W,H);c.fillStyle='rgba(10,8,16,.8)';c.fillRect(0,0,W,H);
  const y=ms=>H-Math.min(ms,100)/100*(H-top);
  c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1;for(const ms of [16.7,33.3]){c.beginPath();c.moveTo(0,y(ms));c.lineTo(W,y(ms));c.stroke()}
  lagT.forEach(([ms,st],i)=>{const x=i*4;c.fillStyle=ms>25?'#ff4d5e':'#5fe0c8';c.fillRect(x,y(ms),3,H-y(ms));if(st){c.fillStyle='#c46bff';c.fillRect(x,top-6,3,6)}});
  c.fillStyle='#f4ead8';c.font='20px monospace';c.textBaseline='top';
  c.fillText(`worst ${lagStats.worst.toFixed(0)}ms  hiccups ${lagStats.freezes}  stops ${lagStats.stops}`,10,8)}
function frame(ts){
  // After a hiccup the game catches up to 0.1s, in steps of at most 0.05s, so the Pilgrim doesn't seem to stop.
  const raw=last?ts-last:0,dt=Math.min(0.1,raw/1000);last=ts;time+=dt;
  if(shake>0)shake-=dt;
  if(state==='play'&&!introOpen){const n=Math.ceil(dt/0.05)||1;for(let i=0;i<n&&state==='play';i++)update(dt/n)}
  if(lagOn)lagSample(raw);
  else if(state==='finale'){const was=finaleT;finaleT+=dt;
    if(was<4&&finaleT>=4)[523,659,784,1046,1318].forEach((f,i)=>tone(f,0.5,'triangle',0.05,0,i*0.13));
    if(was<7.5&&finaleT>=7.5){tone(98,1.4,'sawtooth',0.04,-30);tone(147,1.2,'sine',0.03,-40,0.3)}}
  if(state==='clear'){clearT+=dt;updateParticles(dt);
    for(const row of flameT)for(let i=0;i<COLS;i++)if(row[i]>0)row[i]-=dt;
    if(clearT>3.3&&!clearSwitched&&clearLevel===FINAL_LEVEL){clearSwitched=true;startFinale()}
    if(clearT>3.3&&!clearSwitched){clearSwitched=true;clearLevel=level;level++;startLevel();banner=0}
    if(clearT>5.5&&state==='clear'){state='play';banner=0;saveProgress();checkIntros()}}
  // Celebration pose: the arm goes up only while the Pilgrim stands still (after a short moment), and comes
  // down smoothly as soon as he runs again.
  if(player){player.stillT=player.moving?0:(player.stillT||0)+dt;
    const want=player.alive&&player.stillT>0.2&&((state==='play'&&enemies&&!enemies.length)||(state==='clear'&&!clearSwitched))?1:0;
    player.cheer=(player.cheer||0)+(want-(player.cheer||0))*Math.min(1,dt*(want?5:12))}
  musicTick();tickIntro(dt);if(player&&player.fastT>0&&Math.ceil(player.fastT)!==player.fastShown){player.fastShown=Math.ceil(player.fastT);hud()}
  document.documentElement.classList.toggle('nocur',(state==='play'||state==='clear')&&performance.now()-lastMouse>1500);
  draw();requestAnimationFrame(frame);
}

/* ---------- drawing ---------- */
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
const theme=()=>isBoss()?themeFor(level-1):themeFor(level);
const crateCache={};
function crateArt(T,v){
  const p=S*0.06,w=S-2*p,r=S*0.07,X=p,Y=p;
  ctx.fillStyle='rgba(0,0,0,.28)';rr(X+S*0.035,Y+S*0.05,w,w,r);ctx.fill();
  if(T.st==='x'){
    const base=T.c,dark=T.cs;
    let g=ctx.createLinearGradient(X,Y,X+w,Y+w);g.addColorStop(0,shade(base,0.18));g.addColorStop(1,shade(base,-0.28));
    ctx.fillStyle=g;rr(X,Y,w,w,r);ctx.fill();
    const f=w*0.15,ix=X+f,iy=Y+f,iw=w-2*f;
    const tints=[0.06,-0.06,0.02];
    for(let i=0;i<3;i++){const py=iy+i*iw/3;g=ctx.createLinearGradient(ix,py,ix,py+iw/3);
      g.addColorStop(0,shade(base,tints[(i+v)%3]+0.04));g.addColorStop(1,shade(base,tints[(i+v)%3]-0.1));ctx.fillStyle=g;ctx.fillRect(ix,py,iw,iw/3)}
    ctx.strokeStyle=shade(dark,-0.1);ctx.globalAlpha=0.55;ctx.lineWidth=Math.max(1,S*0.022);
    ctx.beginPath();ctx.moveTo(ix,iy+iw/3);ctx.lineTo(ix+iw,iy+iw/3);ctx.moveTo(ix,iy+2*iw/3);ctx.lineTo(ix+iw,iy+2*iw/3);ctx.stroke();
    ctx.globalAlpha=0.22;ctx.lineWidth=Math.max(0.8,S*0.012);
    for(let i=0;i<3;i++){const py=iy+i*iw/3+iw/6;ctx.beginPath();ctx.moveTo(ix+iw*0.05,py-iw*0.03);
      ctx.bezierCurveTo(ix+iw*0.35,py+iw*0.04*(v?1:-1),ix+iw*0.6,py-iw*0.05,ix+iw*0.95,py+iw*0.02);ctx.stroke()}
    ctx.globalAlpha=1;
    ctx.save();ctx.beginPath();ctx.rect(ix,iy,iw,iw);ctx.clip();
    const bw=iw*0.2,[x0,y0,x1,y1]=v?[ix,iy,ix+iw,iy+iw]:[ix,iy+iw,ix+iw,iy];
    const ang=Math.atan2(y1-y0,x1-x0),len=Math.hypot(x1-x0,y1-y0);
    ctx.translate(x0,y0);ctx.rotate(ang);
    g=ctx.createLinearGradient(0,-bw/2,0,bw/2);g.addColorStop(0,shade(base,0.22));g.addColorStop(1,shade(base,-0.18));
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(-bw,-bw/2+S*0.03,len+2*bw,bw);
    ctx.fillStyle=g;ctx.fillRect(-bw,-bw/2,len+2*bw,bw);
    ctx.strokeStyle=shade(dark,-0.05);ctx.globalAlpha=0.6;ctx.lineWidth=Math.max(1,S*0.016);ctx.strokeRect(-bw,-bw/2,len+2*bw,bw);ctx.globalAlpha=1;
    ctx.restore();
    ctx.strokeStyle=shade(dark,-0.2);ctx.lineWidth=Math.max(1,S*0.025);ctx.strokeRect(ix,iy,iw,iw);
    ctx.lineWidth=Math.max(1,S*0.03);rr(X,Y,w,w,r);ctx.strokeStyle=shade(dark,-0.25);ctx.stroke();
    ctx.fillStyle='rgba(255,240,210,.35)';ctx.fillRect(X+r*0.6,Y+S*0.02,w-r*1.2,S*0.025);ctx.fillRect(X+S*0.02,Y+r*0.6,S*0.025,w-r*1.2);
    for(const [nx,ny] of [[X+f/2,Y+f/2],[X+w-f/2,Y+f/2],[X+f/2,Y+w-f/2],[X+w-f/2,Y+w-f/2]]){
      ctx.fillStyle='#3a2a1c';ctx.beginPath();ctx.arc(nx,ny,S*0.028,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(nx-S*0.009,ny-S*0.009,S*0.011,0,Math.PI*2);ctx.fill()}
  }else if(T.st==='ice'){
    let g=ctx.createLinearGradient(X,Y,X+w,Y+w);g.addColorStop(0,shade(T.c,0.45));g.addColorStop(0.5,T.c);g.addColorStop(1,shade(T.cs,-0.15));
    ctx.fillStyle=g;rr(X,Y,w,w,r*1.3);ctx.fill();
    const k=w*0.16;ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.moveTo(X+r,Y);ctx.lineTo(X+w-r,Y);ctx.lineTo(X+w-k,Y+k);ctx.lineTo(X+k,Y+k);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(X,Y+r);ctx.lineTo(X+k,Y+k);ctx.lineTo(X+k,Y+w-k);ctx.lineTo(X,Y+w-r);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(0,20,60,.18)';ctx.beginPath();ctx.moveTo(X+w,Y+r);ctx.lineTo(X+w,Y+w-r);ctx.lineTo(X+w-k,Y+w-k);ctx.lineTo(X+w-k,Y+k);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(X+r,Y+w);ctx.lineTo(X+w-r,Y+w);ctx.lineTo(X+w-k,Y+w-k);ctx.lineTo(X+k,Y+w-k);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=Math.max(1,S*0.018);ctx.beginPath();
    const cx=X+w*(v?0.62:0.4),cy=Y+w*0.55;ctx.moveTo(cx,cy);ctx.lineTo(cx-w*0.2,cy-w*0.18);ctx.moveTo(cx,cy);ctx.lineTo(cx+w*0.18,cy-w*0.1);ctx.moveTo(cx,cy);ctx.lineTo(cx+w*0.05,cy+w*0.22);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.moveTo(X+k*1.2,Y+w*0.5);ctx.lineTo(X+w*0.5,Y+k*1.2);ctx.lineTo(X+w*0.6,Y+k*1.2);ctx.lineTo(X+k*1.2,Y+w*0.6);ctx.fill();
    ctx.strokeStyle=shade(T.cs,-0.2);ctx.lineWidth=Math.max(1,S*0.025);rr(X,Y,w,w,r*1.3);ctx.stroke();
  }else if(T.st==='rivet'){
    let g=ctx.createLinearGradient(X,Y,X,Y+w);g.addColorStop(0,shade(T.c,0.3));g.addColorStop(0.5,T.c);g.addColorStop(1,shade(T.c,-0.35));
    ctx.fillStyle=g;rr(X,Y,w,w,r);ctx.fill();
    const k=w*0.12;g=ctx.createLinearGradient(X,Y+k,X,Y+w-k);g.addColorStop(0,shade(T.c,-0.1));g.addColorStop(1,shade(T.c,0.15));ctx.fillStyle=g;ctx.fillRect(X+k,Y+k,w-2*k,w-2*k);
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(X+k,Y+w*0.44,w-2*k,w*0.12);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(X+k,Y+w*0.44,w-2*k,w*0.025);
    for(const [a2,b2] of [[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const nx=X+w*a2,ny=Y+w*b2;
      ctx.fillStyle='#2a2a32';ctx.beginPath();ctx.arc(nx+S*0.008,ny+S*0.01,S*0.045,0,Math.PI*2);ctx.fill();
      g=ctx.createRadialGradient(nx-S*0.015,ny-S*0.015,0,nx,ny,S*0.045);g.addColorStop(0,'#f2f2f6');g.addColorStop(1,'#7a7a86');ctx.fillStyle=g;ctx.beginPath();ctx.arc(nx,ny,S*0.04,0,Math.PI*2);ctx.fill()}
    ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=Math.max(1,S*0.025);rr(X,Y,w,w,r);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(X+r,Y+S*0.015,w-2*r,S*0.02);
  }else{
    let g=ctx.createLinearGradient(X,Y,X+w,Y+w);g.addColorStop(0,shade(T.c,0.25));g.addColorStop(1,shade(T.c,-0.3));
    ctx.fillStyle=g;rr(X,Y,w,w,r);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=Math.max(1,S*0.025);rr(X,Y,w,w,r);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(X+r,Y+S*0.015,w-2*r,S*0.02);
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=Math.max(1,S*0.015);for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(X+w*0.18,Y+w*i/4);ctx.lineTo(X+w*0.82,Y+w*i/4);ctx.stroke()}
  }
}
function drawCrate(X,Y,T,v=0){
  const key=T.name+'|'+S+'|'+DPR+'|'+v;let c=crateCache[key];
  if(!c){c=document.createElement('canvas');c.width=Math.ceil(S*DPR);c.height=Math.ceil(S*DPR);
    const oc=ctx;ctx=c.getContext('2d');ctx.scale(DPR,DPR);try{crateArt(T,v)}finally{ctx=oc}crateCache[key]=c}
  ctx.drawImage(c,X,Y,S,S);
  if(T.st==='neon'){const g=0.6+0.4*Math.sin(time*3+X*0.01);ctx.save();ctx.strokeStyle=T.cs;ctx.globalAlpha=g;ctx.shadowColor=T.cs;ctx.shadowBlur=S*0.15;ctx.lineWidth=Math.max(1,S*0.04);
    rr(X+S*0.25,Y+S*0.25,S*0.5,S*0.5,S*0.05);ctx.stroke();ctx.restore()}
}
function drawTunnel(cx,cy,i){const R0=S*0.42;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(cx+S*0.03,cy+S*0.05,R0,0,Math.PI*2);ctx.fill();
  let g=ctx.createLinearGradient(cx-R0,cy-R0,cx+R0,cy+R0);g.addColorStop(0,'#dfe8f0');g.addColorStop(1,'#6f7f90');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R0,0,Math.PI*2);ctx.fill();
  g=ctx.createRadialGradient(cx,cy,0,cx,cy,R0*0.78);g.addColorStop(0,'#03121c');g.addColorStop(0.7,'#0a3550');g.addColorStop(1,'#3fc8ff');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R0*0.76,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(140,235,255,.8)';ctx.lineWidth=Math.max(1.2,S*0.03);for(let k=0;k<3;k++){const a=time*2.2+k*2.09;ctx.beginPath();ctx.arc(cx,cy,R0*(0.3+k*0.14),a,a+Math.PI*0.9);ctx.stroke()}
  for(let k=0;k<6;k++){const a=k*Math.PI/3+0.3;ctx.fillStyle='#3a4552';ctx.beginPath();ctx.arc(cx+Math.cos(a)*R0*0.88,cy+Math.sin(a)*R0*0.88,S*0.025,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font=`700 ${S*0.2}px "Chakra Petch", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),cx+R0*0.68,cy-R0*0.68);
  ctx.restore()}
function drawTilesStatic(){
  const T=theme();
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const X=x*S,Y=y*S,c=grid[y][x];
    ctx.fillStyle=T.f[(x+y)%2];ctx.fillRect(X,Y,S,S);
    if(T.grass&&c===EMPTY){const h=(x*73+y*151)%17;
      if(h<9){ctx.strokeStyle='rgba(30,90,20,.45)';ctx.lineWidth=Math.max(1,S*0.03);ctx.lineCap='round';const gx=X+S*(0.2+(h%5)*0.14),gy=Y+S*(0.35+(h%3)*0.2);
        ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx-S*0.05,gy-S*0.1);ctx.moveTo(gx,gy);ctx.lineTo(gx,gy-S*0.13);ctx.moveTo(gx,gy);ctx.lineTo(gx+S*0.05,gy-S*0.1);ctx.stroke()}
      if(h===3||h===11){ctx.fillStyle=h===3?'#fff7d6':'#ffd84a';const fx=X+S*0.7,fy=Y+S*0.72;for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ctx.beginPath();ctx.arc(fx+Math.cos(a)*S*0.045,fy+Math.sin(a)*S*0.045,S*0.035,0,Math.PI*2);ctx.fill()}
        ctx.fillStyle=h===3?'#ffcf3a':'#d0801a';ctx.beginPath();ctx.arc(fx,fy,S*0.03,0,Math.PI*2);ctx.fill()}}
    if(false){ctx.lineWidth=Math.max(1,S*0.03);
      ctx.beginPath();ctx.moveTo(X+S*0.2,Y+S*0.3);ctx.lineTo(X+S*0.45,Y+S*0.5);ctx.lineTo(X+S*0.4,Y+S*0.75);ctx.moveTo(X+S*0.45,Y+S*0.5);ctx.lineTo(X+S*0.75,Y+S*0.55);ctx.stroke()}
    if(c===WALL){
      ctx.fillStyle=T.w;ctx.fillRect(X,Y,S,S);
      ctx.fillStyle=T.hi;ctx.fillRect(X,Y,S,S*0.16);
      ctx.fillStyle=T.lo;ctx.fillRect(X,Y+S*0.86,S,S*0.14);
      ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(X+S*0.48,Y+S*0.2,S*0.05,S*0.3);ctx.fillRect(X+S*0.15,Y+S*0.55,S*0.05,S*0.28);
    }else if(c===CRATE){
      drawCrate(X,Y,T,(x*7+y*3)%2);
    }
  }
}
let tileCache=null,tileKey=[];
// The static layer is rebuilt only when the theme, size or map changes. The map check is a number hash, so it
// makes no garbage each frame (a big joined string here used to feed the garbage collector).
function gridHash(){let h=0;for(let y=0;y<ROWS;y++){const r=grid[y];for(let x=0;x<COLS;x++)h=(Math.imul(h,31)+(r[x]|0)+1)|0}return h}
function drawTiles(){
  const T=theme(),k=tileKey,h=gridHash();
  if(!tileCache||k[0]!==T||k[1]!==S||k[2]!==DPR||k[3]!==COLS||k[4]!==ROWS||k[5]!==h){tileKey=[T,S,DPR,COLS,ROWS,h];tileCache=tileCache||document.createElement('canvas');
    tileCache.width=Math.ceil(COLS*S*DPR);tileCache.height=Math.ceil(ROWS*S*DPR);
    const oc=ctx;ctx=tileCache.getContext('2d');ctx.setTransform(DPR,0,0,DPR,0,0);try{drawTilesStatic()}finally{ctx=oc}}
  ctx.drawImage(tileCache,0,0,COLS*S,ROWS*S);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const X=x*S,Y=y*S,c=grid[y][x];
    if(T.st==='rivet'&&c===EMPTY&&(x*7+y*13)%11===0){ctx.strokeStyle=`rgba(255,106,43,${0.35+0.2*Math.sin(time*2+x)})`;ctx.lineWidth=Math.max(1,S*0.03);
      ctx.beginPath();ctx.moveTo(X+S*0.2,Y+S*0.3);ctx.lineTo(X+S*0.45,Y+S*0.5);ctx.lineTo(X+S*0.4,Y+S*0.75);ctx.moveTo(X+S*0.45,Y+S*0.5);ctx.lineTo(X+S*0.75,Y+S*0.55);ctx.stroke()}}
  for(let i=0;i<tunnels.length;i++){const [x,y]=tunnels[i];if(grid[y][x]===EMPTY)drawTunnel(x*S+S/2,y*S+S/2,i)}
  if(!enemies.length&&!exit.revealed&&exit.x>=0&&grid[exit.y]&&grid[exit.y][exit.x]===CRATE){const X=exit.x*S,Y=exit.y*S;
    ctx.strokeStyle=`rgba(255,179,71,${0.5+0.5*Math.sin(time*6)})`;ctx.lineWidth=Math.max(2,S*0.08);rr(X+2,Y+2,S-4,S-4,S*0.1);ctx.stroke()}
}
const LCOL={G:'#ffd21f',R:'#ff4d5e',A:'#3fd16b',C:'#3fa2ff',E:'#c46bff'};
function drawLetterBubble(cx,cy,r,l,owned){
  const c=LCOL[l]||'#c46bff';
  ctx.save();if(owned)ctx.globalAlpha=0.55;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(cx+r*0.08,cy+r*0.14,r,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.35,r*0.1,cx,cy,r);g.addColorStop(0,'#ffffff');g.addColorStop(0.25,c);g.addColorStop(1,shade(c,-0.45));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=Math.max(1.5,r*0.1);ctx.stroke();
  ctx.font=`${r*1.25}px Bungee, Impact, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillText(l,cx+1,cy+r*0.1+2);ctx.fillStyle='#fff';ctx.fillText(l,cx,cy+r*0.1);
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.ellipse(cx-r*0.38,cy-r*0.5,r*0.22,r*0.12,-0.6,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  const f=v=>Math.round(k<0?v*(1+k):v+(255-v)*k);return `rgb(${f(r)},${f(g)},${f(b)})`}
function gooBlob(cx,cy,r,col,wob){
  const sq=1+0.05*Math.sin(wob*5),pk=Math.sin(wob*3)*r*0.12;
  ctx.fillStyle=col;ctx.beginPath();
  ctx.moveTo(cx-r*1.08,cy+r*0.82);
  ctx.bezierCurveTo(cx-r*1.05,cy-r*0.2*sq,cx-r*0.55,cy-r*0.95*sq,cx+pk,cy-r*0.98*sq);
  ctx.bezierCurveTo(cx+r*0.7,cy-r*0.92*sq,cx+r*1.1,cy-r*0.1,cx+r*1.08,cy+r*0.82);
  ctx.quadraticCurveTo(cx+r*0.5,cy+r*1.02,cx,cy+r*0.9);ctx.quadraticCurveTo(cx-r*0.5,cy+r*1.02,cx-r*1.08,cy+r*0.82);ctx.fill();
  for(const [ox,ph] of [[-0.55,0],[0.62,2.1]]){const d=(Math.sin(wob*2.4+ph)+1)*0.5;
    ctx.beginPath();ctx.ellipse(cx+ox*r,cy+r*(0.95+d*0.25),r*0.1,r*(0.12+d*0.08),0,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.ellipse(cx-r*0.45,cy-r*0.5,r*0.22,r*0.12,-0.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx,cy+r*0.8,r*0.95,r*0.14,0,0,Math.PI*2);ctx.fill();
}
function drawCloud(cx,cy,wob,tint){
  const fl=Math.sin(wob*2.2)*S*0.05,puffs=[[-0.24,0.06,0.2],[0.24,0.06,0.2],[-0.1,-0.1,0.24],[0.13,-0.08,0.22],[0,0.12,0.22]];
  ctx.save();ctx.translate(0,fl);
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.4-fl,S*0.3,S*0.07,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='rgba(170,215,255,.7)';ctx.shadowBlur=S*0.15;
  for(const [ox,oy,r] of puffs){const k=1+0.06*Math.sin(wob*4+ox*9);
    const g=ctx.createRadialGradient(cx+ox*S-r*S*0.3,cy+oy*S-r*S*0.4,r*S*0.1,cx+ox*S,cy+oy*S,r*S*k);
    g.addColorStop(0,'#ffffff');g.addColorStop(1,tint||'#cfe6fb');ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(cx+ox*S,cy+oy*S,r*S*k,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
let coinCache=null,coinKey='',coinFx=[];
function coinArt(R){const R0=R;
  const c=document.createElement('canvas'),sz=Math.ceil(R*2.3*DPR);c.width=c.height=sz;
  const g2=c.getContext('2d');g2.scale(DPR,DPR);const o=R*1.15;g2.translate(o,o);
  let g=g2.createLinearGradient(-R,-R,R,R);g.addColorStop(0,'#f6dc6a');g.addColorStop(0.5,'#e2b635');g.addColorStop(1,'#b8861c');
  g2.fillStyle=g;g2.beginPath();g2.arc(0,0,R,0,Math.PI*2);g2.fill();
  g2.strokeStyle='rgba(120,80,10,.55)';g2.lineWidth=R*0.05;g2.beginPath();g2.arc(0,0,R*0.97,0,Math.PI*2);g2.stroke();
  g=g2.createLinearGradient(-R,-R,R,R);g.addColorStop(0,'#eccb4c');g.addColorStop(1,'#d9a92a');
  g2.fillStyle=g;g2.beginPath();g2.arc(0,0,R*0.86,0,Math.PI*2);g2.fill();
  g2.strokeStyle='rgba(255,246,190,.8)';g2.lineWidth=R*0.035;g2.beginPath();g2.arc(0,0,R*0.86,Math.PI*0.75,Math.PI*1.75);g2.stroke();
  g2.strokeStyle='rgba(130,88,12,.6)';g2.beginPath();g2.arc(0,0,R*0.86,Math.PI*1.75,Math.PI*2.75);g2.stroke();
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2,x=Math.cos(a)*R*0.78,y=Math.sin(a)*R*0.78;
    g2.fillStyle='rgba(140,95,15,.55)';g2.beginPath();g2.arc(x+R*0.012,y+R*0.012,R*0.028,0,Math.PI*2);g2.fill();
    g2.fillStyle='rgba(255,240,170,.85)';g2.beginPath();g2.arc(x-R*0.008,y-R*0.008,R*0.02,0,Math.PI*2);g2.fill()}
  const hill=(ctx2)=>{ctx2.beginPath();ctx2.moveTo(-R*0.7,R*0.3);ctx2.bezierCurveTo(-R*0.35,R*0.28,-R*0.25,R*0.08,0,R*0.08);ctx2.bezierCurveTo(R*0.25,R*0.08,R*0.35,R*0.28,R*0.7,R*0.3)};
  g2.lineWidth=R*0.035;g2.strokeStyle='rgba(255,244,190,.8)';g2.save();g2.translate(-R*0.012,-R*0.012);hill(g2);g2.stroke();g2.restore();
  g2.strokeStyle='rgba(130,88,12,.65)';g2.save();g2.translate(R*0.015,R*0.015);hill(g2);g2.stroke();g2.restore();
  g2.save();g2.beginPath();g2.arc(0,0,R*0.74,0,Math.PI*2);g2.clip();hill(g2);g2.lineTo(R*0.8,R*0.9);g2.lineTo(-R*0.8,R*0.9);g2.closePath();
  g2.fillStyle='rgba(150,100,15,.14)';g2.fill();g2.restore();
  const one=(dx,dy,col)=>{g2.fillStyle=col;g2.beginPath();const R=R0*1.25;dy-=R0*0.06;
    g2.moveTo(-R*0.2+dx,-R*0.36+dy);g2.lineTo(R*0.06+dx,-R*0.52+dy);g2.lineTo(R*0.14+dx,-R*0.52+dy);g2.lineTo(R*0.14+dx,R*0.14+dy);
    g2.lineTo(R*0.27+dx,R*0.14+dy);g2.lineTo(R*0.27+dx,R*0.26+dy);g2.lineTo(-R*0.22+dx,R*0.26+dy);g2.lineTo(-R*0.22+dx,R*0.14+dy);
    g2.lineTo(-R*0.08+dx,R*0.14+dy);g2.lineTo(-R*0.08+dx,-R*0.3+dy);g2.lineTo(-R*0.2+dx,-R*0.24+dy);g2.closePath();g2.fill()};
  one(R*0.035,R*0.035,'rgba(125,82,10,.7)');one(-R*0.025,-R*0.025,'rgba(255,248,200,.9)');
  g=g2.createLinearGradient(0,-R*0.5,0,R*0.26);g.addColorStop(0,'#f2d35a');g.addColorStop(1,'#d6a42a');one(0,0,g);
  g2.fillStyle='rgba(120,80,10,.55)';g2.font=`700 ${R*0.2}px "Chakra Petch", Arial, sans-serif`;g2.textAlign='center';g2.textBaseline='middle';g2.fillText('LIGHT',R*0.01,R*0.55);
  g2.fillStyle='rgba(255,244,190,.7)';g2.fillText('LIGHT',-R*0.005,R*0.535);
  return c;
}
function drawCoins(){
  const R=S*0.3,k=S+'|'+DPR;if(coinKey!==k){coinCache=coinArt(R);coinKey=k}
  for(const ck of coins){const [x,y]=ck.split(',').map(Number);
    const cx=(x+.5)*S,cy=(y+.5)*S+Math.sin(time*2.4+x+y)*S*0.025,sx=1;
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(cx,(y+.5)*S+R*1.05,R*0.85*sx,R*0.2,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(cx,cy);ctx.scale(sx,1);
    ctx.fillStyle='#8a5a06';ctx.beginPath();ctx.arc(R*0.05,R*0.07,R,0,Math.PI*2);ctx.fill();
    ctx.drawImage(coinCache,-R*1.15,-R*1.15,R*2.3,R*2.3);
    ctx.restore()}
  for(const f of coinFx){f.t+=1/60;const k=f.t/0.55;if(k>=1)continue;
    const cx=(f.x+.5)*S,cy=(f.y+.5)*S-k*S*0.9,sx=Math.cos(k*Math.PI*5);
    ctx.save();ctx.globalAlpha=k<0.6?1:(1-k)/0.4;ctx.translate(cx,cy);ctx.scale(Math.max(0.08,Math.abs(sx)),1);
    ctx.fillStyle='#8a5a06';ctx.beginPath();ctx.arc(R*0.12,0,R,0,Math.PI*2);ctx.fill();
    ctx.drawImage(coinCache,-R*1.15,-R*1.15,R*2.3,R*2.3);
    ctx.restore()}
  coinFx=coinFx.filter(f=>f.t<0.55);
}
function drawExit(){
  if(!exit.revealed)return;
  const cx=(exit.x+.5)*S,cy=(exit.y+.5)*S,open=!enemies.length;
  ctx.fillStyle='#120d18';ctx.beginPath();ctx.arc(cx,cy,S*0.4,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=Math.max(2,S*0.08);
  if(open){
    for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(255,179,71,${0.9-i*0.25})`;ctx.beginPath();
      const a=time*3+i*2.1;ctx.arc(cx,cy,S*(0.14+i*0.08),a,a+Math.PI*1.3);ctx.stroke()}
  }else{
    ctx.strokeStyle='#5a4c74';ctx.beginPath();ctx.arc(cx,cy,S*0.36,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#5a4c74';ctx.fillRect(cx-S*0.1,cy-S*0.05,S*0.2,S*0.16);
    ctx.beginPath();ctx.arc(cx,cy-S*0.06,S*0.07,Math.PI,0);ctx.stroke();
  }
}
function drawItem(k,it){
  if(it.type==='letter'){if(it.life<3&&Math.sin(time*(it.life<1.2?40:18))>0)return;
    const [x,y]=k.split(',').map(Number),bob=Math.sin(time*3+x)*S*0.04;
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse((x+.5)*S,(y+.82)*S,S*0.22,S*0.06,0,0,Math.PI*2);ctx.fill();
    drawLetterBubble((x+.5)*S,(y+.46)*S+bob,S*0.3,it.letter,letters.has(it.letter));return}
  if(it.life<3&&Math.sin(time*(it.life<1.2?40:18))>0)return;
  const [x,y]=k.split(',').map(Number),col=ITEMS[it.type].col;
  const bob=Math.sin(time*4+x)*S*0.04,X=x*S+S*0.14,Y=y*S+S*0.14+bob,w=S*0.72;
  ctx.fillStyle='#2d2140';rr(X,Y,w,w,S*0.14);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=Math.max(1.5,S*0.06);ctx.stroke();
  const cx=X+w/2,cy=Y+w/2;ctx.fillStyle=col;ctx.strokeStyle=col;
  if(it.type==='bomb'){const b=cy+S*0.1;// a small clay oil lamp, like the one the Pilgrim sets down
    ctx.beginPath();ctx.moveTo(cx-S*0.21,b-S*0.02);ctx.quadraticCurveTo(cx,b+S*0.17,cx+S*0.21,b-S*0.02);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.ellipse(cx,b-S*0.02,S*0.21,S*0.045,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2d2140';ctx.beginPath();ctx.ellipse(cx,b-S*0.02,S*0.14,S*0.026,0,0,Math.PI*2);ctx.fill();
    const sw=Math.sin(time*8+x)*S*0.015;ctx.fillStyle='#ffd36b';flamePath(cx,b-S*0.03,S*0.075,S*0.24,sw);ctx.fill();
    ctx.fillStyle='#fff2b0';flamePath(cx,b-S*0.04,S*0.038,S*0.13,sw*0.6);ctx.fill()}
  else if(it.type==='fire'){ctx.beginPath();ctx.moveTo(cx,cy-S*0.22);
    ctx.quadraticCurveTo(cx+S*0.22,cy+S*0.02,cx,cy+S*0.2);ctx.quadraticCurveTo(cx-S*0.22,cy+S*0.02,cx,cy-S*0.22);ctx.fill()}
  else if(it.type==='trumpet'){// a ram's horn (shofar): thin mouthpiece low left, curving and flaring up to the right
    const u=S,P=[[-0.25,0.07],[0.03,0.25],[0.2,-0.15]],hw=t=>0.018+0.07*Math.pow(t,1.4);
    const pt=t=>{const a=(1-t)*(1-t),b=2*(1-t)*t,c=t*t;return[a*P[0][0]+b*P[1][0]+c*P[2][0],a*P[0][1]+b*P[1][1]+c*P[2][1]]};
    const nm=t=>{const tx=2*(1-t)*(P[1][0]-P[0][0])+2*t*(P[2][0]-P[1][0]),ty=2*(1-t)*(P[1][1]-P[0][1])+2*t*(P[2][1]-P[1][1]),l=Math.hypot(tx,ty);return[-ty/l,tx/l,tx/l,ty/l]};
    const N=16,L=[],R=[];for(let i=0;i<=N;i++){const t=i/N,[px,py]=pt(t),[nx,ny]=nm(t),w=hw(t);L.push([px+nx*w,py+ny*w]);R.push([px-nx*w,py-ny*w])}
    const hg=ctx.createLinearGradient(cx+P[0][0]*u,cy+P[0][1]*u,cx+P[2][0]*u,cy+P[2][1]*u);// dark tip, amber body, pale wide end
    hg.addColorStop(0,'#5a3519');hg.addColorStop(0.35,'#a8692f');hg.addColorStop(0.7,'#d9a35c');hg.addColorStop(1,'#f0d29a');
    ctx.fillStyle=hg;ctx.beginPath();ctx.moveTo(cx+L[0][0]*u,cy+L[0][1]*u);for(const [a,b] of L)ctx.lineTo(cx+a*u,cy+b*u);
    for(let i=R.length-1;i>=0;i--)ctx.lineTo(cx+R[i][0]*u,cy+R[i][1]*u);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(90,52,22,.55)';ctx.lineWidth=Math.max(1,u*0.02);// growth ridges across the horn
    for(const t of[0.3,0.45,0.6,0.74,0.86]){const [px,py]=pt(t),[nx,ny]=nm(t),w=hw(t)*0.9;
      ctx.beginPath();ctx.moveTo(cx+(px+nx*w)*u,cy+(py+ny*w)*u);ctx.lineTo(cx+(px-nx*w)*u,cy+(py-ny*w)*u);ctx.stroke()}
    {const [px,py]=pt(1),[,,tx,ty]=nm(1);ctx.fillStyle='#2d2140';ctx.beginPath();// the open mouth of the horn
      ctx.ellipse(cx+px*u,cy+py*u,u*0.028,u*hw(1)*0.85,Math.atan2(ty,tx),0,Math.PI*2);ctx.fill()}
    {const [px,py]=pt(0);ctx.fillStyle='#3d2410';ctx.beginPath();ctx.arc(cx+px*u,cy+py*u,u*0.024,0,Math.PI*2);ctx.fill()}
    const g=0.5+0.5*Math.sin(time*6);ctx.fillStyle=`rgba(255,240,170,${g})`;// the blast, sparkling out of the mouth
    for(const [sx,sy] of [[0.31,-0.2],[0.27,-0.3],[0.33,-0.08]]){ctx.beginPath();ctx.arc(cx+sx*u,cy+sy*u,u*0.022,0,Math.PI*2);ctx.fill()}}
  else if(it.type==='speed'){// a winged boot
    const u=S,fl=Math.sin(time*10+x)*0.08,ox=cx+u*0.03,oy=cy;
    ctx.fillStyle='#ffe7a0';for(const [a,l] of [[0.55,0.22],[0.28,0.19],[0.02,0.15]]){const an=Math.PI+a+fl;
      ctx.save();ctx.translate(ox-u*0.07,oy-u*0.07);ctx.rotate(an);ctx.beginPath();ctx.ellipse(u*l/2,0,u*l/2,u*0.042,0,0,Math.PI*2);ctx.fill();ctx.restore()}
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(ox-u*0.09,oy-u*0.19);ctx.lineTo(ox+u*0.05,oy-u*0.19);ctx.lineTo(ox+u*0.05,oy-u*0.01);
    ctx.quadraticCurveTo(ox+u*0.09,oy+u*0.04,ox+u*0.19,oy+u*0.06);ctx.quadraticCurveTo(ox+u*0.25,oy+u*0.09,ox+u*0.22,oy+u*0.15);
    ctx.lineTo(ox-u*0.11,oy+u*0.15);ctx.quadraticCurveTo(ox-u*0.13,oy+u*0.02,ox-u*0.09,oy-u*0.19);ctx.closePath();ctx.fill();
    ctx.fillStyle='#bff6ea';ctx.fillRect(ox-u*0.095,oy-u*0.19,u*0.15,u*0.045);
    ctx.strokeStyle='#2d2140';ctx.lineWidth=Math.max(1,S*0.025);ctx.beginPath();ctx.moveTo(ox-u*0.11,oy+u*0.11);ctx.lineTo(ox+u*0.23,oy+u*0.11);ctx.stroke()}
  else if(it.type==='kick'){ctx.beginPath();ctx.moveTo(cx-S*0.12,cy-S*0.2);ctx.lineTo(cx-S*0.02,cy-S*0.2);ctx.lineTo(cx-S*0.02,cy+S*0.02);
    ctx.lineTo(cx+S*0.2,cy+S*0.06);ctx.lineTo(cx+S*0.2,cy+S*0.18);ctx.lineTo(cx-S*0.12,cy+S*0.18);ctx.closePath();ctx.fill()}
  else if(it.type==='fullheal'){const hp=new Path2D(HP);
    for(const [ox,oy,k,c] of [[-0.11,-0.06,0.015,'#ff3d6e'],[0.11,-0.06,0.015,'#ff3d6e'],[0,0.04,0.019,'#ff1f5a']]){
      const sc=k*S;ctx.save();ctx.translate(cx+ox*S-12*sc,cy+oy*S-11.5*sc);ctx.scale(sc,sc);
      ctx.fillStyle=c;ctx.fill(hp);ctx.lineWidth=1.5/sc;ctx.strokeStyle='#fff';ctx.stroke(hp);ctx.restore()}
    const g=0.5+0.5*Math.sin(time*6);ctx.fillStyle=`rgba(255,240,150,${g})`;
    for(const [sx,sy] of [[-0.24,-0.22],[0.24,0.2]]){ctx.beginPath();ctx.arc(cx+sx*S,cy+sy*S,S*0.03,0,Math.PI*2);ctx.fill()}}
  else if(it.type==='quick'){ctx.beginPath();ctx.moveTo(cx+S*0.05,cy-S*0.23);ctx.lineTo(cx-S*0.13,cy+S*0.03);ctx.lineTo(cx-S*0.01,cy+S*0.03);ctx.lineTo(cx-S*0.06,cy+S*0.23);ctx.lineTo(cx+S*0.14,cy-S*0.04);ctx.lineTo(cx+S*0.02,cy-S*0.04);ctx.closePath();ctx.fill()}
  else if(it.type==='reveal'){const sp=time*1.5;ctx.lineWidth=Math.max(1.5,S*0.035);ctx.lineCap='round';
    for(let i=0;i<8;i++){const a=sp+i*Math.PI/4,r1=S*0.13,r2=S*(i%2?0.2:0.25);ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke()}
    const g=ctx.createRadialGradient(cx-S*0.03,cy-S*0.03,0,cx,cy,S*0.11);g.addColorStop(0,'#ffffff');g.addColorStop(1,col);ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,S*0.1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2d2140';ctx.beginPath();ctx.moveTo(cx,cy-S*0.05);ctx.quadraticCurveTo(cx+S*0.05,cy+S*0.02,cx,cy+S*0.06);ctx.quadraticCurveTo(cx-S*0.05,cy+S*0.02,cx,cy-S*0.05);ctx.fill()}
  else if(it.type==='heal'){const k=S*0.022;ctx.save();ctx.translate(cx-12*k,cy-11.5*k);ctx.scale(k,k);ctx.fill(new Path2D(HP));ctx.restore();
    ctx.fillStyle='#fff';ctx.fillRect(cx-S*0.025,cy-S*0.11,S*0.05,S*0.17);ctx.fillRect(cx-S*0.085,cy-S*0.05,S*0.17,S*0.05)}
  else if(it.type==='shield'){ctx.beginPath();ctx.moveTo(cx,cy-S*0.21);ctx.lineTo(cx+S*0.18,cy-S*0.13);
    ctx.quadraticCurveTo(cx+S*0.16,cy+S*0.12,cx,cy+S*0.22);ctx.quadraticCurveTo(cx-S*0.16,cy+S*0.12,cx-S*0.18,cy-S*0.13);ctx.closePath();ctx.fill()}
}
function flamePath(x,y,w,h,sway){
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.bezierCurveTo(x-w*1.05,y-h*0.25,x-w*0.55+sway*0.4,y-h*0.7,x+sway,y-h);
  ctx.bezierCurveTo(x+w*0.55+sway*0.4,y-h*0.7,x+w*1.05,y-h*0.25,x,y);ctx.closePath();
}
function drawBomb(b){
  const off=b.slide?b.sp:0,bx=b.x+(b.slide?b.slide[0]*off:0),by=b.y+(b.slide?b.slide[1]*off:0);
  const cx=(bx+.5)*S,base=(by+.5)*S+S*0.2,urg=Math.max(0,1-b.t/(b.f||2.4)),fast=b.t<0.8;
  const fl=Math.sin(time*(fast?30:14)+bx*3)*0.5+Math.sin(time*(fast?47:23)+by)*0.5;
  const H=S*(0.36+0.22*urg+0.04*fl),W=S*(0.13+0.06*urg),sway=fl*S*0.04;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(cx,base-H*0.45,0,cx,base-H*0.45,S*(0.5+0.25*urg));
  g.addColorStop(0,`rgba(255,190,90,${0.3+0.35*urg})`);g.addColorStop(1,'rgba(255,140,40,0)');
  ctx.fillStyle=g;ctx.fillRect(cx-S,base-S*1.4,S*2,S*1.8);ctx.restore();
  ctx.fillStyle='#6a3a1e';ctx.beginPath();ctx.ellipse(cx,base+S*0.04,S*0.27,S*0.1,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9a5a2e';ctx.beginPath();ctx.moveTo(cx-S*0.27,base);ctx.quadraticCurveTo(cx,base+S*0.2,cx+S*0.27,base);ctx.lineTo(cx+S*0.2,base-S*0.03);ctx.lineTo(cx-S*0.2,base-S*0.03);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c27a3e';ctx.beginPath();ctx.ellipse(cx,base-S*0.02,S*0.21,S*0.05,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a2410';ctx.beginPath();ctx.ellipse(cx,base-S*0.02,S*0.15,S*0.03,0,0,Math.PI*2);ctx.fill();
  const blink=b.t<0.5&&Math.sin(time*40)>0;
  ctx.fillStyle=blink?'#fff6d0':'#ff6a1c';flamePath(cx,base-S*0.02,W,H,sway);ctx.fill();
  ctx.fillStyle='#ffb52a';flamePath(cx,base-S*0.03,W*0.72,H*0.78,sway*0.8);ctx.fill();
  ctx.fillStyle='#fff2b0';flamePath(cx,base-S*0.04,W*0.42,H*0.5,sway*0.6);ctx.fill();
  if(Math.random()<0.25+urg*0.5){ctx.fillStyle=Math.random()<0.5?'#ffd36b':'#ff8a3d';
    ctx.fillRect(cx+(Math.random()-.5)*W*2,base-H*(0.9+Math.random()*0.6),S*0.04,S*0.04)}
}
function flameShape(x,y,k,th){
  const cx=(x+.5)*S,cy=(y+.5)*S,h=th*S/2;
  const pts=[];
  const puff=(ox,oy,r,i)=>pts.push([cx+ox*S,cy+oy*S,r*h*(1+0.16*Math.sin(time*26+i*1.9+x*3.1+y*5.3))]);
  if(k==='h'||k==='v'){const ax=k==='h';[-0.36,0,0.36].forEach((o,i)=>puff(ax?o:0,ax?0:o,i===1?1:0.92,i))}
  else if(k[0]==='e'){const d=k[1],sx=d==='R'?1:d==='L'?-1:0,sy=d==='D'?1:d==='U'?-1:0;
    puff(-sx*0.36,-sy*0.36,0.95,0);puff(0,0,0.9,1);puff(sx*0.24,sy*0.24,0.66,2)}
  else{puff(0,0,1.45,0);let i=1;
    for(const [dx,dy] of DLIST){const nx=x+dx,ny=y+dy;if(!inB(nx,ny)||flameT[ny][nx]<=0)continue;puff(dx*0.36,dy*0.36,1.05,i++)}}
  ctx.beginPath();
  for(const [px,py,r] of pts){ctx.moveTo(px+r,py);ctx.arc(px,py,Math.max(0,r),0,Math.PI*2)}
  const b=h*0.8,X=x*S,Y=y*S;
  if(k==='h')ctx.rect(X,cy-b,S,2*b);
  else if(k==='v')ctx.rect(cx-b,Y,2*b,S);
  else if(k[0]==='e'){const d=k[1];
    if(d==='R')ctx.rect(X,cy-b,S/2,2*b);if(d==='L')ctx.rect(cx,cy-b,S/2,2*b);
    if(d==='D')ctx.rect(cx-b,Y,2*b,S/2);if(d==='U')ctx.rect(cx-b,cy,2*b,S/2)}
  else for(const [dx,dy] of DLIST){const nx=x+dx,ny=y+dy;if(!inB(nx,ny)||flameT[ny][nx]<=0)continue;
    if(dx)ctx.rect(dx>0?cx:X,cy-b,S/2,2*b);else ctx.rect(cx-b,dy>0?cy:Y,2*b,S/2)}
  ctx.fill();
}
const FLAME_LAYERS=[[1,'#3a78d8'],[0.72,'#6fb4f2'],[0.44,'#cdeaff']];
function drawFlames(){
  const list=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=flameT[y][x];if(t<=0)continue;
    const p=1-t/FLAME_LIFE;
    const env=p<0.1?0.45+0.55*p/0.1:Math.max(0,1-Math.pow((p-0.1)/0.9,1.8));
    const th=0.85*env;
    list.push([x,y,flameK[y][x],th,env,t>FLAME_LIFE-FLAME_HOT])}
  if(!list.length)return;
  for(const [f,col] of FLAME_LAYERS){ctx.fillStyle=col;
    for(const [x,y,k,th,,isHot] of list){ctx.globalAlpha=isHot?0.5:0.38;flameShape(x,y,k,th*f)}}
  ctx.globalAlpha=1;
}
function eyes(cx,cy,sep,r,tx,ty,iris='#1b1226'){
  const a=Math.atan2(ty-cy,tx-cx),ox=Math.cos(a)*r*0.4,oy=Math.sin(a)*r*0.4;
  for(const s of[-1,1]){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx+s*sep,cy,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=iris;ctx.beginPath();ctx.arc(cx+s*sep+ox,cy+oy,r*0.55,0,Math.PI*2);ctx.fill()}
}
function drawIdol(e,cx,cy,flash){
  const wind=e.windup>0,glow=wind?1:0.55+0.25*Math.sin(time*3+e.wob),W=S*0.62,H=S*0.62;
  ctx.save();
  ctx.fillStyle=flash?'#fff':'#e8dcc0';
  for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*W*0.55,cy-H*0.35);
    ctx.bezierCurveTo(cx+sd*W*1.25,cy-H*0.5,cx+sd*W*1.2,cy-H*1.3,cx+sd*W*0.85,cy-H*1.45);
    ctx.bezierCurveTo(cx+sd*W*0.95,cy-H*1.05,cx+sd*W*0.85,cy-H*0.75,cx+sd*W*0.3,cy-H*0.55);ctx.fill()}
  ctx.shadowColor=`rgba(255,40,30,${0.6*glow})`;ctx.shadowBlur=S*0.35;
  ctx.fillStyle=flash?'#fff':'#5a4e5e';ctx.beginPath();
  ctx.moveTo(cx-W*0.8,cy-H*0.75);ctx.lineTo(cx+W*0.8,cy-H*0.75);ctx.lineTo(cx+W*0.95,cy+H*0.1);
  ctx.lineTo(cx+W*0.55,cy+H*0.85);ctx.lineTo(cx-W*0.55,cy+H*0.85);ctx.lineTo(cx-W*0.95,cy+H*0.1);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,.1)';ctx.beginPath();ctx.moveTo(cx-W*0.8,cy-H*0.75);ctx.lineTo(cx+W*0.8,cy-H*0.75);ctx.lineTo(cx+W*0.7,cy-H*0.55);ctx.lineTo(cx-W*0.7,cy-H*0.55);ctx.fill();
  ctx.strokeStyle='rgba(20,10,20,.55)';ctx.lineWidth=Math.max(1,S*0.02);ctx.beginPath();
  ctx.moveTo(cx-W*0.6,cy-H*0.6);ctx.lineTo(cx-W*0.45,cy-H*0.3);ctx.lineTo(cx-W*0.55,cy-H*0.1);
  ctx.moveTo(cx+W*0.7,cy+H*0.2);ctx.lineTo(cx+W*0.5,cy+H*0.45);ctx.stroke();
  ctx.fillStyle='#2a1f2c';ctx.beginPath();ctx.moveTo(cx-W*0.75,cy-H*0.45);ctx.lineTo(cx-W*0.08,cy-H*0.18);ctx.lineTo(cx+W*0.08,cy-H*0.18);ctx.lineTo(cx+W*0.75,cy-H*0.45);ctx.lineTo(cx+W*0.75,cy-H*0.3);ctx.lineTo(cx-W*0.75,cy-H*0.3);ctx.fill();
  ctx.shadowColor='#ff2a1a';ctx.shadowBlur=S*0.2*glow;
  for(const sd of[-1,1]){ctx.fillStyle=`rgba(255,${wind?220:60},${wind?120:30},1)`;ctx.beginPath();
    ctx.moveTo(cx+sd*W*0.18,cy-H*0.15);ctx.lineTo(cx+sd*W*0.62,cy-H*0.3);ctx.lineTo(cx+sd*W*0.5,cy-H*0.02);ctx.closePath();ctx.fill()}
  ctx.shadowBlur=0;
  const mo=wind?1:0.45,mh=H*0.42*mo;
  ctx.fillStyle='#120608';ctx.beginPath();ctx.ellipse(cx,cy+H*0.42,W*0.45,mh,0,0,Math.PI*2);ctx.fill();
  if(wind){const g=ctx.createRadialGradient(cx,cy+H*0.42,0,cx,cy+H*0.42,W*0.42);g.addColorStop(0,'#fff6b0');g.addColorStop(0.5,'#ff9a1f');g.addColorStop(1,'rgba(255,60,20,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy+H*0.42,W*0.42,mh*0.9,0,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='#e8dcc0';
  for(let i=-2;i<=2;i++){const fx=cx+i*W*0.17,top=cy+H*0.42-mh;
    ctx.beginPath();ctx.moveTo(fx-W*0.07,top);ctx.lineTo(fx+W*0.07,top);ctx.lineTo(fx,top+H*(i===-2||i===2?0.28:0.18));ctx.fill()}
  for(let i=0;i<e.hp;i++){ctx.fillStyle='#ffd36b';ctx.fillRect(cx-e.hp*S*0.055+i*S*0.11,cy+H*1.0,S*0.08,S*0.05)}
  ctx.restore();
}
function drawEnemy(e){
  const T=ETYPES[e.type],[rx,ry]=rpos(e),cx=(rx+.5)*S,cy=(ry+.5)*S;
  const [px,py]=rpos(player),tx=(px+.5)*S,ty=(py+.5)*S;
  const flash=e.inv>0&&Math.sin(time*50)>0,col=flash?'#ffffff':T.col;
  if(e.type==='giant'){
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.95,S*1.1,S*0.22,0,0,Math.PI*2);ctx.fill();
    const bob=Math.sin(e.wob*2.5)*S*0.05;ctx.save();ctx.translate(cx,cy+bob);ctx.scale(2.15,2.15);ctx.translate(-cx,-cy);
    drawEnemy({...e,type:'lion',hp:0,moving:false,x:e.x,y:e.y,noGlow:true});ctx.restore();
    if(!e.sees&&e.windup<=0&&e.burst<=0){ctx.globalAlpha=0.8+0.2*Math.sin(time*3);ctx.font=`${S*0.7}px Bungee, Impact, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle='rgba(18,3,2,.85)';ctx.beginPath();ctx.arc(cx+S*1.05,cy-S*1.15,S*0.38,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff3b0';ctx.fillText('?',cx+S*1.05,cy-S*1.1);ctx.globalAlpha=1}
    return}
  if(e.type==='idol'){drawIdol(e,cx,cy,flash);return}
  if(extraT>0){
    // last 4 seconds: the cloud fades in and out, a little faster as time runs out
    const u=4-extraT,a=extraT<4?0.3+0.7*(0.5+0.5*Math.cos(u*5+u*u*0.75)):1;
    ctx.save();ctx.globalAlpha*=a;drawCloud(cx,cy,e.wob,null);ctx.restore();return}
  if(e.type==='lies'){
    const a=e.vanish>0.5?(e.vanish-0.5)*2:e.vanish>0?1-e.vanish*2:1;
    ctx.save();ctx.globalAlpha=Math.max(0.04,a);
    gooBlob(cx,cy,S*0.34,flash?'#fff':'#7a4cc4',e.wob);
    ctx.fillStyle='#f4ecff';ctx.beginPath();ctx.ellipse(cx,cy-S*0.06,S*0.23,S*0.18,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#2a1440';ctx.lineWidth=Math.max(1.5,S*0.03);ctx.lineCap='round';
    ctx.beginPath();ctx.arc(cx-S*0.09,cy-S*0.08,S*0.045,Math.PI,0);ctx.stroke();
    ctx.beginPath();ctx.arc(cx+S*0.09,cy-S*0.11,S*0.045,0,Math.PI);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-S*0.1,cy+S*0.07);ctx.quadraticCurveTo(cx-S*0.04,cy+S*0.11,cx,cy+S*0.07);ctx.quadraticCurveTo(cx+S*0.05,cy+S*0.03,cx+S*0.1,cy+S*0.08);ctx.stroke();
    const dir=tx>cx?1:-1,nl=S*(0.14+0.14*(0.5+0.5*Math.sin(time*2+e.wob)));
    ctx.fillStyle='#d6bfff';ctx.beginPath();ctx.moveTo(cx+dir*S*0.02,cy-S*0.05);ctx.lineTo(cx+dir*(S*0.02+nl),cy-S*0.01);ctx.lineTo(cx+dir*S*0.02,cy+S*0.02);ctx.closePath();ctx.fill();
    ctx.restore();return}
  if(e.type==='theft'){
    const loot=Math.min(5,e.loot.length+e.coins+e.lamps),sr=S*(0.14+0.035*loot),dir=tx>cx?-1:1;
    ctx.fillStyle=flash?'#fff':'#8a6438';ctx.beginPath();ctx.arc(cx+dir*S*0.24,cy-S*0.02,sr,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#5a3e20';ctx.lineWidth=Math.max(1,S*0.025);ctx.beginPath();ctx.moveTo(cx+dir*S*0.24-sr*0.4,cy-S*0.02-sr*0.8);ctx.lineTo(cx+dir*S*0.24+sr*0.4,cy-S*0.02-sr*0.8);ctx.stroke();
    const st=e.moving?Math.sin(e.prog*Math.PI*4)*S*0.04:0;
    ctx.fillStyle='#22252e';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(cx+sd*S*0.12,cy+S*0.36+sd*st,S*0.08,S*0.05,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=flash?'#fff':'#3a3f4c';ctx.beginPath();ctx.moveTo(cx,cy-S*0.42);ctx.quadraticCurveTo(cx+S*0.36,cy-S*0.2,cx+S*0.28,cy+S*0.34);ctx.lineTo(cx-S*0.28,cy+S*0.34);ctx.quadraticCurveTo(cx-S*0.36,cy-S*0.2,cx,cy-S*0.42);ctx.fill();
    ctx.fillStyle='#0c0d12';rr(cx-S*0.26,cy-S*0.16,S*0.52,S*0.14,S*0.05);ctx.fill();
    eyes(cx,cy-S*0.09,S*0.1,S*0.045,tx,ty,'#1a1400');
    ctx.fillStyle='rgba(255,210,58,.9)';for(const sd of[-1,1]){ctx.beginPath();ctx.arc(cx+sd*S*0.1,cy-S*0.09,S*0.045,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#120e00';for(const sd of[-1,1]){const a=Math.atan2(ty-cy,tx-cx);ctx.beginPath();ctx.arc(cx+sd*S*0.1+Math.cos(a)*S*0.015,cy-S*0.09+Math.sin(a)*S*0.015,S*0.022,0,Math.PI*2);ctx.fill()}
    return}
  if(e.type==='greed'){
    const R=S*0.42,hop=e.moving?Math.sin(e.prog*Math.PI):0,air=hop*S*0.38;
    const land=e.moving?Math.max(0,1-Math.min(e.prog,1-e.prog)*6):0;
    const sqx=1+0.14*land-0.08*hop,sqy=1-0.16*land+0.1*hop,breathe=e.moving?0:Math.sin(e.wob*3)*0.03;
    const face=(e.dx||0)<0?-1:1,bite=e.biting?(Math.sin(time*16)*0.5+0.5):0;
    ctx.save();
    ctx.fillStyle=`rgba(0,0,0,${0.3-0.15*hop})`;ctx.beginPath();ctx.ellipse(cx,cy+R*0.62,R*(0.85-0.25*hop),R*(0.2-0.06*hop),0,0,Math.PI*2);ctx.fill();
    ctx.translate(cx,cy+R*0.55-air);ctx.scale(face*sqx*(1+breathe),sqy*(1-breathe));
    const body=flash?'#fff':'#c9a227',dark=flash?'#fff':'#6e5a12',belly=flash?'#fff':'#f3dc84';
    ctx.fillStyle=dark;for(const sd of[-1,1]){ctx.beginPath();if(hop>0.3){ctx.ellipse(sd*R*0.55-R*0.25,-R*0.05,R*0.32,R*0.12,sd*0.5,0,Math.PI*2)}else{ctx.ellipse(sd*R*0.62,-R*0.08,R*0.28,R*0.18,0,0,Math.PI*2)}ctx.fill()}
    let g=ctx.createRadialGradient(-R*0.25,-R*0.75,R*0.1,0,-R*0.45,R*1.05);g.addColorStop(0,flash?'#fff':'#ecd060');g.addColorStop(1,body);
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-R*0.85,-R*0.1);ctx.bezierCurveTo(-R*0.95,-R*0.75,-R*0.45,-R*1.05,0,-R*1.02);ctx.bezierCurveTo(R*0.45,-R*1.05,R*0.95,-R*0.75,R*0.85,-R*0.1);
    ctx.quadraticCurveTo(0,R*0.08,-R*0.85,-R*0.1);ctx.fill();ctx.strokeStyle='rgba(60,45,5,.6)';ctx.lineWidth=Math.max(1,S*0.025);ctx.stroke();
    ctx.fillStyle=belly;ctx.beginPath();ctx.ellipse(0,-R*0.18,R*0.52,R*0.22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(110,90,18,.45)';for(const [sx,sy,sr] of [[-0.45,-0.7,0.07],[0.3,-0.82,0.06],[0.55,-0.55,0.05],[-0.2,-0.9,0.045]]){ctx.beginPath();ctx.arc(sx*R,sy*R,sr*R,0,Math.PI*2);ctx.fill()}
    const mo=0.06+bite*0.32+(e.moving?0:0.04*Math.max(0,Math.sin(e.wob*1.3)));
    ctx.fillStyle='#3a0d0d';ctx.beginPath();ctx.moveTo(-R*0.7,-R*0.42);ctx.quadraticCurveTo(0,-R*(0.42-mo*1.6),R*0.7,-R*0.42);ctx.quadraticCurveTo(0,-R*(0.42-0.22),-R*0.7,-R*0.42);ctx.fill();
    ctx.strokeStyle='#3a2a05';ctx.lineWidth=Math.max(1.5,S*0.035);ctx.beginPath();ctx.moveTo(-R*0.72,-R*0.44);ctx.quadraticCurveTo(0,-R*0.22,R*0.72,-R*0.44);ctx.stroke();
    if(mo>0.15){ctx.fillStyle='#fff8e0';for(let i=-2;i<=2;i++){const x=i*R*0.22;ctx.beginPath();ctx.moveTo(x-R*0.06,-R*0.33);ctx.lineTo(x+R*0.06,-R*0.33);ctx.lineTo(x,-R*0.33+R*0.12);ctx.fill()}}
    for(const sd of[-1,1]){const ex=sd*R*0.4,ey=-R*0.95;
      ctx.fillStyle=body;ctx.beginPath();ctx.arc(ex,ey,R*0.24,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(60,45,5,.6)';ctx.stroke();
      ctx.fillStyle='#fff7d0';ctx.beginPath();ctx.arc(ex,ey-R*0.02,R*0.17,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e0a400';ctx.beginPath();ctx.arc(ex+R*0.03,ey-R*0.02,R*0.12,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#1a1000';ctx.beginPath();ctx.ellipse(ex+R*0.04,ey-R*0.02,R*0.09,R*0.04,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#3a2a05';ctx.lineWidth=Math.max(1.5,S*0.035);ctx.beginPath();ctx.moveTo(ex-R*0.2,ey-R*0.22+sd*0);ctx.lineTo(ex+R*0.18,ey-R*0.12);ctx.stroke()}
    ctx.restore();return}
  if(e.type==='murder'){
    const fl=e.flying,R=S*0.36,hov=fl?-S*0.18:Math.sin(e.wob*3)*S*0.03,ad=[e.dx||0,e.dy||1];
    ctx.save();ctx.fillStyle=`rgba(0,0,0,${fl?0.18:0.3})`;ctx.beginPath();ctx.ellipse(cx,cy+S*0.42,S*(fl?0.22:0.3),S*0.07,0,0,Math.PI*2);ctx.fill();
    if(fl){for(let i=1;i<=3;i++){ctx.fillStyle=`rgba(192,24,46,${0.18-i*0.05})`;ctx.beginPath();ctx.arc(cx-ad[0]*S*0.3*i,cy+hov-ad[1]*S*0.3*i,R*(1-i*0.15),0,Math.PI*2);ctx.fill()}}
    ctx.translate(cx,cy+hov);
    const fl2=fl?Math.sin(time*30)*0.35:Math.sin(e.wob*2)*0.08;
    ctx.fillStyle=flash?'#fff':'#5a0614';for(const sd of[-1,1]){ctx.save();ctx.scale(sd,1);ctx.rotate(-0.2-fl2);ctx.beginPath();ctx.moveTo(R*0.3,-R*0.2);ctx.quadraticCurveTo(R*1.2,-R*0.9,R*1.35,-R*0.1);ctx.lineTo(R*1.0,-R*0.05);ctx.lineTo(R*1.1,R*0.25);ctx.lineTo(R*0.75,R*0.15);ctx.lineTo(R*0.65,R*0.45);ctx.lineTo(R*0.3,R*0.3);ctx.closePath();ctx.fill();ctx.restore()}
    let g=ctx.createLinearGradient(0,-R,0,R);g.addColorStop(0,flash?'#fff':'#e0304a');g.addColorStop(1,flash?'#fff':'#7a0a1c');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-R*1.05);ctx.quadraticCurveTo(R*0.75,-R*0.9,R*0.7,R*0.2);
    for(let i=0;i<4;i++){const x=R*0.7-(i+1)*R*0.35;ctx.lineTo(x+R*0.17,R*0.55+(i%2?0.1*R:0));ctx.lineTo(x,R*0.85)}
    ctx.quadraticCurveTo(-R*0.75,-R*0.9,0,-R*1.05);ctx.fill();ctx.strokeStyle='rgba(40,0,8,.7)';ctx.lineWidth=Math.max(1.2,S*0.025);ctx.stroke();
    ctx.fillStyle='#1a0206';ctx.beginPath();ctx.ellipse(0,-R*0.35,R*0.42,R*0.3,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='#ffcc00';ctx.shadowBlur=S*0.12;ctx.fillStyle=fl?'#fff27a':'#ffb020';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(sd*R*0.05,-R*0.33);ctx.lineTo(sd*R*0.3,-R*0.45);ctx.lineTo(sd*R*0.26,-R*0.27);ctx.closePath();ctx.fill()}
    ctx.shadowBlur=0;ctx.restore();return}
  if(e.type==='gloop'){
    const r=S*0.34;gooBlob(cx,cy,r,col,e.wob);
    const blink=((time+e.wob*2.3)%3.6)<0.12;
    for(const sd of[-1,1]){const ex=cx+sd*r*0.32,ey=cy-r*0.1,a=Math.atan2(ty-ey,tx-ex);
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(ex,ey,r*0.24,blink?r*0.04:r*0.27,0,0,Math.PI*2);ctx.fill();
      if(!blink){ctx.fillStyle='#0f2a22';ctx.beginPath();ctx.arc(ex+Math.cos(a)*r*0.09,ey+Math.sin(a)*r*0.1,r*0.12,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex+Math.cos(a)*r*0.09-r*0.04,ey+Math.sin(a)*r*0.1-r*0.05,r*0.04,0,Math.PI*2);ctx.fill()}}
    ctx.strokeStyle='#0d2a20';ctx.lineWidth=Math.max(1.5,S*0.035);ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(cx-r*0.2,cy+r*0.42);ctx.quadraticCurveTo(cx,cy+r*0.56,cx+r*0.2,cy+r*0.42);ctx.stroke();
  }else if(e.type==='skitter'){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.shadowColor='rgba(255,40,70,.85)';ctx.shadowBlur=S*0.18;
    ctx.strokeStyle=flash?'#fff':'#d4243f';ctx.lineWidth=Math.max(2,S*0.07);
    ctx.beginPath();for(let i=0;i<4;i++){const l=Math.sin(e.wob*20+i*1.7)*S*0.06,yy=cy-S*0.2+i*S*0.12;
      for(const sd of[-1,1]){ctx.moveTo(cx+sd*S*0.16,yy);ctx.lineTo(cx+sd*S*0.4,yy-S*0.14+(sd>0?-l:l));ctx.lineTo(cx+sd*S*0.56,yy+S*0.12+(sd>0?-l:l))}}ctx.stroke();
    ctx.fillStyle=flash?'#fff':'#c8102e';ctx.beginPath();ctx.ellipse(cx,cy+S*0.14,S*0.28,S*0.31,0,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle=flash?'#fff':'#16020a';ctx.beginPath();ctx.moveTo(cx,cy+S*0.0);ctx.lineTo(cx+S*0.1,cy+S*0.13);ctx.lineTo(cx,cy+S*0.28);ctx.lineTo(cx-S*0.1,cy+S*0.13);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.beginPath();ctx.ellipse(cx-S*0.12,cy+S*0.04,S*0.07,S*0.04,-0.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=flash?'#fff':'#7a0718';ctx.beginPath();ctx.ellipse(cx,cy-S*0.2,S*0.21,S*0.18,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ff5a6e';ctx.lineWidth=Math.max(1,S*0.025);ctx.stroke();
    ctx.fillStyle='#f2ede4';for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*S*0.03,cy-S*0.08);ctx.lineTo(cx+sd*S*0.11,cy-S*0.08);ctx.lineTo(cx+sd*S*0.05,cy+S*0.05);ctx.fill()}
    const gl=0.75+0.25*Math.sin(time*9+e.wob);
    ctx.fillStyle=`rgb(255,${200+Math.round(55*gl)},60)`;ctx.shadowColor='#ffd040';ctx.shadowBlur=S*0.08;
    ctx.beginPath();for(const [ox,oy,r] of [[-0.06,-0.26,0.045],[0.06,-0.26,0.045],[-0.13,-0.21,0.032],[0.13,-0.21,0.032],[-0.03,-0.18,0.025],[0.03,-0.18,0.025]]){ctx.moveTo(cx+(ox+r)*S,cy+oy*S);ctx.arc(cx+ox*S,cy+oy*S,r*S,0,Math.PI*2)}
    ctx.fill();ctx.restore();
  }else if(e.type==='wisp'){
    ctx.save();ctx.globalAlpha=0.85;
    const g=ctx.createRadialGradient(cx,cy,S*0.05,cx,cy,S*0.45);g.addColorStop(0,flash?'#fff':'#e6f5ff');g.addColorStop(0.6,col);g.addColorStop(1,'rgba(159,216,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy+Math.sin(e.wob*3)*S*0.04,S*0.45,0,Math.PI*2);ctx.fill();ctx.restore();
    eyes(cx,cy-S*0.02,S*0.1,S*0.075,tx,ty,'#24345a');
  }else if(e.type==='suspect'){
    const step=e.moving?Math.sin(e.prog*Math.PI*2):0,R=S*0.36,bx=cx,by=cy+S*0.05-Math.abs(step)*S*0.02;
    const wind=e.windup>0;let ad=[e.dx||0,e.dy||1];if(!(ad[0]||ad[1]))ad=[0,1];const spin=e.spun>0?(e.spun-=1/60,Math.sin(e.spun*30)*0.25):0;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.42,S*0.32,S*0.07,0,0,Math.PI*2);ctx.fill();
    ctx.translate(bx,by);ctx.rotate(spin);
    ctx.fillStyle=flash?'#fff':'#3e2c58';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(sd*S*0.16,S*0.34,S*0.1,S*0.06,0,0,Math.PI*2);ctx.fill()}
    let g=ctx.createLinearGradient(0,-R,0,R);g.addColorStop(0,flash?'#fff':'#c9b3e6');g.addColorStop(1,flash?'#fff':'#6a4f8e');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-R*0.9,R*0.8);ctx.quadraticCurveTo(-R*1.05,-R*0.7,0,-R*1.05);ctx.quadraticCurveTo(R*1.05,-R*0.7,R*0.9,R*0.8);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(25,35,20,.7)';ctx.lineWidth=Math.max(1.2,S*0.025);ctx.stroke();
    const look=ad[0]*R*0.12,back=ad[1]<0;
    if(!back){ctx.fillStyle='#fffbe0';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(sd*R*0.34+look,-R*0.3,R*0.2,R*(wind?0.14:0.08),0,0,Math.PI*2);ctx.fill()}
      ctx.fillStyle=wind?'#c0281c':'#1c2414';for(const sd of[-1,1]){ctx.beginPath();ctx.arc(sd*R*0.34+look+ad[0]*R*0.08,-R*0.3,R*0.065,0,Math.PI*2);ctx.fill()}
      ctx.strokeStyle='#1c2414';ctx.lineWidth=Math.max(1.8,S*0.045);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-R*0.6,-R*0.48);ctx.lineTo(-R*0.12,-R*0.42);ctx.moveTo(R*0.6,-R*0.48);ctx.lineTo(R*0.12,-R*0.42);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-R*0.22,R*0.12);ctx.lineTo(R*0.22,R*0.06);ctx.stroke()}
    else{ctx.fillStyle='#fffbe0';ctx.beginPath();ctx.ellipse(0,-R*0.45,R*0.16,R*0.1,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#1c2414';ctx.beginPath();ctx.arc(0,-R*0.45,R*0.06,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }else if(e.type==='accuse'){
    const step=e.moving?Math.sin(e.prog*Math.PI*4):0,R=S*0.36,bx=cx,by=cy+S*0.04-Math.abs(step)*S*0.03;
    const firing=e.burst>0||e.windup>0;let ad=firing?e.aim:[e.dx||0,e.dy||1];if(!(ad[0]||ad[1]))ad=[0,1];
    ctx.save();ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.42,S*0.3,S*0.07,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=flash?'#fff':'#3e2f58';for(const sd of[-1,1]){const lift=e.moving?Math.max(0,Math.sin(e.prog*Math.PI*4+(sd>0?Math.PI:0)))*S*0.05:0;ctx.beginPath();ctx.ellipse(cx+sd*S*0.15,cy+S*0.38-lift,S*0.09,S*0.055,0,0,Math.PI*2);ctx.fill()}
    let g=ctx.createLinearGradient(bx,by-R,bx,by+R);g.addColorStop(0,flash?'#fff':'#a48ccc');g.addColorStop(1,flash?'#fff':'#5e4a86');
    ctx.fillStyle=g;rr(bx-R*0.85,by-R*0.95,R*1.7,R*1.75,R*0.55);ctx.fill();ctx.strokeStyle='rgba(30,20,50,.7)';ctx.lineWidth=Math.max(1.2,S*0.025);ctx.stroke();
    const back=ad[1]<0;
    if(!back){ctx.fillStyle='#fff';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(bx+sd*R*0.32,by-R*0.32,R*0.18,R*0.11,0,0,Math.PI*2);ctx.fill()}
      ctx.fillStyle='#1c1428';for(const sd of[-1,1]){ctx.beginPath();ctx.arc(bx+sd*R*0.32+ad[0]*R*0.06,by-R*0.31+ad[1]*R*0.03,R*0.07,0,Math.PI*2);ctx.fill()}
      ctx.strokeStyle='#1c1428';ctx.lineWidth=Math.max(1.8,S*0.045);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(bx-R*0.55,by-R*0.62);ctx.lineTo(bx-R*0.12,by-R*0.45);ctx.moveTo(bx+R*0.55,by-R*0.62);ctx.lineTo(bx+R*0.12,by-R*0.45);ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx-R*0.25,by+R*0.08);ctx.quadraticCurveTo(bx,by-R*0.04,bx+R*0.25,by+R*0.08);ctx.stroke()}
    const sx=bx+(ad[0]?ad[0]*R*0.7:R*0.6),sy=by-R*0.05+(ad[1]?ad[1]*R*0.2:0),fx=sx+ad[0]*R*0.75,fy=sy+ad[1]*R*0.75;
    ctx.strokeStyle=flash?'#fff':'#5e4a86';ctx.lineWidth=S*0.12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(fx,fy);ctx.stroke();
    ctx.fillStyle=flash?'#fff':'#f0c8a8';ctx.beginPath();ctx.arc(fx,fy,S*0.075,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#f0c8a8';ctx.lineWidth=S*0.05;ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx+ad[0]*S*0.16,fy+ad[1]*S*0.16);ctx.stroke();
    if(e.burst>0&&e.burstT>0.08){ctx.fillStyle='rgba(255,220,120,.9)';ctx.beginPath();ctx.arc(fx+ad[0]*S*0.2,fy+ad[1]*S*0.2,S*0.06,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }else if(e.type==='critic'){
    const step=e.moving?Math.sin(e.prog*Math.PI*4):0,R=S*0.37,bx=cx,by=cy+S*0.1-Math.abs(step)*S*0.02;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.45,S*0.34,S*0.08,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#6b7a8a';ctx.lineWidth=Math.max(2,S*0.06);ctx.lineCap='round';
    for(const [o,ph] of [[-0.5,0],[0,Math.PI],[0.5,0]]){const lift=e.moving?Math.max(0,Math.sin(e.prog*Math.PI*4+ph))*R*0.12:0;
      ctx.beginPath();ctx.moveTo(bx+o*R,by+R*0.2);ctx.lineTo(bx+o*R*1.25,by+R*0.85-lift);ctx.stroke()}
    ctx.fillStyle=flash?'#fff':'#9aa8b8';ctx.beginPath();ctx.ellipse(bx,by+R*0.22,R*1.02,R*0.24,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=flash?'#fff':col;ctx.beginPath();ctx.moveTo(bx-R,by+R*0.18);ctx.arc(bx,by+R*0.18,R,Math.PI,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.ellipse(bx-R*0.42,by-R*0.45,R*0.2,R*0.1,-0.6,0,Math.PI*2);ctx.fill();
    const [ax,ay]=e.aim||[0,1],look=e.firing?[ax,ay]:[Math.sign(tx-bx)*0.6,Math.sign(ty-by)*0.3];
    ctx.fillStyle='#16303a';ctx.beginPath();ctx.roundRect(bx-R*0.7,by-R*0.42,R*1.4,R*0.36,R*0.18);ctx.fill();
    ctx.fillStyle=e.firing?'#9ff6ff':'#3fd8e8';ctx.beginPath();ctx.ellipse(bx+look[0]*R*0.38,by-R*0.24+look[1]*R*0.06,R*(e.firing?0.2:0.15),R*0.1,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#4a5868';ctx.lineWidth=Math.max(1.5,S*0.035);ctx.beginPath();ctx.moveTo(bx-R*0.55,by-R*0.62);ctx.lineTo(bx-R*0.1,by-R*0.5);ctx.moveTo(bx+R*0.55,by-R*0.62);ctx.lineTo(bx+R*0.1,by-R*0.5);ctx.stroke();
    ctx.restore();
  }else if(e.type==='temper'){
    const fl=e.flaming>0,step=e.moving?Math.sin(e.prog*Math.PI*4):0,R=S*0.36,bx=cx,by=cy+S*0.07-Math.abs(step)*S*0.02;
    ctx.save();
    if(fl){const [ax,ay]=e.aim,[ox,oy]=occ(e);let n=0;for(let r=1;r<=T.range;r++){const x=ox+ax*r,y=oy+ay*r;if(!inB(x,y)||grid[y][x]!==EMPTY)break;n=r}
      ctx.globalAlpha=0.85;
      for(let i=0;i<n*5+3;i++){const k=i/(n*5+3),d=(0.35+k*(n+0.15))*S,w=S*(0.16+0.16*k)*(0.8+0.3*Math.sin(time*30+i*1.7)),j=Math.sin(time*25+i)*S*0.05;
        ctx.fillStyle=k<0.3?'#fff2b0':k<0.65?'#ffb03a':'#ff5a2a';ctx.beginPath();ctx.arc(bx+ax*d+(ay?j:0),cy+ay*d+(ax?j:0),w,0,Math.PI*2);ctx.fill()}
      ctx.globalAlpha=1}
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.44,S*0.34,S*0.08,0,0,Math.PI*2);ctx.fill();
    // steam puffs from the head
    for(const sd of[-1,1]){const t=(time*(fl?2.4:0.9)+(sd>0?0.5:0)+e.wob)%1;ctx.globalAlpha=(1-t)*(fl?0.9:0.45);ctx.fillStyle='#f2eef0';
      ctx.beginPath();ctx.arc(bx+sd*R*(0.45+t*0.3),by-R*(0.95+t*0.7),R*(0.12+t*0.14),0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=1;ctx.fillStyle=flash?'#fff':col;ctx.beginPath();
    ctx.moveTo(bx-R,by+R*0.75);ctx.quadraticCurveTo(bx-R*1.05,by-R*0.85,bx,by-R*0.95);ctx.quadraticCurveTo(bx+R*1.05,by-R*0.85,bx+R,by+R*0.75);ctx.quadraticCurveTo(bx,by+R*1.0,bx-R,by+R*0.75);ctx.fill();
    ctx.fillStyle=flash?'#fff':'#f58a7c';ctx.beginPath();ctx.ellipse(bx-R*0.38,by-R*0.5,R*0.22,R*0.12,-0.5,0,Math.PI*2);ctx.fill();
    eyes(bx,by-R*0.2,R*0.3,R*0.15,tx,ty,'#2a0808');
    ctx.strokeStyle='#5a1010';ctx.lineWidth=Math.max(1.5,S*0.045);ctx.lineCap='round';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(bx+sd*R*0.5,by-R*(fl?0.52:0.45));ctx.lineTo(bx+sd*R*0.14,by-R*0.36);ctx.stroke()}
    ctx.fillStyle='#3a0808';const mh=fl?R*0.3:R*0.08;ctx.beginPath();ctx.ellipse(bx,by+R*0.35,R*(fl?0.32:0.25),mh,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }else if(e.type==='gossip'){
    const step=e.moving?Math.sin(e.prog*Math.PI*4):0,R=S*0.36,bx=cx,by=cy+S*0.06-Math.abs(step)*S*0.02;
    const talk=0.3+0.7*Math.abs(Math.sin(time*(e.talking?17:5)+e.wob));
    ctx.save();
    if(e.talking){const [ax,ay]=e.aim,[ox,oy]=occ(e),cells=[];
      for(let r=1;r<=T.range;r++){const x=ox+ax*r,y=oy+ay*r;if(!inB(x,y)||grid[y][x]!==EMPTY)break;cells.push([x,y])}
      // the lamp's flame, laid along the spray and stretched over the squares it reaches
      // flowing ribbons of fire: one main strand, a smaller one above and one below, waves travelling to the tip
      const L=S*(cells.length+0.35),t=time*1.0+e.wob;
      const strands=[{o:-S*0.16,a:S*0.13,w:S*0.36,l:0.75,f:1.5,p:1.3},{o:S*0.16,a:S*0.12,w:S*0.32,l:0.65,f:1.7,p:2.6},{o:0,a:S*0.1,w:S*0.72,l:1,f:1.2,p:0}];
      ctx.save();ctx.translate(bx+ax*R*0.55,by+R*0.3+ay*R*0.55);ctx.rotate(Math.atan2(ay,ax)+Math.PI/2);
      const ribbon=(st,ws)=>{const N=18,len=L*st.l*(0.94+0.06*Math.sin(t*13+st.p)),pts=[];
        for(let k=0;k<=N;k++){const u=k/N,x=st.o*u+st.a*Math.sin(u*st.f*Math.PI*2-t*14+st.p)*(0.25+u),w=st.w*ws*Math.pow(Math.sin(Math.PI*(0.12+0.88*u)),0.75)*(0.9+0.1*Math.sin(t*21+k));pts.push([x,-u*len,w])}
        ctx.beginPath();pts.forEach(([x,y,w],k)=>k?ctx.lineTo(x-w/2,y):ctx.moveTo(x-w/2,y));
        for(let k=pts.length-1;k>=0;k--){const [x,y,w]=pts[k];ctx.lineTo(x+w/2,y)}ctx.closePath();ctx.fill()};
      for(const [c,ws,al] of [['#e8401a',1.45,0.18],['#f0501a',1.15,0.4],['#ff6a1c',0.88,0.7],['#ff9a28',0.64,0.85],['#ffc23a',0.4,0.9],['#fff0b0',0.18,0.85]]){
        ctx.fillStyle=c;ctx.globalAlpha=al;for(const st of strands)ribbon(st,ws)}
      ctx.globalAlpha=1;ctx.restore()}ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.44,S*0.34,S*0.08,0,0,Math.PI*2);ctx.fill();
    // eyes on stalks, watching both sides
    ctx.strokeStyle=flash?'#fff':'#a8357a';ctx.lineWidth=Math.max(1.5,S*0.04);ctx.lineCap='round';
    for(const sd of[-1,1]){const sx=bx+sd*R*0.62,sy=by-R*1.28+Math.sin(time*3+sd+e.wob)*R*0.05;
      ctx.beginPath();ctx.moveTo(bx+sd*R*0.3,by-R*0.7);ctx.lineTo(sx,sy);ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx,sy,R*0.17,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#2a0a1e';ctx.beginPath();ctx.arc(sx+sd*R*0.07,sy,R*0.08,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=flash?'#fff':col;ctx.beginPath();ctx.ellipse(bx,by,R,R*0.92,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=flash?'#fff':'#f08cc4';ctx.beginPath();ctx.ellipse(bx-R*0.35,by-R*0.45,R*0.25,R*0.14,-0.5,0,Math.PI*2);ctx.fill();
    const mw=R*0.62,mh=R*0.42*talk,my=by+R*0.3;
    ctx.fillStyle='#3a0a26';ctx.beginPath();ctx.ellipse(bx,my,mw,Math.max(R*0.06,mh),0,0,Math.PI*2);ctx.fill();
    if(mh>R*0.12){ctx.fillStyle='#ff7aa8';ctx.beginPath();ctx.ellipse(bx,my+mh*0.45,mw*0.5,mh*0.4,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#fff';for(const o of[-0.32,0,0.32])ctx.fillRect(bx+o*mw-R*0.06,my-Math.max(R*0.06,mh),R*0.12,R*0.1);
    eyes(bx,by-R*0.28,R*0.3,R*0.17,tx,ty,'#2a0a1e');
    ctx.restore();
  }else if(e.type==='doubt'){
    const wind=e.windup>0,[ax,ay]=e.aim,step=e.moving?Math.sin(e.prog*Math.PI*4):0,lean=Math.sin(time*2.1+e.wob)*0.12+(e.moving?step*0.06:0);
    const R=S*0.4,bx=cx,by=cy+S*0.08-Math.abs(step)*S*0.025;
    ctx.save();ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(cx,cy+S*0.46,S*0.36,S*0.08,0,0,Math.PI*2);ctx.fill();
    ctx.translate(bx,by+R*0.9);ctx.rotate(lean);ctx.translate(-bx,-(by+R*0.9));
    if(wind){ctx.strokeStyle=flash?'#fff':'#4a473a';ctx.lineWidth=S*0.11;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(bx,by+R*0.1);ctx.lineTo(bx+ax*R*1.15,by+R*0.1+ay*R*1.15);ctx.stroke();
      ctx.fillStyle='#1c1b16';ctx.beginPath();ctx.arc(bx+ax*R*1.15,by+R*0.1+ay*R*1.15,S*0.04,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=flash?'#fff':col;ctx.beginPath();
    ctx.moveTo(bx-R*0.95,by+R*0.85);ctx.bezierCurveTo(bx-R*1.05,by-R*0.2,bx-R*0.7,by-R*1.05,bx-R*0.05,by-R*1.1);
    ctx.bezierCurveTo(bx+R*0.35,by-R*1.12,bx+R*0.5,by-R*1.45,bx+R*0.25,by-R*1.55);
    ctx.bezierCurveTo(bx+R*0.85,by-R*1.3,bx+R*1.05,by-R*0.4,bx+R*0.95,by+R*0.85);
    for(let i=3;i>=-3;i--){const xx=bx+i*R*0.317;ctx.quadraticCurveTo(xx+R*0.16,by+R*(0.85+(i%2?0.16:0.02)+Math.sin(time*5+i)*0.03),xx-R*0.0,by+R*0.85)}
    ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(40,38,28,.7)';ctx.lineWidth=Math.max(1.2,S*0.025);ctx.stroke();
    ctx.fillStyle=flash?'#fff':'#7e7a66';ctx.beginPath();ctx.ellipse(bx,by+R*0.45,R*0.6,R*0.3,0,0,Math.PI*2);ctx.fill();
    const a=Math.atan2(ty-by,tx-bx),w2=Math.sin(time*1.3+e.wob)*1.4;
    for(const [ox,rr2,dir] of [[-0.38,0.27,a+w2],[0.36,0.19,a-w2*0.7]]){const ex=bx+ox*R,ey=by-R*0.28;
      ctx.fillStyle='#fffdf2';ctx.beginPath();ctx.arc(ex,ey,rr2*R,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#2c2a22';ctx.beginPath();ctx.arc(ex+Math.cos(wind?a:dir)*rr2*R*0.42,ey+Math.sin(wind?a:dir)*rr2*R*0.42,rr2*R*0.5,0,Math.PI*2);ctx.fill()}
    ctx.strokeStyle='#3a382e';ctx.lineWidth=Math.max(1.5,S*0.03);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(bx-R*0.62,by-R*0.68);ctx.lineTo(bx-R*0.18,by-R*0.6);ctx.moveTo(bx+R*0.18,by-R*0.56);ctx.lineTo(bx+R*0.55,by-R*0.68);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx-R*0.25,by+R*0.18);ctx.quadraticCurveTo(bx-R*0.08,by+R*0.08,bx+R*0.05,by+R*0.2);ctx.quadraticCurveTo(bx+R*0.18,by+R*0.3,bx+R*0.3,by+R*0.16);ctx.stroke();
    ctx.restore();
    if(!wind){const qy=cy-S*0.72+Math.sin(time*2.4+e.wob)*S*0.05,qa=0.45+0.35*Math.sin(time*1.7+e.wob);
      ctx.save();ctx.globalAlpha=qa;ctx.fillStyle=theme().grass?'#2e3a24':'#e8e4cc';ctx.font=`700 ${S*0.3}px "Chakra Petch", sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',cx+S*0.22,qy);ctx.restore()}
  }else if(e.type==='spitter'){
    const wind=e.windup>0,[ax,ay]=e.aim,br=Math.sin(time*3.2+e.wob*2),bs=1+br*0.045+(wind?0.08*Math.sin(time*40):0);
    const step=e.moving?Math.sin(e.prog*Math.PI*4):0,sway=e.moving?step*S*0.03:Math.sin(time*1.6+e.wob)*S*0.01;
    const bx=cx+sway,by=cy+S*0.02-Math.abs(step)*S*0.03,R=S*0.34;
    ctx.save();
    ctx.fillStyle=flash?'#fff':'#4a1a0c';
    for(const [sd,ph] of [[-1,0],[1,Math.PI]]){const lift=e.moving?Math.max(0,Math.sin(e.prog*Math.PI*4+ph))*S*0.05:0;
      ctx.beginPath();ctx.ellipse(cx+sd*S*0.22,cy+S*0.36-lift,S*0.1,S*0.06,0,0,Math.PI*2);ctx.fill()}
    ctx.shadowColor='rgba(255,100,20,.75)';ctx.shadowBlur=S*0.2;
    ctx.fillStyle=flash?'#fff':'#7a2c12';ctx.beginPath();
    ctx.moveTo(bx-R*1.05*bs,by+R*0.55);
    ctx.bezierCurveTo(bx-R*1.15*bs,by-R*0.5*bs,bx-R*0.55*bs,by-R*1.0*bs,bx,by-R*0.95*bs);
    ctx.bezierCurveTo(bx+R*0.6*bs,by-R*1.02*bs,bx+R*1.15*bs,by-R*0.45*bs,bx+R*1.05*bs,by+R*0.55);
    ctx.quadraticCurveTo(bx,by+R*1.05,bx-R*1.05*bs,by+R*0.55);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle=flash?'#fff':'#b2481c';ctx.beginPath();ctx.ellipse(bx,by+R*0.42,R*0.62*bs,R*0.38,0,0,Math.PI*2);ctx.fill();
    const glow=wind?1:0.55+0.35*(br*0.5+0.5);
    ctx.fillStyle=`rgba(255,${150+Math.round(60*glow)},40,${glow})`;
    for(const [ox,oy,rr2] of [[-0.62,-0.2,0.09],[0.66,-0.32,0.07],[-0.3,-0.68,0.06],[0.45,0.1,0.05],[0.15,-0.82,0.05]]){ctx.beginPath();ctx.arc(bx+ox*R*bs,by+oy*R*bs,rr2*R*1.6,0,Math.PI*2);ctx.fill()}
    const open=wind?1:0.35+0.25*(br*0.5+0.5),mx=bx+(wind?ax*0.05:0)*S,my=by+R*0.25,mw=R*0.62,mh=R*0.38*open;
    ctx.fillStyle='#2a0602';ctx.beginPath();ctx.ellipse(mx,my,mw,Math.max(R*0.06,mh),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=wind?'#ffd23a':'#ff5a1c';ctx.beginPath();ctx.ellipse(mx,my+mh*0.35,mw*0.55,Math.max(R*0.03,mh*0.45),0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff6e0';for(let i=-2;i<=2;i++){const tx2=mx+i*mw*0.36;
      ctx.beginPath();ctx.moveTo(tx2-mw*0.1,my-Math.max(R*0.06,mh)*0.95);ctx.lineTo(tx2+mw*0.1,my-Math.max(R*0.06,mh)*0.95);ctx.lineTo(tx2,my-Math.max(R*0.06,mh)*0.95+R*0.16);ctx.fill()}
    if(!wind&&br>0.6){ctx.fillStyle='rgba(255,170,60,.85)';ctx.beginPath();ctx.ellipse(mx+mw*0.45,my+mh+R*0.12*(br-0.6)*3,R*0.05,R*0.09,0,0,Math.PI*2);ctx.fill()}
    const ex=bx,ey=by-R*0.42,a=(e.dx||e.dy)&&!e.portrait?Math.atan2(e.dy,e.dx):Math.atan2(ty-ey,tx-ex),blink=((time+e.wob*1.7)%3.1)<0.13;
    ctx.fillStyle='#3a1206';ctx.beginPath();ctx.ellipse(ex,ey,R*0.38,R*0.34,0,0,Math.PI*2);ctx.fill();
    if(blink){ctx.strokeStyle='#ffb347';ctx.lineWidth=Math.max(1.5,S*0.03);ctx.beginPath();ctx.moveTo(ex-R*0.28,ey);ctx.quadraticCurveTo(ex,ey+R*0.08,ex+R*0.28,ey);ctx.stroke()}
    else{ctx.shadowColor='#ffd040';ctx.shadowBlur=S*0.12;ctx.fillStyle=wind?'#fff6b0':'#ffe36b';ctx.beginPath();ctx.ellipse(ex,ey,R*0.3,R*0.27,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      const pw=wind?R*0.04:R*0.07;ctx.fillStyle='#d8400c';ctx.beginPath();ctx.arc(ex+Math.cos(a)*R*0.08,ey+Math.sin(a)*R*0.07,R*0.17,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#120404';ctx.beginPath();ctx.ellipse(ex+Math.cos(a)*R*0.09,ey+Math.sin(a)*R*0.08,pw,R*0.15,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(ex-R*0.1,ey-R*0.1,R*0.05,0,Math.PI*2);ctx.fill()}
    ctx.strokeStyle='#2a0a04';ctx.lineWidth=Math.max(2,S*0.04);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(ex-R*0.38,ey-R*0.38);ctx.lineTo(ex+R*0.38,ey-R*0.3);ctx.stroke();
    ctx.restore();
  }else if(e.type==='lion'){
    const wind=e.windup>0||e.burst>0,R0=S*(wind?0.7:0.64);
    ctx.save();if(!e.noGlow){ctx.shadowColor='rgba(255,80,10,.9)';ctx.shadowBlur=S*0.3}// the Deaths draw without the glow (it was the main cost on level 50)
    for(const [k,c] of [[1,'#a8160a'],[0.84,'#ff4a12'],[0.66,'#ffb52a']]){ctx.fillStyle=flash?'#fff':c;ctx.beginPath();
      for(let i=0;i<20;i++){const a=i/20*Math.PI*2-Math.PI/2,f=Math.sin(time*(wind?26:11)+i*2.3+e.wob)*0.08;
        const rr2=(i%2?R0*0.72:R0*(1+f))*k;const px2=cx+Math.cos(a)*rr2,py2=cy+Math.sin(a)*rr2*(i%2?1:1.08)-(i%2?0:S*0.04);i?ctx.lineTo(px2,py2):ctx.moveTo(px2,py2)}
      ctx.closePath();ctx.fill();ctx.shadowBlur=0}
    ctx.restore();
    ctx.fillStyle=flash?'#fff':'#1e0806';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*S*0.16,cy-S*0.22);ctx.quadraticCurveTo(cx+sd*S*0.42,cy-S*0.42,cx+sd*S*0.32,cy-S*0.62);ctx.quadraticCurveTo(cx+sd*S*0.3,cy-S*0.38,cx+sd*S*0.06,cy-S*0.26);ctx.fill()}
    ctx.fillStyle=flash?'#fff':'#3d0c08';ctx.beginPath();
    ctx.moveTo(cx-S*0.3,cy-S*0.18);ctx.quadraticCurveTo(cx,cy-S*0.36,cx+S*0.3,cy-S*0.18);ctx.lineTo(cx+S*0.26,cy+S*0.16);ctx.quadraticCurveTo(cx,cy+S*0.42,cx-S*0.26,cy+S*0.16);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#ff6a1c';ctx.lineWidth=Math.max(1,S*0.025);ctx.stroke();
    ctx.save();ctx.shadowColor='#ffd040';ctx.shadowBlur=S*0.15;ctx.fillStyle=wind?'#fff6b0':'#ffd23a';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*S*0.05,cy-S*0.1);ctx.lineTo(cx+sd*S*0.22,cy-S*0.15);ctx.lineTo(cx+sd*S*0.19,cy-S*0.04);ctx.closePath();ctx.fill()}
    ctx.restore();
    ctx.fillStyle='#1a0402';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(cx+sd*S*0.15,cy-S*0.095,S*0.015,S*0.04,0,0,Math.PI*2);ctx.fill()}
    ctx.strokeStyle='#120302';ctx.lineWidth=Math.max(2,S*0.05);ctx.lineCap='round';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*S*0.04,cy-S*0.15);ctx.lineTo(cx+sd*S*0.25,cy-S*0.22);ctx.stroke()}
    const jh=S*(wind?0.2:0.12),jy=cy+S*0.13;
    ctx.fillStyle=wind?'#ffcf3a':'#120302';ctx.beginPath();ctx.ellipse(cx,jy,S*0.17,jh*0.6,0,0,Math.PI*2);ctx.fill();
    if(wind){ctx.fillStyle='#ff6a1c';ctx.beginPath();ctx.ellipse(cx,jy,S*0.1,jh*0.35,0,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#fff6e0';
    for(const sd of[-1,1]){ctx.beginPath();ctx.moveTo(cx+sd*S*0.13,jy-jh*0.5);ctx.lineTo(cx+sd*S*0.06,jy-jh*0.5);ctx.lineTo(cx+sd*S*0.1,jy+jh*0.35);ctx.fill();
      ctx.beginPath();ctx.moveTo(cx+sd*S*0.03,jy+jh*0.55);ctx.lineTo(cx+sd*S*0.09,jy+jh*0.55);ctx.lineTo(cx+sd*S*0.06,jy-jh*0.05);ctx.fill()}
    for(let i=0;i<e.hp;i++){ctx.fillStyle='#ffd36b';ctx.fillRect(cx-S*0.2+i*S*0.15,cy+S*0.42,S*0.1,S*0.06)}
  }else{
    ctx.fillStyle=flash?'#fff':'#e8dcc0';
    for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(cx+s*S*0.3,cy-S*0.22);ctx.lineTo(cx+s*S*0.44,cy-S*0.44);ctx.lineTo(cx+s*S*0.16,cy-S*0.3);ctx.fill()}
    ctx.fillStyle=col;rr(cx-S*0.38,cy-S*0.32,S*0.76,S*0.7,S*0.16);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(cx-S*0.38,cy+S*0.22,S*0.76,S*0.08);
    eyes(cx,cy-S*0.06,S*0.13,S*0.08,tx,ty,'#a3121f');
    for(let i=0;i<e.hp;i++){ctx.fillStyle='#ffd36b';ctx.fillRect(cx-S*0.14+i*S*0.18,cy+S*0.12,S*0.1,S*0.06)}
  }
}
// A wooden torch held up in celebration: a tapered handle, a dark wrapped head and the same flame as a set-down lamp.
function drawHeldTorch(x,y,R0,a,fl){ctx.save();ctx.globalAlpha*=a;
  const top=y-R0*0.05,bot=y+R0*0.6;
  ctx.fillStyle='#8a5a2e';ctx.beginPath();ctx.moveTo(x-R0*0.13,top);ctx.lineTo(x+R0*0.13,top);ctx.lineTo(x+R0*0.08,bot);ctx.quadraticCurveTo(x,bot+R0*0.05,x-R0*0.08,bot);ctx.closePath();ctx.fill();
  ctx.fillStyle='#6a4020';ctx.fillRect(x+R0*0.02,top+R0*0.15,R0*0.04,bot-top-R0*0.2);
  ctx.fillStyle='#4a2c14';ctx.beginPath();ctx.roundRect(x-R0*0.17,top-R0*0.08,R0*0.34,R0*0.24,R0*0.06);ctx.fill();
  ctx.strokeStyle='#2e1a0a';ctx.lineWidth=Math.max(1,R0*0.04);ctx.beginPath();ctx.moveTo(x-R0*0.17,top+R0*0.04);ctx.lineTo(x+R0*0.17,top+R0*0.04);ctx.stroke();
  const W=R0*(0.3+0.04*fl),H=R0*(0.95+0.12*fl),sw=Math.sin(time*13)*R0*0.08,fb=top-R0*0.06;
  ctx.fillStyle='#ff6a1c';flamePath(x,fb,W,H,sw);ctx.fill();
  ctx.fillStyle='#ffb52a';flamePath(x,fb-R0*0.02,W*0.72,H*0.78,sw*0.8);ctx.fill();
  ctx.fillStyle='#fff2b0';flamePath(x,fb-R0*0.04,W*0.42,H*0.5,sw*0.6);ctx.fill();ctx.restore()}
function drawHeroBot([fx,fy],walk,lampSide,cheer=0){// cheer 0..1: lantern raised overhead to celebrate
  const R0=S*0.38,bob=Math.sin(time*3)*S*0.012,side=fx!==0?fx:lampSide||1;
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,R0*1.05,R0*0.85,R0*0.2,0,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(0,-bob);
  const ax=side*R0*0.18,fl=0.75+0.25*Math.sin(time*9);
  ctx.strokeStyle='#c9ced8';ctx.lineWidth=Math.max(1.5,S*0.035);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,-R0*0.9);ctx.lineTo(ax,-R0*1.32);ctx.stroke();
  const g0=ctx.createRadialGradient(ax,-R0*1.38,0,ax,-R0*1.38,R0*0.4);g0.addColorStop(0,`rgba(255,226,140,${0.6*fl})`);g0.addColorStop(1,'rgba(255,226,140,0)');
  ctx.fillStyle=g0;ctx.beginPath();ctx.arc(ax,-R0*1.38,R0*0.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffe28a';ctx.beginPath();ctx.arc(ax,-R0*1.38,R0*0.13,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9aa2b4';ctx.beginPath();ctx.arc(0,R0*0.08,R0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e9ecf2';ctx.beginPath();ctx.arc(0,0,R0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.ellipse(-R0*0.42,-R0*0.5,R0*0.22,R0*0.12,-0.6,0,Math.PI*2);ctx.fill();
  if(fy===-1){ctx.fillStyle='#c9ced8';ctx.beginPath();ctx.roundRect(-R0*0.35,-R0*0.15,R0*0.7,R0*0.4,R0*0.1);ctx.fill();
    ctx.fillStyle='#9aa2b4';for(let i=0;i<3;i++)ctx.fillRect(-R0*0.25,-R0*0.07+i*R0*0.11,R0*0.5,R0*0.04)}
  else{const vx=fx*R0*0.2,vy=fy>0?R0*0.05:0,vw=fx?R0*1.1:R0*1.42;
    ctx.fillStyle='#232a3a';ctx.beginPath();ctx.roundRect(vx-vw/2,-R0*0.4+vy,vw,R0*0.56,R0*0.28);ctx.fill();
    const blink=((time+1.3)%3.4)<0.12;ctx.fillStyle='#5fe0c8';ctx.shadowColor='#5fe0c8';ctx.shadowBlur=S*0.08;
    const sp=fx?R0*0.21:R0*0.27,er=fx?R0*0.115:R0*0.13;
    for(const sd of[-1,1]){ctx.beginPath();
      if(blink)ctx.fillRect(vx+sd*sp+fx*R0*0.05-er,-R0*0.13+vy,er*2,R0*0.05);
      else ctx.arc(vx+sd*sp+fx*R0*0.05,-R0*0.12+vy,er,0,Math.PI*2);ctx.fill()}
    ctx.shadowBlur=0}
  const ck=cheer*cheer*(3-2*cheer),lx=side*R0*(1.12-0.1*ck),ly=R0*(0.45-1.7*ck),gr=R0*(1.2+0.7*ck);
  const g=ctx.createRadialGradient(lx,ly,0,lx,ly,gr);g.addColorStop(0,`rgba(255,226,140,${(0.45+0.35*ck)*fl})`);g.addColorStop(1,'rgba(255,210,110,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(lx,ly,gr,0,Math.PI*2);ctx.fill();
  if(ck>0.5)drawHeldTorch(lx,ly,R0,(ck-0.5)*2,fl);// as it is raised, the lantern turns into a burning torch
  {const aw=Math.max(3.5,S*(0.09+0.03*ck));ctx.lineCap='round';ctx.beginPath();ctx.moveTo(side*R0*(0.8+0.17*ck),R0*(0.25-0.25*ck));ctx.lineTo(lx,ly+R0*(-0.32+0.74*ck));// raised arm runs along the body's edge, clear of the visor
   ctx.strokeStyle='#e9ecf2';ctx.lineWidth=aw;ctx.stroke()}// arm in the body's colour
  if(ck>0.6){ctx.fillStyle='#fff3b0';for(let i=0;i<5;i++){const a=time*2+i*1.257,d=R0*(0.55+0.15*Math.sin(time*5+i)),k=0.5+0.5*Math.sin(time*7+i*2);
    ctx.globalAlpha=(ck-0.6)/0.4*k;ctx.beginPath();ctx.arc(lx+Math.cos(a)*d,ly+Math.sin(a)*d,R0*0.06,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  ctx.save();ctx.globalAlpha*=Math.max(0,1-ck*2);ctx.translate(lx,ly-R0*0.3);ctx.scale(1+0.45*ck,1+0.45*ck);ctx.translate(-lx,-(ly-R0*0.3));
  ctx.fillStyle='#8a6a2a';ctx.beginPath();ctx.roundRect(lx-R0*0.17,ly-R0*0.28,R0*0.34,R0*0.48,R0*0.06);ctx.fill();
  ctx.fillStyle=`rgba(255,${220+Math.round(30*fl)},140,1)`;ctx.beginPath();ctx.roundRect(lx-R0*0.11,ly-R0*0.2,R0*0.22,R0*0.33,R0*0.05);ctx.fill();
  ctx.restore();
  ctx.restore();
}
function drawPlayer(){
  const p=player,[rx,ry]=rpos(p);let cx=(rx+.5)*S,cy=(ry+.52)*S;
  if(p.alive&&p.fastT>0&&p.moving&&!(p.fastT<3&&Math.sin(time*20)>0)){
    for(let i=3;i>=1;i--){ctx.fillStyle=`rgba(95,224,200,${0.11*(4-i)})`;ctx.beginPath();ctx.ellipse(cx-p.dx*S*0.22*i,cy-p.dy*S*0.22*i,S*(0.36-i*0.05),S*(0.36-i*0.05),0,0,Math.PI*2);ctx.fill()}}
  if(p.alive&&p.fastT>0){ctx.strokeStyle=`rgba(95,224,200,${p.fastT<3?0.4+0.4*Math.sin(time*20):0.6})`;ctx.lineWidth=Math.max(1.5,S*0.04);ctx.lineCap='round';
    for(const sd of[-1,1]){const fx=cx+sd*S*0.16,fy=cy+S*0.42;ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx-S*0.12-(p.moving?p.dx*S*0.05:0),fy-S*0.06);ctx.stroke()}}
  ctx.save();ctx.translate(cx,cy);
  if(p.alive&&p.hurtT>0&&Math.sin(time*40)>0)ctx.globalAlpha=0.3;
  if(!p.alive){const k=Math.max(0,1-p.deathT/1.1);ctx.rotate(p.deathT*8);ctx.scale(k,k)}
  const f=DIRS[p.face];if(f[0])p.side=f[0];
  const ch=p.cheer||0;if(ch>0)ctx.translate(0,-Math.abs(Math.sin(time*6))*S*0.07*ch);// a small happy bounce
  drawHeroBot(p.moving?f:[0,1],p.moving?Math.sin(p.prog*Math.PI*2):0,p.side,ch);
  ctx.restore();
  if(p.alive&&p.shield>0){
    const t=p.shield;let col,on=true;
    if(!p.shieldPick){col='255,255,255';on=Math.sin(time*20)>0}
    else if(t>4)col='110,170,255';
    else if(t>2){col='255,196,40';on=Math.sin(time*9)>0}
    else{col='255,50,50';on=Math.sin(time*26)>0}
    const a=on?1:0.35,R=S*0.5;
    ctx.fillStyle=`rgba(${col},${0.18*a})`;ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(${col},${0.9*a})`;ctx.lineWidth=Math.max(2,S*0.05);
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();
    if(p.shieldPick){ctx.lineWidth=Math.max(3,S*0.1);ctx.strokeStyle=`rgba(${col},${a})`;
      ctx.beginPath();ctx.arc(cx,cy,R+S*0.08,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,t/10));ctx.stroke()}
  }
}
function drawParticles(){
  for(const p of particles){const a=Math.max(0,p.life/p.max);
    if(p.text){ctx.globalAlpha=Math.min(1,a*1.5);ctx.fillStyle=p.c;ctx.font=`${Math.max(10,S*0.42)}px Silkscreen, monospace`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      // keep floating text inside the visible board (the outer wall ring is cropped)
      const hw=ctx.measureText(p.text).width/2+S*0.1,tx=Math.max(S+hw,Math.min((COLS-1)*S-hw,p.x*S)),ty=Math.max(S*1.35,Math.min((ROWS-1.35)*S,p.y*S));
      ctx.fillStyle='#120d18';ctx.fillText(p.text,tx+1,ty+2);ctx.fillStyle=p.c;ctx.fillText(p.text,tx,ty)}
    else if(p.smoke){if(p.delay>0)continue;const rr2=(p.r+(1-a)*0.28)*S;ctx.globalAlpha=a*0.45;ctx.fillStyle=p.c;
      ctx.beginPath();ctx.arc(p.x*S,p.y*S,rr2,0,Math.PI*2);ctx.fill()}
    else{ctx.globalAlpha=a;ctx.fillStyle=p.c;ctx.fillRect(p.x*S-p.r*S,p.y*S-p.r*S,p.r*2*S,p.r*2*S)}}
  ctx.globalAlpha=1;
}
function fitFont(t,px,fam,maxW){ctx.font=`${px}px ${fam}`;const w=ctx.measureText(t).width;if(w>maxW)ctx.font=`${Math.max(8,px*maxW/w)}px ${fam}`}
function wrapText(t,maxW){const out=[];let cur='';
  for(const w of t.split(' ')){const n=cur?cur+' '+w:w;if(cur&&ctx.measureText(n).width>maxW){out.push(cur);cur=w}else cur=n}
  if(cur)out.push(cur);return out}
// Level-start message: a box about 60% of the board wide, with long hints wrapped onto extra lines.
function bannerText(big,small,a,col,extra){
  const W=COLS*S,H=ROWS*S,maxBox=Math.min(W*0.96,Math.max(S*9,W*0.6)),inner=maxBox-S*1.6,rows=[];
  fitFont(big,S*0.72,'Bungee, Impact, sans-serif',inner);rows.push([big,ctx.font,null,S*0.95]);
  fitFont(small,Math.max(11,S*(extra?0.44:0.38)),'Silkscreen, monospace',inner);rows.push([small,ctx.font,extra?col:'#f4ead8',S*0.62]);
  if(extra){ctx.font=`${Math.max(10,S*0.32)}px Silkscreen, monospace`;const f=ctx.font;for(const l of wrapText(extra,inner))rows.push([l,f,'#f4ead8',S*0.46])}
  let bw=0;for(const r of rows){ctx.font=r[1];bw=Math.max(bw,ctx.measureText(r[0]).width)}
  bw=Math.min(maxBox,bw+S*1.6);const gap=extra?S*0.22:0,pad=S*0.45,bh=rows.reduce((t,r)=>t+r[3],0)+gap+pad*2,top=H/2-bh/2;
  ctx.globalAlpha=a;ctx.fillStyle=extra?'rgba(18,13,24,.86)':'rgba(18,13,24,.7)';rr(W/2-bw/2,top,bw,bh,S*0.25);ctx.fill();
  ctx.textAlign='center';ctx.textBaseline='middle';let y=top+pad;
  rows.forEach(([t,f,c,h],i)=>{if(i===2)y+=gap;const cy=y+h/2;ctx.font=f;
    if(i===0){ctx.fillStyle='#7a3b12';ctx.fillText(t,W/2,cy+3);ctx.fillStyle='#ffb347'}else ctx.fillStyle=c;
    ctx.fillText(t,W/2,cy);y+=h});
  ctx.globalAlpha=1;
}
function draw(){
  ctx.setTransform(DPR,0,0,DPR,-S*DPR,-S*DPR);ctx.clearRect(0,0,COLS*S,ROWS*S);
  if(!grid)return;
  if(shake>0&&!reduce)ctx.translate((Math.random()-.5)*shake*S*0.5,(Math.random()-.5)*shake*S*0.5);
  drawTiles();drawCoins();
  for(const k in items)drawItem(k,items[k]);
  for(const b of bombs)drawBomb(b);
  drawTrumpetWave();
  drawFlames();drawJFires();
  for(const e of enemies){if(e.dying>0){const k=e.dying/DIE_TIME,[rx,ry]=rpos(e),cx=(rx+.5)*S,cy=(ry+.5)*S;
    ctx.save();ctx.globalAlpha=Math.min(1,k*1.4);ctx.translate(cx,cy+(1-k)*S*0.15);ctx.rotate((1-k)*(e.wob%2>1?0.6:-0.6));ctx.scale(0.35+0.65*k,0.35+0.65*k*(0.8+0.2*k));ctx.translate(-cx,-cy);
    drawEnemy({...e,inv:Math.sin(time*40)>0?0.1:0,moving:false,windup:0});ctx.restore();
    ctx.save();ctx.globalAlpha=(1-k)*0.6*k*2;ctx.strokeStyle='#fff8d0';ctx.lineWidth=Math.max(1.5,S*0.04);ctx.beginPath();ctx.arc(cx,cy,S*(0.25+(1-k)*0.4),0,Math.PI*2);ctx.stroke();ctx.restore()}
    else if(Math.abs(e.sqy||0)>0.01){ctx.save();ctx.translate(0,e.sqy*S);drawEnemy(e);ctx.restore()}
    else if(e.lean>0.01){const k=e.lean*S;ctx.save();ctx.translate(e.ldx*k,e.ldy*k);drawEnemy(e);ctx.restore()}
    else drawEnemy(e)}
  drawShots();
  drawPlayer();drawParticles();
  ctx.setTransform(DPR,0,0,DPR,-S*DPR,-S*DPR);
  if(state==='play'&&banner>0&&!introOpen){const a=Math.min(1,banner/0.5);
    if(isBoss()){const k=bossK(),pl=k>1?'S':'';
      bannerText('BOSS LEVEL '+level,(k===1?'DEATH':k===2?'DEATH AND ITS SHADOW':'DEATH AND '+(k-1)+' SHADOWS'),a,'#ff5a1c','Touch it without a shield and you die. Shielded, light a lamp inside it!')}
    else if(INTRO[level]){const I=INTRO[level],T=ETYPES[I.type];
      bannerText('LEVEL '+level,'NEW DEMON: '+T.name.toUpperCase(),a,T.col,I.desc)}
    else if(level>1&&(level-1)%5===0){const T=theme();bannerText('LEVEL '+level,'NEW WORLD: '+T.name.toUpperCase(),a,T.acc,T.desc)}
    else bannerText('LEVEL '+level,enemies.length+' monsters to defeat \u00b7 '+theme().name,a)}
  if(state==='play'&&isBoss()&&bossMax>0&&bossHPNow()>0&&banner<=0&&!enemies.some(e=>e.type==='giant'&&!e.dead)){// no BOSS bar for the Deaths
    const W=COLS*S,bw=Math.min(W*0.5,S*7),bx=(W-bw)/2,by=S*1.28,bh=S*0.28,f=bossHPNow()/bossMax;
    ctx.fillStyle='rgba(10,4,6,.85)';rr(bx-S*1.3,by-S*0.12,bw+S*1.42,bh+S*0.24,S*0.12);ctx.fill();
    ctx.font=`${Math.max(10,S*0.3)}px Silkscreen, monospace`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#ff8a5c';ctx.fillText('BOSS',bx-S*1.15,by+bh/2);
    ctx.fillStyle='#3a1416';rr(bx,by,bw,bh,bh/2);ctx.fill();
    const g=ctx.createLinearGradient(bx,0,bx+bw,0);g.addColorStop(0,'#ff2a1a');g.addColorStop(1,'#ffb347');
    ctx.fillStyle=g;rr(bx,by,Math.max(bh,bw*f),bh,bh/2);ctx.fill()}
  if(state==='play'&&!enemies.length&&endWait>0){
    const n=Math.max(1,Math.ceil(END_TIME-endWait)),W=COLS*S,txt='ALL CLEAR · NEXT LEVEL IN '+n;
    ctx.font=`${Math.max(11,S*0.42)}px Silkscreen, monospace`;const tw=ctx.measureText(txt).width+S*0.8;
    ctx.fillStyle='rgba(18,13,24,.85)';rr(W/2-tw/2,S*0.12,tw,S*0.76,S*0.2);ctx.fill();// on the outer frame row, so it never hides letters
    ctx.strokeStyle=n<=2&&Math.sin(time*12)>0?'#ff5a5a':'#ffb347';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ffd36b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,W/2,S*0.5)}
  if(state==='play'&&player&&!player.alive&&player.deathT>0.6){
    const d=player.deathT,W=COLS*S,H=ROWS*S;
    ctx.fillStyle=`rgba(10,6,14,${Math.min(0.6,(d-0.6)*0.5)})`;ctx.fillRect(0,0,W,H);
    const left=lives-1,a=Math.min(1,(d-0.9)*2,(DEATH_TIME-d)*2);
    if(a>0)bannerText(left>0?(playerName?playerName.toUpperCase()+' HAS FALLEN':'THE PILGRIM HAS FALLEN'):'GAME OVER',left>0?(left===1?'1 life left':left+' lives left')+' · '+'♥'.repeat(left):'No lives left',a)}
  if(savedFlash>0&&state==='play'&&player.alive){const W=COLS*S,H=ROWS*S,txt=flashMsg||'✓ PROGRESS SAVED';
    ctx.globalAlpha=Math.min(1,savedFlash);ctx.font=`${Math.max(10,S*0.36)}px Silkscreen, monospace`;
    const tw=ctx.measureText(txt).width+S*0.6;ctx.fillStyle='rgba(18,13,24,.85)';rr(W-S-tw-S*0.2,H-S*1.85,tw,S*0.6,S*0.18);ctx.fill();
    ctx.fillStyle='#5fe0c8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,W-S-tw/2-S*0.2,H-S*1.55);ctx.globalAlpha=1}
  if(state==='play'&&extraBanner>0&&banner<=0){const a=Math.min(1,extraBanner/0.5),W=COLS*S,t1='CLOUDS OF HOPE',t2='Blast the clouds, grab their letters';
    ctx.save();ctx.globalAlpha=a;ctx.font=`${S*0.5}px Bungee, Impact, sans-serif`;const w1=ctx.measureText(t1).width;ctx.font=`${Math.max(9,S*0.28)}px Silkscreen, monospace`;const w2=ctx.measureText(t2).width;
    const bw=Math.max(w1,w2)+S*0.9,bh=S*1.2,bx=W/2-bw/2,by=S*1.2;
    ctx.fillStyle='rgba(18,13,26,.88)';rr(bx,by,bw,bh,S*0.3);ctx.fill();ctx.strokeStyle='#c46bff';ctx.lineWidth=Math.max(1.5,S*0.05);ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${S*0.5}px Bungee, Impact, sans-serif`;ctx.fillStyle='#e6c8ff';ctx.fillText(t1,W/2,by+bh*0.36);
    ctx.font=`${Math.max(9,S*0.28)}px Silkscreen, monospace`;ctx.fillStyle='#f4ead8';ctx.fillText(t2,W/2,by+bh*0.74);ctx.restore()}
  if(state==='finale')drawFinale();
  if(state==='clear'){const t=clearT,W=COLS*S,H=ROWS*S;
    const a=t<0.8?t/0.8:t<4.7?1:Math.max(0,(5.5-t)/0.8);
    ctx.fillStyle=`rgba(4,3,8,${a})`;ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.textBaseline='middle';
    const fade=(t0,t1)=>Math.max(0,Math.min(1,(t-t0)*4,(t1-t)*4));
    let f=fade(0.7,3.2);
    if(f>0){ctx.globalAlpha=f;const boss=clearLevel%10===0;
      fitFont(boss?'BOSS DEFEATED!':'LEVEL '+clearLevel+' COMPLETE',S*0.85,'Bungee, Impact, sans-serif',W*0.9);ctx.fillStyle='#ffb347';ctx.fillText(boss?'BOSS DEFEATED!':'LEVEL '+clearLevel+' COMPLETE',W/2,H/2-S*2);
      ctx.font=`${Math.max(11,S*0.38)}px Silkscreen, monospace`;ctx.fillStyle='#bfb3d6';ctx.fillText('POINTS THIS LEVEL',W/2,H/2-S*0.7);
      const shown=Math.round(clearScore*Math.min(1,Math.max(0,(t-0.9)/1.0)));
      ctx.font=`${S*1.3}px Bungee, Impact, sans-serif`;ctx.fillStyle='#fff3b0';ctx.fillText('+'+shown,W/2,H/2+S*0.5);
      ctx.font=`${Math.max(10,S*0.34)}px Silkscreen, monospace`;ctx.fillStyle='#8f86a6';ctx.fillText('Level bonus +'+clearBonus+'   \u00b7   Total '+score,W/2,H/2+S*1.7);
      if(playerName){ctx.fillStyle='#7ee8a0';ctx.fillText('Well done, '+playerName+'!',W/2,H/2+S*2.5)}
      ctx.globalAlpha=1}
    f=fade(3.4,5.0);
    if(f>0){ctx.globalAlpha=f;
      ctx.font=`${S*1.2}px Bungee, Impact, sans-serif`;ctx.fillStyle='#ffb347';ctx.fillText('LEVEL '+level,W/2,H/2-S*0.5);
      ctx.font=`${Math.max(11,S*0.45)}px Silkscreen, monospace`;ctx.fillStyle=(Math.sin(t*6)>0?'#fff3b0':'#d8cfa0');ctx.fillText(isBoss()?'A boss is waiting. Get ready!':'Get ready!',W/2,H/2+S*0.8);
      ctx.globalAlpha=1}}
}

function drawFinale(){
  const t=finaleT,W=COLS*S,H=ROWS*S,ap=(t0,d=0.8)=>Math.max(0,Math.min(1,(t-t0)/d));
  ctx.fillStyle='#04030a';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.textBaseline='middle';
  const dim=1-0.65*ap(7,1);
  // stars that twinkle once the celebration starts
  if(t>4){for(let i=0;i<40;i++){const x=((i*97)%100)/100*W,y=((i*61)%100)/100*H*0.9,k=0.5+0.5*Math.sin(time*3+i);
    ctx.globalAlpha=ap(4,1.5)*dim*k*0.8;ctx.fillStyle=i%3?'#ffe28a':'#fff8e0';ctx.beginPath();ctx.arc(x,y,S*(0.03+0.03*k),0,Math.PI*2);ctx.fill()}}
  ctx.globalAlpha=ap(0.3)*dim;fitFont('ALL YOUR ENEMIES ARE DEFEATED',S*0.75,'Bungee, Impact, sans-serif',W*0.68);ctx.fillStyle='#7a3b12';
  ctx.fillText('ALL YOUR ENEMIES ARE DEFEATED',W/2,H*0.2+3);ctx.fillStyle='#ffb347';ctx.fillText('ALL YOUR ENEMIES ARE DEFEATED',W/2,H*0.2);
  const names=LORE_ORDER.filter(k=>k!=='giant').map(loreName).join(', ')+' \u2026 and even Death itself.';
  ctx.globalAlpha=ap(1.2,1.2)*dim;ctx.font=`${Math.max(11,S*0.36)}px Silkscreen, monospace`;ctx.fillStyle='#e8dcc8';
  wrapText(names,W*0.58).forEach((l,i)=>ctx.fillText(l,W/2,H*0.29+i*S*0.55));
  const pulse=1+0.04*Math.sin(time*4);ctx.globalAlpha=ap(4)*dim;ctx.save();ctx.translate(W/2,H*0.56);ctx.scale(pulse,pulse);
  fitFont('Time to celebrate your perfection!',S*0.62,'Bungee, Impact, sans-serif',W*0.64);ctx.fillStyle='#fff3b0';ctx.fillText('Time to celebrate your perfection!',0,0);ctx.restore();
  ctx.globalAlpha=ap(7.5);ctx.font=`${Math.max(12,S*0.42)}px Silkscreen, monospace`;ctx.fillStyle='#d8c8ff';
  wrapText('But\u2026 what is that little thing creeping in the corner?!',W*0.58).forEach((l,i)=>ctx.fillText(l,W/2,H*0.68+i*S*0.6));
  if(t>7.5)drawCreeper(t-7.5,W,H);
  if(t>FINALE_READY){ctx.globalAlpha=0.55+0.45*Math.sin(time*4);ctx.font=`${Math.max(11,S*0.34)}px Silkscreen, monospace`;ctx.fillStyle='#ffd36b';
    wrapText('Press Enter to start again at level 1, keeping your lives, lamps and gifts',W*0.5).forEach((l,i)=>ctx.fillText(l,W/2,H*0.86+i*S*0.5))}
  ctx.globalAlpha=1;
}
// The little thing in the corner: a small shadow with glowing eyes that creeps in, stops, and peeks.
function drawCreeper(t,W,H){
  const R=S*0.4,inK=Math.min(1,t/2.5),x=W-S*0.4-inK*S*1.9,y=H-S*1.75,step=t<2.5?Math.abs(Math.sin(t*9)):0;
  ctx.save();ctx.globalAlpha=Math.min(1,t);ctx.translate(x,y-step*S*0.05);
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(0,R*0.95,R*1.1,R*0.22,0,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(-R*0.3,-R*0.4,R*0.1,0,0,R*1.2);g.addColorStop(0,'#6a4e96');g.addColorStop(1,'#2a1a40');ctx.fillStyle=g;ctx.shadowColor='rgba(190,150,255,.55)';ctx.shadowBlur=S*0.3;
  ctx.beginPath();ctx.moveTo(-R*1.1,R*0.9);ctx.bezierCurveTo(-R*1.2,-R*0.6,-R*0.5,-R*1.2,0,-R*1.15);ctx.bezierCurveTo(R*0.6,-R*1.2,R*1.2,-R*0.5,R*1.05,R*0.9);
  for(let i=0;i<5;i++){const fx=R*1.05-i*R*0.54;ctx.quadraticCurveTo(fx-R*0.13,R*(0.7+0.15*Math.sin(time*8+i)),fx-R*0.27,R*0.9)}ctx.closePath();ctx.fill();ctx.shadowBlur=0;
  const look=t>2.5?Math.sin(time*0.8)*R*0.12-R*0.08:-R*0.15,blink=(time%3.2)<0.12?0.15:1;
  for(const sd of[-1,1]){ctx.fillStyle='#d8ff5a';ctx.shadowColor='#d8ff5a';ctx.shadowBlur=S*0.25;
    ctx.beginPath();ctx.ellipse(sd*R*0.36+look,-R*0.35,R*0.17,R*0.2*blink,0,0,Math.PI*2);ctx.fill()}
  ctx.shadowBlur=0;ctx.fillStyle='#120a1c';for(const sd of[-1,1]){ctx.beginPath();ctx.ellipse(sd*R*0.36+look-R*0.04,-R*0.35,R*0.06,R*0.12*blink,0,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
/* ---------- HUD and overlay ---------- */
const HP='M12 21.3s-7.6-4.7-10.1-9.4C.2 8.6 1.7 4.1 5.8 3.5c2.5-.4 4.6.9 6.2 3 1.6-2.1 3.7-3.4 6.2-3 4.1.6 5.6 5.1 3.9 8.4C19.6 16.6 12 21.3 12 21.3z';
let heartsKey='';
function renderHearts(){
  const hp=player?player.hp:MAX_HP,k=hp+'';if(k===heartsKey)return;heartsKey=k;
  let h='';for(let i=0;i<MAX_HP/2;i++){const v=hp-i*2;
    h+=`<svg viewBox="0 0 24 22"><path class="bg" d="${HP}"/>${v>=2?`<path class="fg" d="${HP}"/>`:v===1?`<path class="fg" d="${HP}" clip-path="url(#halfL)"/>`:''}</svg>`}
  const el=$('hHearts');el.innerHTML=h;el.classList.toggle('low',hp<=4);
}
function hud(){
  $('hLevel').textContent=level;$('hScore').textContent=score;$('hBest').textContent=Math.max(best,score);
  $('hLives').textContent=Math.max(0,lives);
  if(!player)return;
  $('kBombs').textContent=player.bombs;$('kFire').textContent=player.fire;$('kFuse').textContent=(player.fuse||BASE_FUSE).toFixed(1);
  $('kSpeed').textContent=player.fastT>0?'FAST '+Math.ceil(player.fastT)+'s':Math.round((player.speed-3.6)/SPEED_STEP)+1;$('kSpeed').classList.toggle('fast',player.fastT>0);
  renderHearts();
  $('extraRow').classList.toggle('live',extraT>0);
  [...$('extraRow').children].forEach(sp=>sp.classList.toggle('got',letters.has(sp.textContent)));
}

function showOverlay(html,wide){$('card').className='card';$('card').innerHTML=html;$('overlay').classList.toggle('wide',!!wide);$('overlay').hidden=false;const b=$('goBtn');if(b){b.onclick=primary;b.focus()}}
function hideOverlay(){$('overlay').hidden=true}
function titleCard(){
  const k=t=>`<kbd>${t}</kbd>`;
  showOverlay(`<header class="thead"><h1>Mission <span class="im">Im</span>possible</h1>
      <div class="tright">${playerName?`<p class="welcome">Welcome, ${esc(playerName)}!</p>`:''}
        <div class="tstart"><button class="go big" id="goBtn" type="button">Start</button></div></div></header>
    <p class="lead">Guide the Pilgrim through dark places held by demons. Set down lamps whose light drives the demons out, and defeat them all to finish the level.</p>
    <div class="tgrid">
      <section><span class="sec">How to play</span><ul class="tlist">
        <li><b>5 lamps</b> can burn at the same time, and their light reaches <b>2 squares</b>.</li>
        <li>Your own light burns too, so <b>step aside</b> after setting a lamp. Lamps aren't solid: you and the demons can walk over them.</li>
        <li>You have <b>6 hearts</b> and lose them half by half.</li>
        <li>Collect every coin to call the <b>Clouds of Hope</b>, and spell <b>G-R-A-C-E</b> for an extra life.</li>
        <li>New demons are introduced as you meet them. Open the <b>Field guide</b> any time to read about them.</li>
      </ul></section>
      <section><span class="sec">Pickups</span><div class="legend">
        ${Object.entries(ITEMS).map(([t,i])=>`<div><img class="itic" src="${itemIcon(t)}" alt="">${i.label}</div>`).join('')}
      </div></section>
      <section><span class="sec">Controls</span><dl class="keys">
        <dt>${k('Enter')}</dt><dd>Start level ${lastPick()}</dd>
        <dt>${k('←')}${k('↑')}${k('↓')}${k('→')} or ${k('WASD')}</dt><dd>Move</dd>
        <dt>${k('Space')} or ${k('X')}</dt><dd>Set down a lamp</dd>
        <dt class="kgap">${k('L')}</dt><dd class="kgap">Choose a level</dd>
        <dt>${k('P')}</dt><dd>Pause</dd>
        <dt>${k('M')}</dt><dd>Music on/off</dd>
        <dt>${k('F')}</dt><dd>Full screen</dd>
      </dl>
      <p class="knote">Press <b>Save level</b> while playing to keep the current board, hearts and power-ups; your saves appear under <b>Saved levels</b> on the right.</p></section>
    </div>`,true);
  wireSave();
}
function pause(){if(state!=='play')return;state='pause';held.length=0;
  showOverlay(`<h2>Paused</h2><p>Level ${level} · ${score} points</p><button class="go" id="goBtn" type="button">Resume</button><p class="muted">Click anywhere or press P to resume</p>`);$('card').classList.add('pausecard')}
$('overlay').addEventListener('click',()=>{if(state==='pause'&&$('card').classList.contains('pausecard'))primary()});
function primary(){
  audio();
  if(state==='title'||state==='over'||state==='pick'){const n=pickedLevel();if(!playerName){askName(()=>startAt(n));return}startAt(n);return}
  else if(state==='pause'){state='play';hideOverlay();last=0}
  else if(state==='finale'&&finaleT>FINALE_READY)newRound();
}

/* ---------- input ---------- */
const KEYMAP={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  const d=KEYMAP[e.code];
  if(d){e.preventDefault();if(!held.includes(d))held.push(d);return}
  if(e.code==='Space'||e.code==='KeyX'||e.code==='Enter'){
    const fb=document.activeElement;if(state!=='play'&&e.code!=='KeyX'&&fb&&fb.tagName==='BUTTON'&&fb.id!=='goBtn')return;
    e.preventDefault();if(e.code!=='Enter'&&state==='play')bombHeld=true;if(e.repeat)return;audio();
    if(state==='play'&&e.code!=='Enter'){if(!player.moving||player.prog<0.5)placeBomb();else pendingBomb=true}
    else if(state!=='play'&&state!=='clear')primary();
    return}
  if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();if(state==='pick')closePicker();else if(state==='play')pause();else if(state==='pause')primary()}
  if(e.code==='KeyL'&&!e.repeat){e.preventDefault();if(state==='pick')closePicker();else{levelPicker();lKeyAt=performance.now()}}
});
let lKeyAt=0;
// Capture phase: the picker focuses its level dropdown, which stops key events from bubbling up to the handler above.
addEventListener('keydown',e=>{if(e.code==='KeyN'&&!e.repeat&&state==='pick'&&performance.now()-lKeyAt<1500){e.preventDefault();e.stopPropagation();lKeyAt=0;jumpDialog()}},true);
let bombHeld=false,pendingBomb=false;
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='KeyX')bombHeld=false;const d=KEYMAP[e.code];if(d){const i=held.indexOf(d);if(i>=0)held.splice(i,1)}});
addEventListener('blur',()=>{held.length=0;bombHeld=false;pause()});
document.querySelectorAll('.side button').forEach(b=>b.addEventListener('click',()=>b.blur()));
addEventListener('keyup',e=>{if(e.code==='Space')e.preventDefault()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
$('btnGuide').onclick=()=>{$('btnGuide').blur();if(!$('overlay').hidden&&$('card').querySelector('.fgh'))backFromClear();else openGuide()};
$('pName').onclick=()=>{$('pName').blur();askName()};
updateName();
$('btnClearSaves').onclick=()=>{$('btnClearSaves').blur();askClear()};
$('slotList').addEventListener('click',e=>{const b=e.target.closest('.slot');if(b)askLoad(b.dataset.l)});
$('btnSave').onclick=()=>{audio();saveNow()};
$('btnPause').onclick=()=>{if(state==='play')pause();else if(state==='pause')primary()};
function toggleMusic(){music.on=!music.on;$('btnMusic').textContent=music.on?'Music on':'Music off';audio()}
$('btnMusic').onclick=toggleMusic;
addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT'&&e.code==='KeyM'&&!e.repeat)toggleMusic()});
addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT'&&e.code==='KeyG'&&!e.repeat)toggleLag()});
$('btnSong').onclick=()=>$('songFile').click();
$('songFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
  const el=new Audio(URL.createObjectURL(f));useSong(el,f.name.replace(/\.[^.]+$/,''));audio()};
{const emb=$('embedSong');if(emb.getAttribute('src'))useSong(emb,emb.dataset.name||'Built-in song')}
$('btnSound').onclick=()=>{muted=!muted;$('btnSound').textContent=muted?'Sound off':'Sound on';if(!muted)audio()};
let lastMouse=-1e9;
addEventListener('mousemove',e=>{if(Math.abs(e.movementX)+Math.abs(e.movementY)>3)lastMouse=performance.now()});
function isFull(){return !!(document.fullscreenElement||document.webkitFullscreenElement)}
function toggleFull(){
  const el=document.documentElement;
  try{
    if(isFull()){(document.exitFullscreen||document.webkitExitFullscreen).call(document)}
    else{const req=el.requestFullscreen||el.webkitRequestFullscreen;const r=req&&req.call(el);if(r&&r.catch)r.catch(()=>{$('btnFull').textContent='Not available'})}
  }catch(_){$('btnFull').textContent='Not available'}
}
$('btnFull').onclick=toggleFull;
addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT'&&e.code==='KeyF'&&!e.repeat)toggleFull()});
const onFs=()=>{$('btnFull').textContent=isFull()?'Exit full screen':'Full screen';resize()};
document.addEventListener('fullscreenchange',onFs);document.addEventListener('webkitfullscreenchange',onFs);

// The key that closes a pop-up does nothing else until it is let go, so holding Space never drops a lamp.
let swallowKey=null;
const introDismiss=e=>{if(!introOpen||state!=='play')return;if(performance.now()-introAt<INTRO_MIN){e.preventDefault();e.stopPropagation();return}
  e.preventDefault();e.stopPropagation();if(e.code)swallowKey=e.code;audio();closeIntro()};
addEventListener('keydown',e=>{if((e.repeat&&introOpen)||(swallowKey&&e.code===swallowKey)){e.preventDefault();e.stopPropagation();return}introDismiss(e)},true);
addEventListener('keyup',e=>{if(e.code===swallowKey)swallowKey=null},true);
addEventListener('mousedown',introDismiss,true);
/* ---------- boot ---------- */
player=makePlayer();startLevel();banner=0;grace=99;
hud();titleCard();renderSlots();resize();requestAnimationFrame(frame);
})();
// Phones and tablets: the game needs a keyboard, so say so up front.
if(matchMedia('(hover: none) and (pointer: coarse)').matches||Math.min(screen.width,screen.height)<600){
  const note=document.getElementById('mobileNote'),app=document.getElementById('app');note.hidden=false;app.hidden=true;
  document.getElementById('mnGo').onclick=()=>{note.hidden=true;app.hidden=false}}
