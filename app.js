'use strict';
const API='https://pokeapi.co/api/v2/pokemon/', TOTAL=151, LEG=[144,145,146,150,151];
const PROFILES={normal:{baseShinyChance:.03,unlimited:false},test:{baseShinyChance:.5,unlimited:true}};
const PACK_COST=100, DAILY_BASE=25, DAILY_STEP=15, DAILY_MAX=130;
const SHINY_UPGRADE_REWARD=25, REPEAT_SALE_VALUE={normal:10,shiny:25};
const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const SHINY_ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
const imageFor=(p,shiny=false)=>shiny?(p.shinyArt||SHINY_ART(p.id)):(p.art||ART(p.id));
const $=s=>document.querySelector(s), rnd=n=>Math.floor(Math.random()*n);
const KEY='pokealbum-v2';
let S={packs:3,last:Date.now(),starterPacks:5,coins:500,owned:{},stickers:{},shinyOwned:{},shinyStickers:{},profile:'normal'};
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)))}catch{}
S.owned ||= {}; S.stickers ||= {}; S.shinyOwned ||= {}; S.shinyStickers ||= {};
if(!PROFILES[S.profile])S.profile='normal';
S.coins ??=500; S.starterPacks ??=5; const starterPacksBeforeCap=Number(S.starterPacks)||0; S.starterPacks=Math.max(0,Math.min(5,starterPacksBeforeCap)); S.daily ||= {last:'',streak:0}; S.missions ||= {date:'',list:[]}; S.games ||= {date:'',played:{}}; S.claimed ||= {}; S.lifePacks ??=0;
Object.keys(S.owned).forEach(id=>{
  const extra=Math.max(0,Number(S.owned[id])-1);
  if(extra){S.stickers[id]=(S.stickers[id]||0)+extra;S.owned[id]=1}
});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
if(S.starterPacks!==starterPacksBeforeCap)save();
const say=t=>$('#live').textContent=t;
function inventoryGroups(){
  const byId=new Map();
  [...Object.entries(S.stickers).map(([id,count])=>({id:Number(id),count:Number(count),shiny:false})),
    ...Object.entries(S.shinyStickers).map(([id,count])=>({id:Number(id),count:Number(count),shiny:true}))]
    .filter(item=>item.count>0)
    .forEach(item=>{
      if(!byId.has(item.id))byId.set(item.id,[]);
      byId.get(item.id).push(item);
    });
  const pending=[], repeated=[];
  byId.forEach((items,id)=>{
    items.sort((a,b)=>Number(a.shiny)-Number(b.shiny));
    if(S.owned[id]){repeated.push(...items);return}
    let hasPending=false;
    items.forEach(item=>{
      const availableForAlbum=hasPending?0:1;
      if(availableForAlbum){pending.push({...item,count:1});hasPending=true}
      const extra=item.count-availableForAlbum;
      if(extra>0)repeated.push({...item,count:extra});
    });
  });
  return {pending,repeated,total:pending.reduce((n,item)=>n+item.count,0)+repeated.reduce((n,item)=>n+item.count,0)};
}
function updateProgress(){
  const own=Object.keys(S.owned).length;
  const groups=inventoryGroups(), loose=groups.pending.reduce((n,item)=>n+item.count,0);
  const percentage=Math.min(100,own/TOTAL*100), fill=$('#fill'), bar=$('.bar');
  fill.style.width=percentage+'%'; fill.style.setProperty('--progress-hue',String(percentage*1.2));
  bar.setAttribute('aria-valuenow',String(own));
  bar.setAttribute('aria-valuetext',`${own} de ${TOTAL} estampas pegadas, ${Math.floor(percentage)}%`);
  $('#progText').textContent=`${own} / ${TOTAL}`;
  $('#placedCount').textContent=own;
  $('#stickerN').textContent=groups.total;
  $('#looseCount').textContent=loose;
  $('#repeatedCount').textContent=groups.repeated.reduce((n,item)=>n+item.count,0);
  $('#placeAll').disabled=loose===0;
  $('#placeAll').textContent=loose?`Pegar todo (${loose})`:'Pegar todo';
  $('#clearCollection').disabled=own===0&&groups.total===0;
}

// --- Datos (PokeAPI + caché en memoria) ---
const cache={};
const speciesDescriptions={};
async function info(id){
  if(cache[id])return cache[id];
  const r=await fetch(API+id); if(!r.ok)throw new Error(r.status);
  const d=await r.json();
  const stats=d.stats.map(s=>[s.stat.name,s.base_stat]);
  const art=d.sprites.other?.['official-artwork'];
  return cache[id]={id,name:d.name,types:d.types.map(t=>t.type.name),stats,bst:stats.reduce((a,s)=>a+s[1],0),art:art?.front_default,shinyArt:art?.front_shiny};
}
async function speciesDescription(id){
  if(speciesDescriptions[id])return speciesDescriptions[id];
  const response=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
  if(!response.ok)throw new Error(response.status);
  const species=await response.json();
  const entries=species.flavor_text_entries||[];
  const entry=entries.find(item=>item.language.name==='es')||entries.find(item=>item.language.name==='en');
  return speciesDescriptions[id]=(entry?.flavor_text||'No hay una descripción disponible para esta estampa.').replace(/[\f\n\r]+/g,' ').replace(/\s+/g,' ').trim();
}
const rarity=p=>LEG.includes(p.id)?'legendary':p.bst>=500?'rare':p.bst>=400?'uncommon':'common';
const RL={common:'Común',uncommon:'Poco común',rare:'Rara',legendary:'Legendaria'};
const shinyChance=(profile=S.profile)=>PROFILES[profile].baseShinyChance;
const TYPE_LABELS={normal:'Normal',fire:'Fuego',water:'Agua',electric:'Eléctrico',grass:'Planta',ice:'Hielo',fighting:'Lucha',poison:'Veneno',ground:'Tierra',flying:'Volador',psychic:'Psíquico',bug:'Bicho',rock:'Roca',ghost:'Fantasma',dragon:'Dragón',dark:'Siniestro',steel:'Acero',fairy:'Hada'};
const TYPE_THEMES={
  normal:['#8c8864','#eeecd9'],fire:['#d94830','#fbe1c5'],water:['#2075d8','#dceeff'],electric:['#a87300','#fff1a8'],
  grass:['#29964e','#e1f2d9'],ice:['#4f9fa8','#e0f4f3'],fighting:['#a32e24','#f7ded9'],poison:['#863b94','#f0e0f3'],
  ground:['#a97532','#f3e6cf'],flying:['#666fb6','#e7e9fa'],psychic:['#bb3a70','#f8dfe9'],bug:['#687f1f','#ebf0d2'],
  rock:['#817038','#eee8d0'],ghost:['#5c498b','#e8e3f4'],dragon:['#5042b2','#e5e2fa'],dark:['#4e4542','#e7e3e1'],
  steel:['#656d78','#e8ebef'],fairy:['#ae4e83','#f7e1ec']
};
function applyTypeTheme(element,type){
  const [color,pale]=TYPE_THEMES[type]||TYPE_THEMES.normal;
  element.classList.add('type-bg'); element.dataset.type=type;
  element.style.setProperty('--type-color',color); element.style.setProperty('--type-pale',pale);
}

