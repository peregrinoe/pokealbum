'use strict';
const API='https://pokeapi.co/api/v2/pokemon/', TOTAL=151, LEG=[144,145,146,150,151], REGEN=10*60*1000, MAXP=5;
const PROFILES={normal:{baseShinyChance:.04,unlimited:false},test:{baseShinyChance:.5,unlimited:true}};
const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const SHINY_ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
const imageFor=(p,shiny=false)=>shiny?(p.shinyArt||SHINY_ART(p.id)):(p.art||ART(p.id));
const $=s=>document.querySelector(s), rnd=n=>Math.floor(Math.random()*n);
const KEY='pokealbum-v2';
let S={packs:3,last:Date.now(),owned:{},stickers:{},shinyOwned:{},shinyStickers:{},profile:'normal'};
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)))}catch{}
S.owned ||= {}; S.stickers ||= {}; S.shinyOwned ||= {}; S.shinyStickers ||= {};
if(!PROFILES[S.profile])S.profile='normal';
Object.keys(S.owned).forEach(id=>{
  const extra=Math.max(0,Number(S.owned[id])-1);
  if(extra){S.stickers[id]=(S.stickers[id]||0)+extra;S.owned[id]=1}
});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
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
  $('#fill').style.width=own/TOTAL*100+'%';
  $('#progText').textContent=`${own} / ${TOTAL}`;
  $('#placedCount').textContent=own;
  $('#stickerN').textContent=groups.total;
  $('#looseCount').textContent=loose;
  $('#repeatedCount').textContent=groups.repeated.reduce((n,item)=>n+item.count,0);
  $('#clearCollection').disabled=own===0&&groups.total===0;
}

// --- Datos (PokeAPI + caché en memoria) ---
const cache={};
async function info(id){
  if(cache[id])return cache[id];
  const r=await fetch(API+id); if(!r.ok)throw new Error(r.status);
  const d=await r.json();
  const stats=d.stats.map(s=>[s.stat.name,s.base_stat]);
  const art=d.sprites.other?.['official-artwork'];
  return cache[id]={id,name:d.name,types:d.types.map(t=>t.type.name),stats,bst:stats.reduce((a,s)=>a+s[1],0),art:art?.front_default,shinyArt:art?.front_shiny};
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
    S.last=Date.now();
    $('#packN').textContent='∞'; $('#packBtn').disabled=false;
    $('#timer').textContent='Pruebas: sobres ilimitados · 50% shiny por carta.';
    save(); return;
  }
  const n=Date.now();
  while(S.packs<MAXP && n-S.last>=REGEN){S.packs++;S.last+=REGEN}
  if(S.packs>=MAXP)S.last=n;
  $('#packN').textContent=S.packs;
  const b=$('#packBtn'); b.disabled=S.packs<1;
  const left=Math.max(0,REGEN-(n-S.last)), m=Math.floor(left/6e4), s=Math.floor(left%6e4/1e3);
  const shinyLabel=`Shiny: ${Math.round(shinyChance()*100)}% por carta, sin importar la rareza.`;
  $('#timer').textContent=S.packs>=MAXP?`Tienes ${S.packs} sobres disponibles. ${shinyLabel}`:`Próximo sobre gratis en ${m}:${String(s).padStart(2,'0')} · ${shinyLabel}`;
  save();
}
const draw=()=>Array.from({length:5},(_,i)=>Math.random()<(i===4?.15:.04)?LEG[rnd(5)]:1+rnd(TOTAL));

