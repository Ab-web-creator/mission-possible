// Visual themes per level range.
export const THEMES=[
  {name:'Dusk Dungeon', f:['#241c30','#281f35'],w:'#43385a',hi:'#5f5180',lo:'#2f2742',c:'#9a6435',cs:'#6e4524',st:'x',  acc:'#ffb347',desc:'Where it all began.'},
  {name:'Ice Cavern',   f:['#14243a','#182a42'],w:'#3d6f99',hi:'#9fd3f5',lo:'#24486a',c:'#a9dcf7',cs:'#5f9cc7',st:'ice',acc:'#9fd3f5',desc:'Cold walls, glassy ice blocks.'},
  {name:'Lava Forge',   f:['#2a1210','#321612'],w:'#3a3434',hi:'#6a5a55',lo:'#1f1a1a',c:'#6d6d78',cs:'#3a3a44',st:'rivet',acc:'#ff6a2b',desc:'Iron crates and glowing cracks.'},
  {name:'Jungle Ruins', f:['#15251a','#192b1e'],w:'#4f6b45',hi:'#82ad6b',lo:'#33482e',c:'#a5793f',cs:'#6b4f22',st:'x',  acc:'#82d86b',desc:'Mossy stones deep in the green.'},
  {name:'Desert Temple',f:['#3a2c1c','#42331f'],w:'#b08850',hi:'#e3c083',lo:'#7a5a30',c:'#8a5a32',cs:'#5a3818',st:'x',  acc:'#ffd36b',desc:'Sandstone halls under the sun.'},
  {name:'Tech Base',    f:['#151a21','#192028'],w:'#4a5563',hi:'#8695a8',lo:'#2a313b',c:'#26303b',cs:'#5fe0c8',st:'neon',acc:'#5fe0c8',desc:'Steel corridors, humming crates.'},
  {name:'Crystal Mine', f:['#1a1428','#1f182f'],w:'#3b2f5c',hi:'#6f5cab',lo:'#251d3d',c:'#c060e0',cs:'#73308f',st:'ice',acc:'#e08aff',desc:'Gems glow in the dark.'},
  {name:'Moonlit Graves',f:['#1b201c','#1f2520'],w:'#5a605a',hi:'#8c938c',lo:'#393e39',c:'#5e4a3a',cs:'#3a2c22',st:'x',  acc:'#cfe8c8',desc:'Quiet stones. Too quiet.'}
];
export const worldOf=l=>Math.floor((l-1)/5);
export const BOSS_THEME={name:'Inferno Arena',f:['#1d0809','#240a0b'],w:'#2e2428',hi:'#55404a',lo:'#150e11',c:'#3a2a30',cs:'#ff5a1c',st:'rivet',acc:'#ff5a1c',desc:'The guardians wait.'};
export const MEADOW_THEME={name:'Green Meadow',f:['#5cb83a','#63c041'],w:'#9aa4a6',hi:'#dde4e2',lo:'#66706f',c:'#c98f4c',cs:'#7a4f22',st:'x',acc:'#9cf06a',grass:true,desc:'Life is good... but doubts creep in.'};
export const themeFor=l=>l<=10?MEADOW_THEME:THEMES[(Math.floor((l-11)/10)+1)%THEMES.length];