// --- Sobres ---
function tick(){
  document.querySelectorAll('.profile-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profile===S.profile)));
  const activeProfile=PROFILES[S.profile];
  if(activeProfile.unlimited){
    $('#packN').textContent='∞'; $('#packBtn').disabled=false;
    $('#packPrice').textContent='5 cartas · gratis';
    $('#timer').textContent='Pruebas: sobres ilimitados · 50% shiny por carta.';
    renderCoins(); return;
  }
  const packs=S.starterPacks+Math.floor(S.coins/PACK_COST);
  $('#packN').textContent=packs;
  $('#packPrice').textContent=S.starterPacks?`5 cartas · ${S.starterPacks} sobres gratis`:`5 cartas · ${PACK_COST} monedas`;
  const b=$('#packBtn'); b.disabled=!S.starterPacks&&S.coins<PACK_COST;
  const shinyLabel=`Especial: ${Math.round(shinyChance()*100)}% por carta, sin importar la rareza.`;
  $('#timer').textContent=`${S.starterPacks?`Te quedan ${S.starterPacks} sobres gratis. `:''}Después cada sobre cuesta ${PACK_COST} monedas. ${shinyLabel}`;
  renderCoins();
}
const draw=()=>Array.from({length:5},(_,i)=>Math.random()<(i===4?.15:.04)?LEG[rnd(5)]:1+rnd(TOTAL));
function updateRevealAction(){
  const cards=[...$('#cards').querySelectorAll('.card')];
  $('#close').textContent=cards.length&&cards.every(card=>card.classList.contains('on'))?'Continuar':'Voltear todas';
}

async function openPack(){
  const activeProfile=PROFILES[S.profile];
  const usesStarterPack=!activeProfile.unlimited&&S.starterPacks>0;
  if(!activeProfile.unlimited&&!usesStarterPack&&S.coins<PACK_COST)return;
  const ids=draw();
  if(!activeProfile.unlimited){if(usesStarterPack)S.starterPacks--;else S.coins-=PACK_COST;save();tick()}
  const box=$('#cards'); box.innerHTML='<p>Abriendo sobre…</p>'; $('#close').hidden=true; $('#reveal').hidden=false;
  let list;
  try{list=await Promise.all(ids.map(info))}
  catch{if(!activeProfile.unlimited){if(usesStarterPack)S.starterPacks++;else S.coins+=PACK_COST;save();tick()}box.innerHTML='<p>No se pudo conectar con la PokeAPI. Tu sobre no se gastó; inténtalo de nuevo.</p>';
    $('#close').hidden=false;$('#close').textContent='Cerrar';return}
  box.innerHTML=''; $('#close').hidden=false;
  const seen=new Set(); let shinyCount=0,newCount=0;
  list.forEach(p=>{
    p.shiny=Math.random()<shinyChance(S.profile);
    if(p.shiny)shinyCount++;
    const owned=p.shiny?S.shinyOwned:S.owned, inventory=p.shiny?S.shinyStickers:S.stickers;
    const variant=`${p.id}-${p.shiny?'shiny':'normal'}`;
    const isNew=!owned[p.id]&&!inventory[p.id]&&!seen.has(variant); seen.add(variant);
    if(isNew)newCount++;
    inventory[p.id]=(inventory[p.id]||0)+1;
    const card=document.createElement('button'); card.className='card';
    card.classList.toggle('shiny',p.shiny);
    card.setAttribute('aria-label',`Carta ${p.shiny?'shiny ':''}de ${p.name}, guardada. Pulsa para voltear.`);
    card.title='Toca para voltear; vuelve a tocar para ver los detalles.';
    card.innerHTML=`<span class="in"><span class="back"></span><span class="front type-bg r-${rarity(p)}"><img alt="" src="${imageFor(p,p.shiny)}"><b>#${p.id} ${p.name}</b><i>${RL[rarity(p)]} · ${p.types.join(', ')}</i>${isNew?'<em>¡Nueva!</em>':''}${p.shiny?'<strong class="shine-mark">SHINY</strong>':''}</span></span>`;
    const front=card.querySelector('.front'); applyTypeTheme(front,p.types[0]);
    if(p.shiny)front.classList.add('shiny');
    card.onclick=()=>{
      if(!card.classList.contains('on')){
        card.classList.add('on'); card.setAttribute('aria-label',`${p.shiny?'Shiny ':''}${p.name}, ${RL[rarity(p)]}, guardada en tus estampas`);
        trackEvent('flip',1);
        updateRevealAction(); say(`${p.name} revelada. Toca otra vez para ver los detalles.`); return;
      }
      showDetail(p.id,p.shiny);
    };
    box.append(card);
  });
  updateRevealAction();
  save(); updateProgress();
  if(!activeProfile.unlimited){S.lifePacks++;trackEvent('pack',1);trackEvent('shiny',shinyCount);trackEvent('new',newCount);checkMilestones()}
  say('Las 5 estampas del sobre se guardaron en tu colección.');
  box.querySelector('.card').focus();
}
$('#close').onclick=()=>{
  const unrevealed=[...$('#cards').querySelectorAll('.card:not(.on)')];
  if(unrevealed.length){unrevealed.forEach(card=>card.click());updateRevealAction();say('Todas las cartas del sobre están reveladas.');return}
  $('#reveal').hidden=true;$('#packBtn').focus();
};
$('#packBtn').onclick=openPack;
document.querySelectorAll('.profile-switch button').forEach(b=>b.onclick=()=>{
  S.profile=b.dataset.profile;
  save(); tick(); if(S.profile==='normal')checkMilestones(); say(S.profile==='test'?'Perfil de pruebas activado.':'Perfil normal activado.');
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reveal').hidden&&!$('#close').hidden){$('#reveal').hidden=true;$('#packBtn').focus()}});

// --- Álbum y reserva de estampas ---
const PAGE_SIZE=18, SIDE_SIZE=9, PAGE_COUNT=Math.ceil(TOTAL/PAGE_SIZE), DETAIL_DELAY=300;
const PAGE_THEMES=[
  {title:'Pueblo Paleta',accent:'#bd523c'},
  {title:'Bosque Verde',accent:'#63804b'},
  {title:'Monte Moon',accent:'#8b6a52'},
  {title:'Ciudad Celeste',accent:'#32849c'},
  {title:'Ruta costera',accent:'#ca8d35'},
  {title:'Túnel Roca',accent:'#766d60'},
  {title:'Ciudad Azulona',accent:'#ad5149'},
  {title:'Islas Espuma',accent:'#3c929e'},
  {title:'Meseta Añil',accent:'#b89444'}
];
let currentPage=0, selectedSticker=null, selectedDropTarget=null, stickerClickTimer=null;
function renderSide(target,firstId){
  target.innerHTML='';
  for(let id=firstId;id<firstId+SIDE_SIZE&&id<=TOTAL;id++){
    const has=!!S.owned[id], shiny=!!S.shinyOwned[id], b=document.createElement('button');
    b.className='album-slot '+(has?'filled':'empty')+(shiny?' shiny':''); b.dataset.slot=id;
    b.disabled=false;
    b.setAttribute('aria-label',has?`Espacio ${id}, ${cache[id]?.name||'estampa pegada'}`:
      selectedSticker?`Espacio vacío ${id}. Toca para pegar la estampa seleccionada`:`Espacio vacío ${id}`);
    if(has){
      b.innerHTML=`<img loading="lazy" alt="" src="${shiny?SHINY_ART(id):ART(id)}"><span class="slot-no">#${String(id).padStart(3,'0')}</span><span class="nm">${cache[id]?.name||' '}</span><span class="type-label"></span>${shiny?'<span class="shine-mark">SHINY</span>':''}`;
      info(id).then(p=>{const name=b.querySelector('.nm'),img=b.querySelector('img'),type=b.querySelector('.type-label');if(name)name.textContent=p.name;if(img)img.src=imageFor(p,shiny);if(type)type.textContent=TYPE_LABELS[p.types[0]]||p.types[0];applyTypeTheme(b,p.types[0]);b.setAttribute('aria-label',`Espacio ${id}, ${shiny?'shiny ':''}${p.name}, tipo ${TYPE_LABELS[p.types[0]]||p.types[0]}, estampa pegada`)}).catch(()=>{});
      b.onclick=()=>showDetail(id,shiny);
    }else{
      b.tabIndex=-1;
      b.innerHTML=`<img class="slot-ghost" loading="lazy" alt="" src="${ART(id)}"><span class="empty-no">#${String(id).padStart(3,'0')}</span><span class="empty-mark" aria-hidden="true">+</span>`;
      b.onclick=()=>{
        if(selectedSticker?.id===id)placeSticker(id,selectedSticker.shiny);
        else say(selectedSticker?`Esta estampa corresponde al espacio ${selectedSticker.id}.`:'Arrastra una estampa a su espacio correspondiente.');
      };
      b.addEventListener('dragover',e=>{
        e.preventDefault();
        const [rawId,rawShiny]=e.dataTransfer.getData('text/plain').split(':');
        const draggedId=Number(rawId)||selectedSticker?.id, shiny=rawShiny?rawShiny==='1':!!selectedSticker?.shiny;
        const inventory=shiny?S.shinyStickers:S.stickers;
        const matches=draggedId===id&&!!inventory[id]&&!S.owned[id];
        selectedDropTarget=matches?id:null;
        b.classList.toggle('drop-ready',matches); b.classList.toggle('drop-invalid',!matches);
        e.dataTransfer.dropEffect='move';
      });
      b.addEventListener('dragleave',()=>{b.classList.remove('drop-ready','drop-invalid');if(selectedDropTarget===id)selectedDropTarget=null});
      b.addEventListener('drop',e=>{
        e.preventDefault(); b.classList.remove('drop-ready','drop-invalid');
        const [rawId,rawShiny]=e.dataTransfer.getData('text/plain').split(':');
        const draggedId=Number(rawId)||selectedSticker?.id;
        const shiny=rawShiny?rawShiny==='1':!!selectedSticker?.shiny;
        const inventory=shiny?S.shinyStickers:S.stickers;
        if(draggedId!==id||!inventory[draggedId]||S.owned[id]){
          say(`Esta estampa corresponde al espacio ${draggedId||selectedSticker?.id}.`); return;
        }
        selectedSticker={id:draggedId,shiny}; selectedDropTarget=id; placeSticker(id,shiny);
      });
    }
    target.append(b);
  }
}
function updateSelection(){
  document.querySelectorAll('.loose-sticker').forEach(b=>{
    const selected=Number(b.dataset.id)===selectedSticker?.id&&(b.dataset.shiny==='true')===selectedSticker?.shiny;
    b.setAttribute('aria-pressed',String(selected)); b.classList.toggle('selected',selected);
  });
  document.querySelectorAll('.album-slot.empty').forEach(b=>{
    const inventory=selectedSticker?.shiny?S.shinyStickers:S.stickers;
    const matches=Number(b.dataset.slot)===selectedSticker?.id&&!!inventory[selectedSticker?.id]&&!S.owned[selectedSticker?.id];
    b.tabIndex=matches?0:-1;
    b.classList.toggle('drop-ready',matches); if(!matches)b.classList.remove('drop-invalid');
  });
  $('#placementHint').textContent=selectedSticker
    ?`Estampa #${String(selectedSticker.id).padStart(3,'0')} seleccionada.`
    :'Clic: ver detalle · doble clic: pegar en el álbum.';
}
function renderPage(){
  const first=currentPage*PAGE_SIZE+1, middle=first+SIDE_SIZE;
  const theme=PAGE_THEMES[currentPage], leftPage=$('.album-page[aria-label="Página izquierda"]'), rightPage=$('.album-page[aria-label="Página derecha"]');
  [[leftPage,first],[rightPage,middle]].forEach(([page,artId])=>{
    page.dataset.theme=theme.title.toLowerCase().replaceAll(' ','-');
    page.style.setProperty('--page-accent',theme.accent);
    page.style.setProperty('--page-art',`url("${ART(Math.min(artId,TOTAL))}")`);
  });
  $('#pageText').textContent=`Doble página ${currentPage+1} de ${PAGE_COUNT}`;
  $('#leftTitle').textContent=`${theme.title} · ${String(first).padStart(3,'0')}–${String(Math.min(first+SIDE_SIZE-1,TOTAL)).padStart(3,'0')}`;
  $('#rightTitle').textContent=middle<=TOTAL?`${theme.title} · ${String(middle).padStart(3,'0')}–${String(Math.min(middle+SIDE_SIZE-1,TOTAL)).padStart(3,'0')}`:'Final de Kanto';
  $('#prevPage').disabled=currentPage===0; $('#nextPage').disabled=currentPage===PAGE_COUNT-1;
  renderSide($('#leftSlots'),first); renderSide($('#rightSlots'),middle); updateSelection();
}
function renderStock(){
  clearTimeout(stickerClickTimer); stickerClickTimer=null;
  const stock=$('#stickerStock'); stock.innerHTML='';
  const {pending:entries}=inventoryGroups();
  $('#stockEmpty').hidden=entries.length>0;
  entries.forEach(({id,count,shiny})=>{
    const b=document.createElement('button'); b.className='loose-sticker'; b.dataset.id=id;
    b.dataset.shiny=String(shiny); b.classList.toggle('shiny',shiny);
    b.draggable=true; b.title='Clic para ver; doble clic para pegar; arrastra al espacio.';
    b.setAttribute('aria-pressed',String(id===selectedSticker?.id&&shiny===selectedSticker?.shiny));
    b.setAttribute('aria-label',`Estampa ${shiny?'shiny ':''}número ${id}, cantidad ${count}`);
    b.innerHTML=`<img loading="lazy" alt="" src="${shiny?SHINY_ART(id):ART(id)}"><span class="loose-no">#${String(id).padStart(3,'0')}</span><span class="nm">…</span><span class="type-label"></span>${shiny?'<span class="shine-mark">SHINY</span>':''}<em>×${count}</em>`;
    info(id).then(p=>{const name=b.querySelector('.nm'),img=b.querySelector('img'),type=b.querySelector('.type-label');if(name)name.textContent=p.name;if(img)img.src=imageFor(p,shiny);if(type)type.textContent=TYPE_LABELS[p.types[0]]||p.types[0];applyTypeTheme(b,p.types[0]);b.setAttribute('aria-label',`Estampa ${shiny?'shiny ':''}${p.name}, tipo ${TYPE_LABELS[p.types[0]]||p.types[0]}, ${count} en reserva`)}).catch(()=>{});
    b.onclick=()=>{
      clearTimeout(stickerClickTimer);
      stickerClickTimer=setTimeout(()=>{stickerClickTimer=null;showDetail(id,shiny)},DETAIL_DELAY);
    };
    b.addEventListener('dblclick',()=>{
      clearTimeout(stickerClickTimer); stickerClickTimer=null;
      if(S.owned[id]){
        if(shiny&&!S.shinyOwned[id])showDetail(id,true);
        else say(`El espacio ${id} ya tiene una estampa pegada.`);
        return;
      }
      currentPage=Math.floor((id-1)/PAGE_SIZE); placeSticker(id,shiny);
    });
    b.addEventListener('dragstart',e=>{
      clearTimeout(stickerClickTimer); stickerClickTimer=null;
      selectedSticker={id,shiny}; selectedDropTarget=null;
      const targetPage=Math.floor((id-1)/PAGE_SIZE);
      if(currentPage!==targetPage){currentPage=targetPage;renderPage()}
      e.dataTransfer.setData('text/plain',`${id}:${shiny?'1':'0'}`); e.dataTransfer.effectAllowed='move';
      b.classList.add('dragging'); renderPage(); say(`Estampa ${shiny?'shiny ':''}${id} arrastrada. Su espacio está resaltado.`);
    });
    b.addEventListener('dragend',e=>{
      b.classList.remove('dragging');
      const inventory=shiny?S.shinyStickers:S.stickers;
      const pointedSlot=document.elementFromPoint(e.clientX,e.clientY)?.closest('.album-slot.empty');
      const targetId=selectedDropTarget||Number(pointedSlot?.dataset.slot);
      if(targetId===id&&inventory[id]&&!S.owned[id])placeSticker(id,shiny);
      selectedDropTarget=null;
      if(selectedSticker?.id===id&&selectedSticker.shiny===shiny){selectedSticker=null;updateSelection()}
    });
    stock.append(b);
  });
}
function renderRepeated(){
  const stock=$('#repeatedStock'); stock.innerHTML='';
  const {repeated}=inventoryGroups();
  $('#repeatedEmpty').hidden=repeated.length>0;
  repeated.sort((a,b)=>a.id-b.id||Number(a.shiny)-Number(b.shiny)).forEach(({id,count,shiny})=>{
    const b=document.createElement('article'); b.className='loose-sticker repeated'; b.dataset.id=id; b.dataset.shiny=String(shiny); b.setAttribute('role','group');
    b.classList.toggle('shiny',shiny);
    b.classList.toggle('shine-offer',shiny&&!!S.owned[id]&&!S.shinyOwned[id]);
    b.setAttribute('aria-label',`Estampa repetida ${shiny?'shiny ':''}número ${id}, cantidad ${count}`);
    b.innerHTML=`<img loading="lazy" alt="" src="${shiny?SHINY_ART(id):ART(id)}"><span class="loose-no">#${String(id).padStart(3,'0')}</span><span class="nm">…</span><span class="type-label"></span>${shiny?'<span class="shine-mark">SHINY</span>':''}<span class="repeat-tag">REPETIDA</span><em>×${count}</em><span class="repeat-actions"><button class="repeat-details" type="button">Ver</button><button class="sell-repeat" type="button" ${S.profile==='test'?'disabled':''}>Vender · ${REPEAT_SALE_VALUE[shiny?'shiny':'normal']} ◉</button></span>`;
    info(id).then(p=>{const name=b.querySelector('.nm'),img=b.querySelector('img'),type=b.querySelector('.type-label');if(name)name.textContent=p.name;if(img)img.src=imageFor(p,shiny);if(type)type.textContent=TYPE_LABELS[p.types[0]]||p.types[0];applyTypeTheme(b,p.types[0]);b.setAttribute('aria-label',`Estampa repetida ${shiny?'shiny ':''}${p.name}, tipo ${TYPE_LABELS[p.types[0]]||p.types[0]}, ${count} en reserva`)}).catch(()=>{});
    b.querySelector('.repeat-details').onclick=()=>showDetail(id,shiny);
    b.querySelector('.sell-repeat').onclick=()=>sellRepeated(id,shiny);
    b.addEventListener('dblclick',()=>{
      clearTimeout(stickerClickTimer); stickerClickTimer=null;
      if(S.owned[id]){say(`El espacio ${id} ya tiene una estampa pegada.`);return}
      currentPage=Math.floor((id-1)/PAGE_SIZE); placeSticker(id,shiny);
    });
    stock.append(b);
  });
}
function renderAlbum(){
  updateProgress(); renderStock(); renderRepeated(); renderPage();
}
$('#clearCollection').onclick=()=>{
  const placed=Object.keys(S.owned).length, loose=Object.values(S.stickers).reduce((a,n)=>a+n,0)+Object.values(S.shinyStickers).reduce((a,n)=>a+n,0);
  if(!placed&&!loose)return;
  if(!confirm(`Se borrarán ${placed} estampas pegadas y ${loose} en reserva. Esta acción no se puede deshacer. ¿Continuar?`))return;
  S.owned={}; S.stickers={}; S.shinyOwned={}; S.shinyStickers={}; selectedSticker=null; selectedDropTarget=null; currentPage=0;
  save(); renderAlbum(); say('Colección vaciada.');
};
function placeSticker(id,shiny=false,replaceNormal=false){
  const inventory=shiny?S.shinyStickers:S.stickers;
  if(!inventory[id]||(S.owned[id]&&!replaceNormal))return;
  if(replaceNormal&&(!shiny||!S.owned[id]||S.shinyOwned[id]))return;
  inventory[id]--; if(!inventory[id])delete inventory[id];
  if(replaceNormal)S.stickers[id]=(S.stickers[id]||0)+1;
  S.owned[id]=1; if(shiny)S.shinyOwned[id]=1;else delete S.shinyOwned[id]; selectedSticker=null; selectedDropTarget=null;
  save(); renderAlbum(); if(S.profile==='normal'){if(!replaceNormal)trackEvent('place',1);checkMilestones()}
  if(replaceNormal&&S.profile==='normal')award(SHINY_UPGRADE_REWARD,'Mejora shiny aplicada.');
  say(replaceNormal?`Estampa shiny #${String(id).padStart(3,'0')} pegada; la normal volvió a repetidas.${S.profile==='normal'?` Ganaste ${SHINY_UPGRADE_REWARD} monedas.`:''}`:`Estampa ${shiny?'shiny ':''}#${String(id).padStart(3,'0')} pegada en el espacio ${id}.`);
  document.querySelector(`[data-slot="${id}"]`)?.focus();
}
function placeAllStickers(){
  const {pending}=inventoryGroups(); let placed=0;
  pending.forEach(({id,shiny})=>{
    const inventory=shiny?S.shinyStickers:S.stickers;
    if(S.owned[id]||!inventory[id])return;
    inventory[id]--; if(!inventory[id])delete inventory[id];
    S.owned[id]=1; if(shiny)S.shinyOwned[id]=1;else delete S.shinyOwned[id];
    placed++;
  });
  if(!placed){say('No tienes estampas disponibles para pegar.');return}
  selectedSticker=null; selectedDropTarget=null; save(); renderAlbum();
  if(S.profile==='normal'){trackEvent('place',placed);checkMilestones()}
  say(`Pegaste ${placed} estampa${placed===1?'':'s'} en el álbum.`);
}
$('#placeAll').onclick=placeAllStickers;
function sellRepeated(id,shiny=false){
  if(S.profile==='test'){say('Las ventas no están disponibles en el perfil de pruebas.');return}
  const inventory=shiny?S.shinyStickers:S.stickers;
  const repeated=inventoryGroups().repeated.some(item=>item.id===id&&item.shiny===shiny&&item.count>0);
  if(!inventory[id]||!repeated)return;
  inventory[id]--; if(!inventory[id])delete inventory[id];
  const value=REPEAT_SALE_VALUE[shiny?'shiny':'normal'];
  save(); renderAlbum(); award(value,`Estampa repetida${shiny?' shiny':''} vendida.`);
  say(`Vendiste una estampa repetida ${shiny?'shiny ':''}#${String(id).padStart(3,'0')} por ${value} monedas.`);
}
$('#prevPage').onclick=()=>{if(currentPage>0){currentPage--;renderPage()}};
$('#nextPage').onclick=()=>{if(currentPage<PAGE_COUNT-1){currentPage++;renderPage()}};
async function showDetail(id,shiny=false){
  try{const p=await info(id);
    const inventory=shiny?S.shinyStickers:S.stickers, isPlaced=!!S.owned[id]&&!!S.shinyOwned[id]===shiny;
    const replaceNormal=shiny&&!!S.owned[id]&&!S.shinyOwned[id]&&!!inventory[id];
    const status=isPlaced?'Pegada':replaceNormal?'Shiny repetida · puedes cambiarla':'En reserva';
    const description=await speciesDescription(id).catch(()=> 'La descripción no está disponible ahora.');
    $('#detailBody').innerHTML=`<article class="detail-sticker${shiny?' is-shiny':''}"><div class="detail-topline"><span>POKÉÁLBUM · KANTO</span><span>#${String(id).padStart(3,'0')}</span></div><div class="detail-art type-bg${shiny?' shiny':''}"><img alt="${shiny?'Shiny ':''}${p.name}" src="${imageFor(p,shiny)}">${shiny?'<span class="shine-mark">SHINY</span>':''}</div><div class="detail-copy"><p class="detail-eyebrow">${RL[rarity(p)]}${shiny?' · VARIANTE SHINY':''}</p><h3>${p.name}</h3><div class="detail-types">${p.types.map(type=>`<span>${TYPE_LABELS[type]||type}</span>`).join('')}</div><p class="detail-description">${description}</p><p class="detail-inventory">${status} · ×${inventory[id]||(isPlaced?1:0)||1}</p></div></article>`;
    applyTypeTheme($('#detailBody .detail-art'),p.types[0]);
    $('#detailBody .detail-art').classList.toggle('shiny',shiny);
    $('#placeSticker').dataset.id=id; $('#placeSticker').dataset.shiny=String(shiny); $('#placeSticker').textContent=replaceNormal?(S.profile==='normal'?`Cambiar por shiny · +${SHINY_UPGRADE_REWARD} monedas`:'Cambiar por shiny · Pruebas'):'Pegar en el álbum';
    $('#placeSticker').classList.toggle('replace-shiny',replaceNormal); $('#placeSticker').hidden=!inventory[id]||!!S.owned[id]&&!replaceNormal;
    $('#removeSticker').dataset.id=id; $('#removeSticker').dataset.shiny=String(shiny); $('#removeSticker').hidden=!isPlaced;
    $('#detail').showModal();
  }catch{say('No se pudo cargar el detalle. Revisa tu conexión.')}
}
$('#placeSticker').onclick=()=>{
  const id=Number($('#placeSticker').dataset.id), shiny=$('#placeSticker').dataset.shiny==='true';
  const replaceNormal=shiny&&!!S.owned[id]&&!S.shinyOwned[id];
  if(!(shiny?S.shinyStickers:S.stickers)[id]||(S.owned[id]&&!replaceNormal))return;
  $('#detail').close(); currentPage=Math.floor((id-1)/PAGE_SIZE); renderPage(); placeSticker(id,shiny,replaceNormal);
};
$('#removeSticker').onclick=()=>{
  const id=Number($('#removeSticker').dataset.id), shiny=$('#removeSticker').dataset.shiny==='true';
  if(!S.owned[id]||!!S.shinyOwned[id]!==shiny)return;
  const inventory=shiny?S.shinyStickers:S.stickers; inventory[id]=(inventory[id]||0)+1;
  delete S.owned[id]; delete S.shinyOwned[id];
  save(); $('#detail').close(); renderAlbum(); say(`Estampa ${shiny?'shiny ':''}${id} devuelta a tu reserva.`);
  document.querySelector(`[data-slot="${id}"]`)?.focus();
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x===b?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  $('#packs').hidden=b.dataset.tab!=='packs'; $('#album').hidden=b.dataset.tab!=='album'; $('#quests').hidden=b.dataset.tab!=='quests';
  if(b.dataset.tab==='album')renderAlbum(); if(b.dataset.tab==='quests')renderQuests();
});

const MISSION_POOL=[
  {type:'pack',goal:1,reward:50,label:'Abre 1 sobre'},
  {type:'pack',goal:3,reward:100,label:'Abre 3 sobres'},
  {type:'place',goal:3,reward:60,label:'Pega 3 estampas'},
  {type:'place',goal:9,reward:110,label:'Pega 9 estampas'},
  {type:'flip',goal:5,reward:40,label:'Revela 5 cartas'},
  {type:'flip',goal:15,reward:90,label:'Revela 15 cartas'},
  {type:'shiny',goal:1,reward:90,label:'Consigue una estampa shiny'},
  {type:'new',goal:3,reward:60,label:'Descubre 3 estampas nuevas'},
  {type:'new',goal:8,reward:110,label:'Descubre 8 estampas nuevas'},
  {type:'place',goal:6,reward:80,label:'Pega 6 estampas'},
  {type:'typeCorrect',goal:3,reward:70,label:'Acierta 3 tipos en el minijuego'},
  {type:'guessCorrect',goal:3,reward:70,label:'Adivina 3 Pokémon'},
  {type:'gameComplete',goal:1,reward:50,label:'Completa un minijuego'}
];
const MILESTONES=[
  {id:'p10',label:'Pega 10 estampas',reward:90,done:()=>placedCount()>=10},
  {id:'page1',label:'Completa una página de 9 espacios',reward:120,done:anyPageComplete},
  {id:'p25',label:'Pega 25 estampas',reward:180,done:()=>placedCount()>=25},
  {id:'shiny1',label:'Consigue una estampa shiny',reward:100,done:()=>Object.keys(S.shinyOwned).length+Object.keys(S.shinyStickers).length>0},
  {id:'p50',label:'Pega 50 estampas',reward:350,done:()=>placedCount()>=50},
  {id:'p100',label:'Pega 100 estampas',reward:700,done:()=>placedCount()>=100},
  {id:'full',label:'Completa el álbum de Kanto',reward:1200,done:()=>placedCount()>=TOTAL}
];
const localDate=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
const previousDate=key=>{const date=new Date(`${key}T12:00:00`);date.setDate(date.getDate()-1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
function placedCount(){return Object.keys(S.owned).length}
function anyPageComplete(){
  for(let first=1;first<=TOTAL;first+=SIDE_SIZE){let complete=true;for(let id=first;id<first+SIDE_SIZE&&id<=TOTAL;id++)if(!S.owned[id]){complete=false;break}if(complete)return true}
  return false;
}
function ensureMissions(){
  const today=localDate();
  if(S.missions.date===today&&S.missions.list.length>=6)return;
  if(S.missions.date===today){
    const available=MISSION_POOL.filter(candidate=>!S.missions.list.some(mission=>mission.type===candidate.type&&mission.goal===candidate.goal));
    while(S.missions.list.length<6&&available.length){const index=rnd(available.length);S.missions.list.push({...available.splice(index,1)[0],progress:0,claimed:false})}
    save(); return;
  }
  const pool=[...MISSION_POOL], list=[];
  while(list.length<6){const index=rnd(pool.length);list.push({...pool.splice(index,1)[0],progress:0,claimed:false})}
  S.missions={date:today,list}; save();
}
function ensureGames(){
  const today=localDate();
  if(S.games.date!==today)S.games={date:today,played:{}};
}
function missionLabel(type){return {pack:'Sobres abiertos',place:'Estampas pegadas',flip:'Cartas reveladas',shiny:'Estampas shiny',new:'Estampas nuevas',typeCorrect:'Tipos acertados',guessCorrect:'Pokémon adivinados',gameComplete:'Minijuegos completados'}[type]||type}
function trackEvent(type,amount){
  if(S.profile==='test'||!amount)return;
  ensureMissions(); let changed=false;
  S.missions.list.forEach(mission=>{if(mission.type===type&&!mission.claimed){mission.progress=Math.min(mission.goal,mission.progress+amount);changed=true}});
  if(changed){save();updateQuestBadge();if(!$('#quests').hidden)renderQuests()}
}
function award(amount,message){S.coins+=amount;save();updateEconomy();showToast(`${message} +${amount} monedas`)}
function checkMilestones(){
  if(S.profile==='test')return;
  MILESTONES.forEach(milestone=>{if(!S.claimed[milestone.id]&&milestone.done()){S.claimed[milestone.id]=true;award(milestone.reward,`Hito: ${milestone.label}.`)}});
}
function nextStreak(){return S.daily.last===previousDate(localDate())?S.daily.streak+1:1}
function dailyReward(){return Math.min(DAILY_MAX,DAILY_BASE+(nextStreak()-1)*DAILY_STEP)}
function dailyAvailable(){return S.daily.last!==localDate()}
function claimDaily(){
  if(!dailyAvailable())return;
  S.daily={last:localDate(),streak:nextStreak()}; award(Math.min(DAILY_MAX,DAILY_BASE+(S.daily.streak-1)*DAILY_STEP),`Bono diario · racha ${S.daily.streak}`); renderQuests();
}
function claimMission(index){
  const mission=S.missions.list[index]; if(!mission||mission.claimed||mission.progress<mission.goal)return;
  mission.claimed=true; save(); award(mission.reward,'Misión completada.'); renderQuests();
}
const GAME_LABELS={types:'Tipo relámpago',silhouette:'Silueta misteriosa'};
let activeGame=null;
function renderGames(){
  ensureGames();
  const list=$('#gameList'); list.replaceChildren();
  Object.entries(GAME_LABELS).forEach(([kind,label])=>{
    const played=!!S.games.played[kind], item=document.createElement('li'); item.className='game-card';
    const info=document.createElement('div'), title=document.createElement('b'), description=document.createElement('p'), button=document.createElement('button');
    title.textContent=label;
    description.textContent=kind==='types'?'Identifica el tipo principal de 5 Pokémon.':'Reconoce 5 Pokémon por su silueta.';
    button.type='button'; button.className='game-start'; button.disabled=played;
    button.textContent=played?'Jugado hoy':'Jugar'; button.onclick=()=>startGame(kind);
    info.append(title,description); item.append(info,button); list.append(item);
  });
}
function shuffled(items){return items.sort(()=>Math.random()-.5)}
async function loadGameRound(game){
  const area=$('#gamePlay'); area.replaceChildren(); area.hidden=false;
  const status=document.createElement('p'); status.className='game-status'; status.textContent=`Ronda ${game.round+1} de 5 · Aciertos: ${game.correct}`;
  const question=document.createElement('h4'); question.textContent='Cargando pregunta…'; area.append(status,question);
  try{
    const id=1+rnd(TOTAL), target=await info(id);
    let choices;
    if(game.kind==='types'){
      const types=Object.keys(TYPE_LABELS), distractors=shuffled(types.filter(type=>!target.types.includes(type))).slice(0,3);
      choices=shuffled([...new Set([target.types[0],...distractors])]).map(type=>({value:type,label:TYPE_LABELS[type]}));
    }else{
      const ids=new Set([id]); while(ids.size<4)ids.add(1+rnd(TOTAL));
      const pokemon=await Promise.all([...ids].map(info));
      choices=shuffled(pokemon.map(p=>({value:p.id,label:p.name})));
    }
    if(activeGame!==game)return;
    game.question={target,choices}; area.replaceChildren(status);
    question.textContent=game.kind==='types'?`¿Cuál es el tipo principal de ${target.name}?`:'¿Qué Pokémon se esconde en la silueta?';
    area.append(question);
    if(game.kind==='silhouette'){
      const image=document.createElement('img'); image.className='game-silhouette'; image.src=imageFor(target); image.alt='Silueta de un Pokémon';
      area.append(image);
    }
    const options=document.createElement('div'); options.className='game-options';
    choices.forEach(choice=>{
      const button=document.createElement('button'); button.type='button'; button.className='game-option'; button.textContent=choice.label;
      button.onclick=()=>answerGame(game,choice.value,options);
      options.append(button);
    });
    area.append(options);
  }catch{
    if(activeGame!==game)return;
    area.replaceChildren(status);
    const message=document.createElement('p'); message.textContent='No se pudo cargar la pregunta. Comprueba tu conexión.';
    const retry=document.createElement('button'); retry.type='button'; retry.className='game-start'; retry.textContent='Reintentar'; retry.onclick=()=>loadGameRound(game);
    area.append(message,retry);
  }
}
function answerGame(game,value,options){
  if(activeGame!==game||game.answered)return;
  game.answered=true;
  const {target,choices}=game.question, answer=game.kind==='types'?target.types[0]:target.id;
  const correct=value===answer;
  if(correct){game.correct++;trackEvent(game.kind==='types'?'typeCorrect':'guessCorrect',1)}
  options.querySelectorAll('button').forEach(button=>{
    button.disabled=true;
    const choice=choices.find(item=>item.label===button.textContent);
    if(choice?.value===answer)button.classList.add('correct');
    else if(choice?.value===value)button.classList.add('incorrect');
  });
  const result=document.createElement('p'); result.className='game-result';
  result.textContent=correct?'¡Correcto!':`La respuesta era ${game.kind==='types'?TYPE_LABELS[answer]:target.name}.`;
  const next=document.createElement('button'); next.type='button'; next.className='game-start';
  next.textContent=game.round===4?'Ver recompensa':'Siguiente';
  next.onclick=()=>{
    if(game.round===4){finishGame(game);return}
    game.round++; game.answered=false; loadGameRound(game);
  };
  $('#gamePlay').append(result,next);
}
function startGame(kind){
  ensureGames(); if(S.games.played[kind]||activeGame)return;
  activeGame={kind,round:0,correct:0,answered:false}; loadGameRound(activeGame);
}
function finishGame(game){
  if(activeGame!==game)return;
  S.games.played[game.kind]=true; save(); trackEvent('gameComplete',1);
  const reward=10+game.correct*10+(game.correct>=4?20:0);
  activeGame=null; $('#gamePlay').hidden=true; award(reward,`${GAME_LABELS[game.kind]} · ${game.correct}/5`);
  renderQuests();
}
function renderCoins(){
  const count=$('#coinCount'); if(count)count.textContent=S.coins.toLocaleString('es-ES');
}
function pulseCoins(){$('#coinPill').classList.remove('pulse');requestAnimationFrame(()=>$('#coinPill').classList.add('pulse'))}
function showToast(message){
  const toast=$('#toast'), item=document.createElement('p'); item.className='toast-item'; item.textContent=message; toast.replaceChildren(item);
  requestAnimationFrame(()=>item.classList.add('show'));setTimeout(()=>{item.classList.remove('show');setTimeout(()=>item.remove(),250)},2600);pulseCoins();
}
function updateQuestBadge(){
  ensureGames();
  const ready=(dailyAvailable()?1:0)+S.missions.list.filter(mission=>!mission.claimed&&mission.progress>=mission.goal).length;
  $('#questN').textContent=ready+Object.keys(GAME_LABELS).filter(kind=>!S.games.played[kind]).length;
}
function updateEconomy(){renderCoins();tick();updateQuestBadge()}
function renderQuests(){
  ensureMissions(); ensureGames();
  const dailyDone=!dailyAvailable();
  $('#dailyText').textContent=dailyDone?`Bono reclamado: ${S.daily.streak} días de racha.`:`Reclama ${dailyReward()} monedas · racha ${nextStreak()} día${nextStreak()===1?'':'s'}.`;
  $('#streakText').textContent=`Racha actual: ${S.daily.streak} día${S.daily.streak===1?'':'s'}`;
  $('#dailyBtn').disabled=dailyDone; $('#dailyBtn').textContent=dailyDone?'Reclamado':'Reclamar bono';
  const missions=$('#missionList'); missions.replaceChildren();
  S.missions.list.forEach((mission,index)=>{
    const item=document.createElement('li'); item.className='mission';
    if(mission.claimed)item.classList.add('claimed');else if(mission.progress>=mission.goal)item.classList.add('ready');
    const progress=Math.min(mission.goal,mission.progress);
    item.innerHTML=`<div class="m-main"><b>${mission.label}</b><span>${mission.claimed?'Reclamada':`${progress} / ${mission.goal} · ${missionLabel(mission.type)}`}</span><div class="m-progress"><i style="width:${progress/mission.goal*100}%"></i></div></div><b class="m-reward">${mission.reward} ◉</b><button class="m-action" type="button" ${mission.claimed||progress<mission.goal?'disabled':''}>${mission.claimed?'Lista':progress>=mission.goal?'Reclamar':'En curso'}</button>`;
    item.querySelector('button').onclick=()=>claimMission(index); missions.append(item);
  });
  renderGames();
  const milestones=$('#milestoneList'); milestones.replaceChildren();
  MILESTONES.forEach(milestone=>{
    const done=!!S.claimed[milestone.id]||milestone.done(), item=document.createElement('li'); item.className='milestone'; item.classList.toggle('done',done);
    item.innerHTML=`<span>${milestone.label}</span><b class="m-reward">${S.claimed[milestone.id]?'✓':`${milestone.reward} ◉`}</b>`; milestones.append(item);
  });
  updateQuestBadge();
}
$('#dailyBtn').onclick=claimDaily;

ensureMissions(); tick(); updateProgress(); renderQuests(); checkMilestones(); updateEconomy();