async function openPack(){
  const activeProfile=PROFILES[S.profile];
  if(!activeProfile.unlimited&&S.packs<1)return;
  const ids=draw();
  if(!activeProfile.unlimited){S.packs--;save();tick()}
  const box=$('#cards'); box.innerHTML='<p>Abriendo sobre…</p>'; $('#reveal').hidden=false;
  let list;
  try{list=await Promise.all(ids.map(info))}
  catch{if(!activeProfile.unlimited){S.packs++;save();tick()}box.innerHTML='<p>No se pudo conectar con la PokeAPI. Tu sobre no se gastó; inténtalo de nuevo.</p>';
    $('#close').hidden=false;$('#close').textContent='Cerrar';return}
  box.innerHTML=''; $('#close').hidden=false; $('#close').textContent='Continuar';
  const seen=new Set();
  list.forEach(p=>{
    p.shiny=Math.random()<shinyChance(S.profile);
    const owned=p.shiny?S.shinyOwned:S.owned, inventory=p.shiny?S.shinyStickers:S.stickers;
    const variant=`${p.id}-${p.shiny?'shiny':'normal'}`;
    const isNew=!owned[p.id]&&!inventory[p.id]&&!seen.has(variant); seen.add(variant);
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
        say(`${p.name} revelada. Toca otra vez para ver los detalles.`); return;
      }
      showDetail(p.id,p.shiny);
    };
    box.append(card);
  });
  save(); updateProgress(); say('Las 5 estampas del sobre se guardaron en tu colección.');
  box.querySelector('.card').focus();
}
$('#close').onclick=()=>{$('#reveal').hidden=true;renderAlbum();$('#packBtn').focus()};
$('#packBtn').onclick=openPack;
document.querySelectorAll('.profile-switch button').forEach(b=>b.onclick=()=>{
  S.profile=b.dataset.profile; if(S.profile==='test')S.last=Date.now();
  save(); tick(); say(S.profile==='test'?'Perfil de pruebas activado.':'Perfil normal activado.');
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reveal').hidden&&!$('#close').hidden)$('#close').click()});

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
    const b=document.createElement('button'); b.className='loose-sticker repeated'; b.dataset.id=id; b.dataset.shiny=String(shiny);
    b.classList.toggle('shiny',shiny);
    b.classList.toggle('shine-offer',shiny&&!!S.owned[id]&&!S.shinyOwned[id]);
    b.setAttribute('aria-label',`Estampa repetida ${shiny?'shiny ':''}número ${id}, cantidad ${count}`);
    b.innerHTML=`<img loading="lazy" alt="" src="${shiny?SHINY_ART(id):ART(id)}"><span class="loose-no">#${String(id).padStart(3,'0')}</span><span class="nm">…</span><span class="type-label"></span>${shiny?'<span class="shine-mark">SHINY</span>':''}<span class="repeat-tag">REPETIDA</span><em>×${count}</em>`;
    info(id).then(p=>{const name=b.querySelector('.nm'),img=b.querySelector('img'),type=b.querySelector('.type-label');if(name)name.textContent=p.name;if(img)img.src=imageFor(p,shiny);if(type)type.textContent=TYPE_LABELS[p.types[0]]||p.types[0];applyTypeTheme(b,p.types[0]);b.setAttribute('aria-label',`Estampa repetida ${shiny?'shiny ':''}${p.name}, tipo ${TYPE_LABELS[p.types[0]]||p.types[0]}, ${count} en reserva`)}).catch(()=>{});
    b.onclick=()=>showDetail(id,shiny);
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
  save(); renderAlbum(); say(replaceNormal?`Estampa shiny #${String(id).padStart(3,'0')} pegada; la normal volvió a repetidas.`:`Estampa ${shiny?'shiny ':''}#${String(id).padStart(3,'0')} pegada en el espacio ${id}.`);
  document.querySelector(`[data-slot="${id}"]`)?.focus();
}
$('#prevPage').onclick=()=>{if(currentPage>0){currentPage--;renderPage()}};
$('#nextPage').onclick=()=>{if(currentPage<PAGE_COUNT-1){currentPage++;renderPage()}};
async function showDetail(id,shiny=false){
  try{const p=await info(id);
    const inventory=shiny?S.shinyStickers:S.stickers, isPlaced=!!S.owned[id]&&!!S.shinyOwned[id]===shiny;
    const replaceNormal=shiny&&!!S.owned[id]&&!S.shinyOwned[id]&&!!inventory[id];
    const status=isPlaced?'Pegada':replaceNormal?'Shiny repetida · puedes cambiarla':'En reserva';
    $('#detailBody').innerHTML=`<div class="detail-art type-bg${shiny?' shiny':''}"><img alt="${shiny?'Shiny ':''}${p.name}" src="${imageFor(p,shiny)}">${shiny?'<span class="shine-mark">SHINY</span>':''}</div><h3>#${id} ${p.name}${shiny?' · Shiny':''}</h3><p>${RL[rarity(p)]} · ${p.types.join(', ')} · ${status} · ×${inventory[id]||(isPlaced?1:0)||1}</p>`+
      p.stats.map(([n,v])=>`<div class="st"><span>${n}</span><span><i style="width:${Math.min(v,160)/1.6}%"></i></span><span>${v}</span></div>`).join('');
    applyTypeTheme($('#detailBody .detail-art'),p.types[0]);
    $('#detailBody .detail-art').classList.toggle('shiny',shiny);
    $('#placeSticker').dataset.id=id; $('#placeSticker').dataset.shiny=String(shiny); $('#placeSticker').textContent=replaceNormal?'Cambiar por shiny':'Pegar en el álbum';
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
  document.querySelectorAll('nav button').forEach(x=>x.toggleAttribute('aria-current',x===b)); 
  document.querySelectorAll('nav button').forEach(x=>x===b?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  $('#packs').hidden=b.dataset.tab!=='packs'; $('#album').hidden=b.dataset.tab!=='album'; if(b.dataset.tab==='album')renderAlbum()});
tick(); setInterval(tick,1000); renderAlbum();
