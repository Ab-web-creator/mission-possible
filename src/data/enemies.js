// Demon types (speed, damage, AI) and power-up items. Tweak balance here.
export const ETYPES={
  gloop:  {name:'Carelessness',  speed:1.5, hp:1, pts:100, dmg:1, ai:'wander', avoid:false, ghost:false, col:'#4fd1b0'},
  skitter:{name:'Anxiety',speed:1.4, hp:1, pts:200, dmg:1, ai:'pace', range:99, shoot:'pellet', cd:1.6, sdmg:1, avoid:true, ghost:false, col:'#c8102e'},
  wisp:   {name:'Despair',   speed:1.2, hp:1, pts:300, dmg:2, ai:'drift', avoid:true, ghost:true, col:'#9fd8ff'},
  suspect:{name:'Suspicion', speed:0.95, hp:1, pts:450, dmg:2, ai:'wander', avoid:false, ghost:false, col:'#b79ad8', shoot:'single', cd:2.2, sdmg:2, range:99},
  accuse: {name:'Accusation', speed:1.25, hp:1, pts:400, dmg:1, ai:'wander', avoid:true, ghost:false, col:'#8a6fb0', shoot:'auto', cd:2.6, sdmg:1, range:99},
  doubt:  {name:'Doubt', speed:1.2, hp:1, pts:150, dmg:1, ai:'wander', avoid:false, ghost:false, col:'#a8a48c', shoot:'pellet', cd:1.3, sdmg:1, range:99},
  spitter:{name:'Anger',speed:1.4, hp:1, pts:250, dmg:2, ai:'wander', avoid:false, ghost:false, col:'#ff5a1c', shoot:'single', cd:2.2, sdmg:2, range:99},
  lion:   {name:'Fire Lion',speed:1.1,hp:3, pts:800, dmg:5, ai:'chase', range:9, avoid:true, ghost:false, col:'#e0a030', shoot:'lion', cd:3.2, sdmg:3, srange:9},
  giant:  {name:'Death',speed:0,hp:10,pts:3000,dmg:4,ai:'none',avoid:false,ghost:true,col:'#ff7a1c'},
  idol:   {name:'Demon Idol',speed:0,hp:5, pts:1500, dmg:3, ai:'none', avoid:false, ghost:false, col:'#b0283a'},
  lies:   {name:'Lies',  speed:1.3, hp:1, pts:350, dmg:1, ai:'wander', avoid:true, ghost:false, col:'#b07cff'},
  theft:  {name:'Theft', speed:2.2, hp:1, pts:400, dmg:1, ai:'thief', avoid:true, ghost:false, col:'#9aa3b5'},
  greed:  {name:'Greed', speed:3.78,hp:1, pts:450, dmg:2, ai:'hunt', avoid:false, ghost:false, col:'#d4b030'},
  murder: {name:'Murder',speed:1.1, hp:1, pts:600, dmg:3, ai:'pace', range:99, avoid:true, ghost:false, col:'#c0182e'},
  brute:  {name:'Hatred',  speed:1.35,hp:2, pts:500, dmg:4, ai:'chase', range:10, avoid:true, ghost:false, col:'#7fa845'}
};
export const BASE_FUSE=2.4,MIN_FUSE=1.8;
export const SPEED_STEP=0.8,SPEED_MAX=3.6+SPEED_STEP*6,FAST_SPEED=9,FAST_TIME=15;
export const ITEMS={
  bomb:{col:'#ff8a5c',label:'Extra lamp'}, fire:{col:'#ffcf4a',label:'Brighter lamp'},
  speed:{col:'#5fe0c8',label:'Shoes of Peace'},
  shield:{col:'#8fb8ff',label:'Shield of Faith'},
  heal:{col:'#ff3d6e',label:'+1 heart'},
  fullheal:{col:'#ffd23a',label:'Full health!'},
  reveal:{col:'#bff4ff',label:'Light of Truth'},
  quick:{col:'#ff7ad9',label:'Quick Light'}
};
