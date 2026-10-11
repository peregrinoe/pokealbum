import { supabase } from './supabase.js';

'use strict';
const API='https://pokeapi.co/api/v2/pokemon/', TOTAL=151, LEG=[144,145,146,150,151];
const PROFILES={normal:{baseShinyChance:.03,unlimited:false},test:{baseShinyChance:.5,unlimited:true}};
const PACK_COST=100, DAILY_BASE=25, DAILY_STEP=15, DAILY_MAX=130;
const SHINY_UPGRADE_REWARD=25, REPEAT_SALE_VALUE={normal:10,shiny:25};
const CLOUD_MISSION_LABELS={open_pack_1:'Abre 1 sobre',open_pack_3:'Abre 3 sobres',place_3:'Pega 3 estampas',place_6:'Pega 6 estampas',shiny_1:'Consigue una estampa shiny',sell_1:'Vende 1 repetida',sell_3:'Vende 3 repetidas',shiny_upgrade_1:'Mejora una estampa normal a shiny',type_correct_3:'Acierta 3 tipos en el minijuego',guess_correct_3:'Adivina 3 Pokémon',game_complete_1:'Completa un minijuego'};
const CLOUD_GAME_LABELS={types:'Tipo relámpago',silhouette:'Silueta misteriosa'};
const CLOUD_GAME_DESCRIPTIONS={types:'Identifica el tipo principal de 5 Pokémon.',silhouette:'Reconoce 5 Pokémon por su silueta.'};
const CLOUD_MILESTONE_LABELS={p10:'Pega 10 estampas',page1:'Completa una página de 9 espacios',p25:'Pega 25 estampas',shiny1:'Consigue una estampa shiny',p50:'Pega 50 estampas',p100:'Pega 100 estampas',full:'Completa el álbum de Kanto'};
const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const SHINY_ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
const imageFor=(p,shiny=false)=>shiny?(p.shinyArt||SHINY_ART(p.id)):(p.art||ART(p.id));
const $=s=>document.querySelector(s), rnd=n=>Math.floor(Math.random()*n);
const authForm=$('#authForm'), authMessage=$('#authMessage');
let playerStateCheck=0, cloudPlayerState=null, isSuperAdmin=false, cloudMode=false, demoMode=false;
let currentUserId=null,currentUsername='';
let usernameChangeCost=null;
let socialDashboardLoading=false;
function updateOpenPackLabel(){
  const button=$('#openPackRpcButton'); if(!button)return;
  button.disabled=!cloudPlayerState;
  button.textContent=cloudPlayerState?.starter_packs>0
    ?`Abrir sobre gratis · ${cloudPlayerState.starter_packs} restantes`
    :'Abrir sobre · 100 monedas';
}
function updateDailyBonusButton(){
  const button=$('#claimDailyRpcButton');if(!button)return;
  const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const claimed=cloudPlayerState?.last_daily===today;
  const streak=cloudPlayerState?.last_daily===yesterday?(cloudPlayerState.daily_streak||0)+1:1;
  const reward=Math.min(130,25+(streak-1)*15);
  button.disabled=!cloudPlayerState||claimed;
  button.textContent=claimed?'Bono diario reclamado':`Reclamar bono · +${reward} monedas`;
}
function updateTestControls(){
  const profileSwitch=$('.profile-switch');
  if(profileSwitch)profileSwitch.hidden=cloudMode||demoMode||!isSuperAdmin;
  $('#adminTestPanel').hidden=!isSuperAdmin;
  $('#toggleDemoModeButton').textContent=demoMode?'Volver al modo en línea':'Entrar en modo demo';
  $('#adminModeBadge').textContent=demoMode?'Demo activa':'En línea';
  $('#adminModeStatus').textContent=demoMode?'La demo usa progreso local separado; Supabase sigue intacto.':'La demo usa progreso local separado y no modifica Supabase.';
}
function setCloudReadOnlyView(enabled){
  cloudMode=enabled;
  const appVisible=enabled||demoMode;
  $('#authGate').classList.toggle('signed-in',appVisible);
  $('#authGate').hidden=appVisible;
  $('#gameApp').hidden=!appVisible;
  ['#claimDailyRpcButton','#openPackRpcButton','#packRpcResults','#cloudAlbumResults'].forEach(selector=>{
    $(selector).hidden=enabled;
  });
  ['#cloudMissionResults','#cloudGamesResults','#cloudMilestoneResults'].forEach(selector=>{
    $(selector).hidden=!enabled;
  });
  if(!enabled)$('#cloudGamePlay').hidden=true;
  $('#packBtn').disabled=enabled&&(!cloudPlayerState||(cloudPlayerState.starter_packs<1&&cloudPlayerState.coins<PACK_COST));
  $('#clearCollection').hidden=enabled;
  $('[data-tab="quests"]').hidden=!enabled;
  $('[data-tab="friends"]').hidden=!enabled;
  if(!enabled)$('#friends').hidden=true;
  $('#quests .quests-inner').hidden=enabled;
  if(enabled){
    $('#quests').hidden=true;
    $('#timer').textContent='Vista remota de solo lectura; abre sobres y gestiona el inventario desde las acciones seguras de arriba.';
  }
  updateTestControls();
}
async function loadCloudMissions(){
  const {data,error}=await supabase.rpc('get_daily_missions');
  if(error)return {error};
  const results=$('#cloudMissionResults'),pageHeading=document.createElement('header'),pageKicker=document.createElement('p'),pageTitle=document.createElement('h1'),dailyCard=document.createElement('section'),dailyHeading=document.createElement('h2'),dailyText=document.createElement('p'),dailyButton=document.createElement('button');
  pageHeading.className='cloud-quests-heading';pageKicker.textContent='ENCARGOS · REGIÓN KANTO';pageTitle.textContent='Retos de entrenador';pageHeading.append(pageKicker,pageTitle);
  const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const dailyClaimed=cloudPlayerState?.last_daily===today;
  const streak=cloudPlayerState?.last_daily===yesterday?(cloudPlayerState.daily_streak||0)+1:1;
  const dailyRewardAmount=Math.min(130,25+(streak-1)*15);
  dailyCard.className='cloud-daily-card';dailyHeading.textContent='Bono diario';
  dailyText.textContent=dailyClaimed?`Reclamado · racha ${cloudPlayerState.daily_streak} día${cloudPlayerState.daily_streak===1?'':'s'}`:`Reclama ${dailyRewardAmount} monedas · racha ${streak} día${streak===1?'':'s'}`;
  dailyButton.type='button';dailyButton.className='cloud-daily-button';dailyButton.disabled=dailyClaimed;
  dailyButton.textContent=dailyClaimed?'Reclamado':`Reclamar · +${dailyRewardAmount} ◉`;
  dailyButton.onclick=()=>claimCloudDailyBonus(dailyButton);
  dailyCard.append(dailyHeading,dailyText,dailyButton);
  const heading=document.createElement('h2'),list=document.createElement('ul');
  heading.textContent='Misiones de hoy';list.className='cloud-mission-list';
  data.forEach(mission=>{
    const progress=Math.min(mission.progress,mission.goal),claimed=!!mission.claimed_at,complete=progress>=mission.goal;
    const item=document.createElement('li'),details=document.createElement('div'),title=document.createElement('b'),status=document.createElement('span'),track=document.createElement('span'),fill=document.createElement('i'),reward=document.createElement('b'),button=document.createElement('button');
    item.className='cloud-mission';if(complete)item.classList.add('complete');if(claimed)item.classList.add('claimed');
    title.textContent=CLOUD_MISSION_LABELS[mission.mission_key]||'Misión diaria';
    status.textContent=claimed?'Reclamada':`${progress} / ${mission.goal}`;
    track.className='cloud-mission-track';fill.style.width=`${progress/mission.goal*100}%`;track.append(fill);
    reward.className='cloud-mission-reward';reward.textContent=`${mission.reward} ◉`;
    button.type='button';button.className='cloud-mission-claim';button.disabled=claimed||!complete;
    button.textContent=claimed?'Reclamada':complete?'Reclamar':'En curso';
    button.onclick=()=>claimCloudMission(mission.mission_key,button);
    details.className='cloud-mission-details';details.append(title,status,track);
    item.append(details,reward,button);list.append(item);
  });
  results.replaceChildren(pageHeading,dailyCard,heading,list);
  const ready=Number(!dailyClaimed)+data.filter(mission=>!mission.claimed_at&&mission.progress>=mission.goal).length;
  const badge=$('[data-tab="quests"] b');if(badge)badge.textContent=String(ready);
  return {error:null};
}
async function claimCloudDailyBonus(button){
  button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Reclamando el bono diario en Supabase…';
  const {data,error}=await supabase.rpc('claim_daily_bonus');
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo reclamar el bono: ${error.message}`;button.disabled=false;return}
  const result=Array.isArray(data)?data[0]:data;
  if(!result){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado del bono.';button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:result.coins,daily_streak:result.daily_streak,last_daily:result.last_daily};
  S.coins=result.coins;tick();updateOpenPackLabel();updateDailyBonusButton();await loadCloudMissions();
  authMessage.textContent=`Bono reclamado: +${result.reward} monedas. Saldo en Supabase: ${result.coins}.`;
}
async function claimCloudMission(missionKey,button){
  button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Reclamando misión en Supabase…';
  const {data,error}=await supabase.rpc('claim_daily_mission',{p_mission_key:missionKey});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo reclamar la misión: ${error.message}`;button.disabled=false;return}
  const reward=Array.isArray(data)?data[0]:data;
  if(!reward){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado de la misión.';button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:reward.coins_balance};
  S.coins=reward.coins_balance;tick();
  const refresh=await loadCloudMissions();
  updateOpenPackLabel();
  authMessage.textContent=refresh.error?`Misión reclamada: +${reward.reward} monedas. Saldo: ${reward.coins_balance}.`:`Misión reclamada: +${reward.reward} monedas. Saldo en Supabase: ${reward.coins_balance}.`;
}
async function loadCloudGames(){
  const {data,error}=await supabase.rpc('get_daily_games');
  const results=$('#cloudGamesResults');
  if(error){const heading=document.createElement('h2'),message=document.createElement('p');heading.textContent='Minijuegos diarios';message.textContent='Activa la migración cloud de minijuegos para jugar aquí.';results.replaceChildren(heading,message);return {error}}
  const sessions=new Map(data.map(game=>[game.game_key,game]));
  const heading=document.createElement('h2'),list=document.createElement('ul');
  heading.textContent='Minijuegos diarios';list.className='cloud-game-list';
  Object.entries(CLOUD_GAME_LABELS).forEach(([key,label])=>{
    const session=sessions.get(key),completed=!!session?.claimed_at,item=document.createElement('li'),details=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p'),button=document.createElement('button');
    item.className='cloud-game';title.textContent=label;
    description.textContent=session?`${session.answered_count} / 5 rondas · ${session.correct_count} aciertos`:CLOUD_GAME_DESCRIPTIONS[key];
    button.type='button';button.disabled=completed;button.textContent=completed?'Jugado hoy':session?.answered_count?'Continuar':'Jugar';
    button.onclick=()=>startCloudGame(key);
    details.append(title,description);item.append(details,button);list.append(item);
  });
  results.replaceChildren(heading,list);
  return {error:null};
}
async function startCloudGame(gameKey){
  authMessage.dataset.error='';authMessage.textContent='Preparando minijuego…';
  const {data,error}=await supabase.rpc('start_daily_game',{p_game_key:gameKey});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo iniciar el minijuego: ${error.message}`;return}
  const question=Array.isArray(data)?data[0]:data;
  if(!question){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió una pregunta.';return}
  if(question.game_complete){await loadCloudGames();$('#cloudGamePlay').hidden=true;authMessage.textContent='Ese minijuego ya fue completado hoy.';return}
  renderCloudGameQuestion(gameKey,question);
  await loadCloudGames();
}
function renderCloudGameQuestion(gameKey,question){
  const area=$('#cloudGamePlay');area.replaceChildren();area.hidden=false;
  const progress=document.createElement('p'),title=document.createElement('h3');
  progress.textContent=`Ronda ${question.round_number} de 5 · Aciertos: ${question.correct_count}`;
  title.textContent=gameKey==='types'?'¿Cuál es el tipo principal?':'¿Qué Pokémon se esconde en la silueta?';
  area.append(progress,title);
  if(gameKey==='silhouette'){
    const image=document.createElement('img');image.className='cloud-game-silhouette';image.src=ART(question.pokemon_id);image.alt='Silueta de un Pokémon';area.append(image);
  }else{
    const name=document.createElement('p');name.textContent=`Pokémon #${String(question.pokemon_id).padStart(3,'0')}`;area.append(name);
    info(question.pokemon_id).then(p=>{name.textContent=`${p.name} · #${String(p.id).padStart(3,'0')}`}).catch(()=>{});
  }
  const options=document.createElement('div');options.className='cloud-game-options';
  question.choices.forEach(choice=>{
    const button=document.createElement('button');button.type='button';button.className='cloud-game-option';
    button.textContent=gameKey==='types'?(TYPE_LABELS[choice]||choice):`#${String(choice).padStart(3,'0')}`;
    button.onclick=()=>answerCloudGame(gameKey,question,choice,options);
    if(gameKey==='silhouette')info(Number(choice)).then(p=>{button.textContent=p.name}).catch(()=>{});
    options.append(button);
  });
  area.append(options);
}
async function answerCloudGame(gameKey,question,choice,options){
  options.querySelectorAll('button').forEach(button=>button.disabled=true);
  authMessage.dataset.error='';authMessage.textContent='Validando respuesta en Supabase…';
  const {data,error}=await supabase.rpc('answer_daily_game',{p_game_key:gameKey,p_choice:String(choice)});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo validar la respuesta: ${error.message}`;options.querySelectorAll('button').forEach(button=>button.disabled=false);return}
  const result=Array.isArray(data)?data[0]:data;
  if(!result){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado de la ronda.';options.querySelectorAll('button').forEach(button=>button.disabled=false);return}
  options.querySelectorAll('button').forEach(button=>{
    if(button.dataset.choice===String(result.correct_choice))button.classList.add('correct');
    else if(button.dataset.choice===String(choice))button.classList.add('incorrect');
  });
  const correctLabel=gameKey==='types'?(TYPE_LABELS[result.correct_choice]||result.correct_choice):result.correct_choice;
  const feedback=document.createElement('p');feedback.textContent=result.is_correct?'¡Correcto!':`Respuesta correcta: ${correctLabel}`;$('#cloudGamePlay').append(feedback);
  if(result.game_complete){
    cloudPlayerState={...cloudPlayerState,coins:result.coins_balance};S.coins=result.coins_balance;tick();updateOpenPackLabel();
    await loadCloudMissions();await loadCloudGames();
    feedback.textContent=`Minijuego completado · ${result.correct_count}/5 aciertos · +${result.reward} monedas.`;
    authMessage.textContent=`Recompensa validada en Supabase. Saldo: ${result.coins_balance} monedas.`;return;
  }
  const next=document.createElement('button');next.type='button';next.className='cloud-game-option';next.textContent='Siguiente ronda';
  next.onclick=()=>startCloudGame(gameKey);$('#cloudGamePlay').append(next);
  await loadCloudMissions();authMessage.textContent=`Respuesta ${result.is_correct?'correcta':'registrada'} · ${result.correct_count}/5 aciertos.`;
}
async function loadCloudMilestones(){
  const {data,error}=await supabase.rpc('get_collection_milestones');
  const results=$('#cloudMilestoneResults');
  if(error){const heading=document.createElement('h2'),message=document.createElement('p');heading.textContent='Hitos de colección';message.textContent='Activa la migración cloud de hitos para consultar y reclamar recompensas.';results.replaceChildren(heading,message);return {error}}
  const heading=document.createElement('h2'),list=document.createElement('ul');
  heading.textContent='Hitos de colección';list.className='cloud-milestone-list';
  data.forEach(milestone=>{
    const claimed=!!milestone.claimed_at,complete=milestone.progress>=milestone.goal,item=document.createElement('li'),label=document.createElement('strong'),reward=document.createElement('span'),button=document.createElement('button');
    item.className='cloud-milestone';if(complete)item.classList.add('done');if(claimed)item.classList.add('claimed');
    label.textContent=`${CLOUD_MILESTONE_LABELS[milestone.milestone_key]||milestone.label} · ${milestone.progress}/${milestone.goal}`;
    reward.textContent=`${milestone.reward} ◉`;button.type='button';button.disabled=claimed||!complete;
    button.textContent=claimed?'Reclamado':complete?'Reclamar':'En curso';button.onclick=()=>claimCloudMilestone(milestone.milestone_key,button);
    item.append(label,reward,button);list.append(item);
  });
  results.replaceChildren(heading,list);return {error:null};
}
async function claimCloudMilestone(milestoneKey,button){
  button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Validando hito en Supabase…';
  const {data,error}=await supabase.rpc('claim_collection_milestone',{p_milestone_key:milestoneKey});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo reclamar el hito: ${error.message}`;button.disabled=false;return}
  const result=Array.isArray(data)?data[0]:data;
  if(!result){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado del hito.';button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:result.coins_balance};S.coins=result.coins_balance;tick();updateOpenPackLabel();
  await loadCloudMilestones();authMessage.textContent=`Hito reclamado: +${result.reward} monedas. Saldo: ${result.coins_balance}.`;
}
async function loadCloudInventory(){
  const [{data:gameInventory,error:inventoryError},{data:slots,error:slotsError},{data:legacyInventory,error:legacyError}]=await Promise.all([
    supabase.from('sticker_inventory').select('pokemon_id,is_shiny,quantity').order('pokemon_id').order('is_shiny'),
    supabase.from('album_slots').select('pokemon_id,is_shiny,source'),
    supabase.from('legacy_sticker_inventory').select('pokemon_id,is_shiny,quantity').order('pokemon_id').order('is_shiny')
  ]);
  if(inventoryError||slotsError||legacyError)return {error:inventoryError||slotsError||legacyError};
  const inventoryByVariant=new Map();
  gameInventory.forEach(card=>inventoryByVariant.set(`${card.pokemon_id}:${card.is_shiny}`,{
    ...card,source:'game',gameQuantity:card.quantity,legacyQuantity:0
  }));
  legacyInventory.forEach(card=>{
    const key=`${card.pokemon_id}:${card.is_shiny}`,existing=inventoryByVariant.get(key);
    if(existing){existing.quantity+=card.quantity;existing.legacyQuantity=card.quantity}
    else inventoryByVariant.set(key,{...card,source:'legacy',gameQuantity:0,legacyQuantity:card.quantity});
  });
  const inventory=[...inventoryByVariant.values()];
  S.profile='normal';
  S.coins=cloudPlayerState?.coins??S.coins;
  S.starterPacks=cloudPlayerState?.starter_packs??S.starterPacks;
  S.owned={};S.stickers={};S.shinyOwned={};S.shinyStickers={};
  inventory.forEach(card=>{
    const target=card.is_shiny?S.shinyStickers:S.stickers;
    target[card.pokemon_id]=card.quantity;
  });
  slots.forEach(slot=>{
    S.owned[slot.pokemon_id]=1;
    if(slot.is_shiny)S.shinyOwned[slot.pokemon_id]=1;
  });
  tick();updateProgress();
  if(cloudMode)renderAlbum();
  const results=$('#packRpcResults'),heading=document.createElement('h2'),list=document.createElement('ul');
  heading.textContent='Inventario guardado en Supabase';list.className='rpc-pack-list';
  const slotsById=new Map(slots.map(slot=>[slot.pokemon_id,slot]));
  const gameQuantitiesById=new Map();
  gameInventory.forEach(card=>gameQuantitiesById.set(card.pokemon_id,(gameQuantitiesById.get(card.pokemon_id)||0)+card.quantity));
  inventory.forEach(card=>{
    const item=document.createElement('li'),image=document.createElement('img'),name=document.createElement('span'),quantity=document.createElement('small'),placeButton=document.createElement('button'),sellButton=document.createElement('button');
    item.dataset.pokemonId=String(card.pokemon_id);item.dataset.shiny=String(card.is_shiny);
    image.src=card.is_shiny?SHINY_ART(card.pokemon_id):ART(card.pokemon_id);image.alt='';image.loading='lazy';
    name.textContent=`#${String(card.pokemon_id).padStart(3,'0')}${card.is_shiny?' · SHINY':''}`;
    quantity.textContent=`×${card.quantity}${card.legacyQuantity?` (${card.gameQuantity} cloud + ${card.legacyQuantity} local)`:card.source==='legacy'?' · local importada':''}`;
    const slot=slotsById.get(card.pokemon_id),canPlace=!slot||(!slot.is_shiny&&card.is_shiny);
    placeButton.type='button';placeButton.className='rpc-place-sticker';
    placeButton.textContent=slot?.is_shiny?'Pegada':canPlace?(slot?'Mejorar · +25 ◉':'Pegar'):'Espacio ocupado';
    placeButton.disabled=!canPlace;
    placeButton.setAttribute('aria-label',`${canPlace?'Pegar':'Espacio ocupado'} estampa ${card.is_shiny?'shiny ':''}#${card.pokemon_id}`);
    if(canPlace)placeButton.onclick=()=>placeCloudSticker(card.pokemon_id,card.is_shiny,placeButton);
    const canSell=card.source==='game'&&(!!slot||(gameQuantitiesById.get(card.pokemon_id)||0)>1);
    sellButton.type='button';sellButton.className='rpc-sell-sticker';
    sellButton.textContent=card.source==='legacy'?'Importada · no vendible':`Vender · ${card.is_shiny?25:10} ◉`;sellButton.disabled=!canSell;
    sellButton.setAttribute('aria-label',`${canSell?'Vender':card.source==='legacy'?'Importada no vendible':'No repetida'} estampa ${card.is_shiny?'shiny ':''}#${card.pokemon_id} por ${card.is_shiny?25:10} monedas`);
    if(canSell)sellButton.onclick=()=>sellCloudSticker(card.pokemon_id,card.is_shiny,sellButton);
    item.append(image,name,quantity,placeButton,sellButton);list.append(item);
    info(card.pokemon_id).then(p=>{name.textContent=`#${String(card.pokemon_id).padStart(3,'0')} ${p.name}${card.is_shiny?' · SHINY':''}`}).catch(()=>{});
  });
  if(!inventory.length){const empty=document.createElement('p');empty.textContent='Tu inventario remoto aún no tiene estampas.';results.replaceChildren(heading,empty)}
  else results.replaceChildren(heading,list);
  const albumResults=$('#cloudAlbumResults'),albumHeading=document.createElement('h2'),albumList=document.createElement('ul');
  albumHeading.textContent=`Álbum en Supabase · ${slots.length} / 151`;albumList.className='rpc-pack-list';
  slots.forEach(slot=>{
    const item=document.createElement('li'),image=document.createElement('img'),name=document.createElement('span'),removeButton=document.createElement('button');
    image.src=slot.is_shiny?SHINY_ART(slot.pokemon_id):ART(slot.pokemon_id);image.alt='';image.loading='lazy';
    name.textContent=`#${String(slot.pokemon_id).padStart(3,'0')}${slot.is_shiny?' · SHINY':''}`;
    removeButton.type='button';removeButton.className='rpc-remove-sticker';removeButton.textContent='Quitar';
    removeButton.setAttribute('aria-label',`Quitar estampa ${slot.is_shiny?'shiny ':''}#${slot.pokemon_id}`);
    removeButton.onclick=()=>removeCloudSticker(slot.pokemon_id,removeButton);
    item.append(image,name,removeButton);albumList.append(item);
    info(slot.pokemon_id).then(p=>{name.textContent=`#${String(slot.pokemon_id).padStart(3,'0')} ${p.name}${slot.is_shiny?' · SHINY':''}`}).catch(()=>{});
  });
  if(!slots.length){const empty=document.createElement('p');empty.textContent='Aún no has pegado estampas.';albumResults.replaceChildren(albumHeading,empty)}
  else albumResults.replaceChildren(albumHeading,albumList);
  return {error:null};
}
async function placeCloudSticker(pokemonId,isShiny,button=null){
  if(button)button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Pegando estampa de forma segura…';
  const {data,error}=await supabase.rpc('place_sticker',{p_pokemon_id:pokemonId,p_is_shiny:isShiny});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo pegar la estampa: ${error.message}`;if(button)button.disabled=false;return}
  const placement=Array.isArray(data)?data[0]:data;
  if(!placement){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado del pegado.';if(button)button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:placement.coins_balance};
  await loadCloudInventory();
  await Promise.all([loadCloudMissions(),loadCloudMilestones()]);
  authMessage.textContent=`Estampa ${isShiny?'shiny ':''}#${String(pokemonId).padStart(3,'0')} pegada.${placement.shiny_upgrade_reward?` Mejora shiny: +${placement.shiny_upgrade_reward} monedas.`:''} Saldo en Supabase: ${placement.coins_balance}.`;
}
async function placeAllCloudStickers(){
  const button=$('#placeAll');button.disabled=true;authMessage.dataset.error='';
  authMessage.textContent='Pegando todas las estampas disponibles de forma segura…';
  const {data,error}=await supabase.rpc('place_all_stickers');
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudieron pegar todas las estampas: ${error.message}`;button.disabled=false;return}
  const result=Array.isArray(data)?data[0]:data;
  if(!result){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado del pegado masivo.';button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:result.coins_balance};S.coins=result.coins_balance;
  const inventoryStatus=await loadCloudInventory();
  if(inventoryStatus.error){authMessage.dataset.error='true';authMessage.textContent=`Se pegaron ${result.placed_count} estampas, pero no se pudo actualizar la vista.`;return}
  await Promise.all([loadCloudMissions(),loadCloudMilestones()]);
  authMessage.textContent=result.placed_count
    ?`Pegaste ${result.placed_count} estampas en el álbum. Saldo en Supabase: ${result.coins_balance} monedas.`
    :'No había estampas disponibles para pegar.';
}
async function sellCloudSticker(pokemonId,isShiny,button=null){
  if(button)button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Vendiendo estampa repetida de forma segura…';
  const {data,error}=await supabase.rpc('sell_repeated',{p_pokemon_id:pokemonId,p_is_shiny:isShiny});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo vender la estampa: ${error.message}`;if(button)button.disabled=false;return}
  const sale=Array.isArray(data)?data[0]:data;
  if(!sale){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado de la venta.';if(button)button.disabled=false;return}
  cloudPlayerState={...cloudPlayerState,coins:sale.coins_balance};
  const inventoryStatus=await loadCloudInventory();
  if(inventoryStatus.error){authMessage.dataset.error='true';authMessage.textContent=`Venta realizada, pero no se pudo actualizar el inventario: ${inventoryStatus.error.message}`;return}
  await Promise.all([loadCloudMissions(),loadCloudMilestones()]);
  authMessage.textContent=`Vendiste una estampa repetida por ${sale.sale_value} monedas. Saldo en Supabase: ${sale.coins_balance}.`;
}
async function removeCloudSticker(pokemonId,button=null){
  if(button)button.disabled=true;authMessage.dataset.error='';authMessage.textContent='Devolviendo estampa al inventario…';
  const {data,error}=await supabase.rpc('remove_sticker',{p_pokemon_id:pokemonId});
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo quitar la estampa: ${error.message}`;if(button)button.disabled=false;return}
  const removal=Array.isArray(data)?data[0]:data;
  if(!removal){authMessage.dataset.error='true';authMessage.textContent='Supabase no devolvió el resultado de la devolución.';if(button)button.disabled=false;return}
  const inventoryStatus=await loadCloudInventory();
  if(inventoryStatus.error){authMessage.dataset.error='true';authMessage.textContent=`Estampa devuelta, pero no se pudo actualizar la vista: ${inventoryStatus.error.message}`;return}
  await loadCloudMilestones();
  authMessage.textContent=`Estampa #${String(pokemonId).padStart(3,'0')} devuelta al inventario${removal.returned_is_shiny?' como shiny':''}.`;
}
function socialErrorMessage(error){
  const message=String(error?.message||'');
  if(message.includes('username_taken'))return 'Ese nombre ya está en uso.';
  if(message.includes('invalid_username'))return 'Usa entre 3 y 20 letras, números o guiones bajos.';
  if(message.includes('reserved_username'))return 'Ese nombre está reservado.';
  if(message.includes('username_not_found'))return 'No encontramos ese nombre de usuario.';
  if(message.includes('cannot_add_self'))return 'No puedes enviarte una solicitud a ti mismo.';
  if(message.includes('already_friends'))return 'Ya están en la lista de amigos.';
  if(message.includes('friend_request_already_pending'))return 'Ya hay una solicitud pendiente.';
  if(message.includes('friend_request_rate_limited'))return 'Has enviado muchas solicitudes. Inténtalo más tarde.';
  if(message.includes('trade_offer_rate_limited'))return 'Tienes demasiadas ofertas pendientes. Espera a que respondan antes de enviar más.';
  if(message.includes('trade_already_pending'))return 'Ya tienes una oferta pendiente para este amigo.';
  if(message.includes('offered_sticker_unavailable'))return 'Ya no tienes disponible la carta que ofreces.';
  if(message.includes('requested_sticker_unavailable'))return 'Tu amigo ya no tiene disponible la carta solicitada.';
  if(message.includes('not_friends'))return 'Ambos entrenadores deben ser amigos para intercambiar.';
  if(message.includes('trade_not_pending'))return 'Esta oferta ya no está pendiente.';
  if(message.includes('PGRST202')||message.includes('does not exist')||message.includes('Could not find'))return 'La función social aún no está instalada. Aplica la migración de amigos e intercambios.';
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
}
function setSocialAvailability(enabled){
  $('#friendUsernameInput').disabled=!enabled;
  $('#friendRequestForm button[type="submit"]').disabled=!enabled;
  $('#tradeFriendSelect').disabled=!enabled;
  if(!enabled)resetTradeChoices();
}
function updateUsernameButton(){
  const input=$('#usernameInput'),button=$('#saveUsernameButton');
  const username=input.value.trim().toLowerCase(),valid=/^[a-z0-9_]{3,20}$/.test(username);
  const unchanged=!!currentUsername&&username===currentUsername;
  const price=Number(usernameChangeCost);
  const priceReady=Number.isInteger(price)&&price>0;
  button.disabled=!valid||unchanged||!!currentUsername&&!priceReady;
  button.textContent=!currentUsername?'Guardar gratis':unchanged?'Nombre actual':priceReady?`Cambiar · ${price} ◉`:'Cambio no disponible';
}
async function loadSocialProfile(){
  const status=$('#usernameStatus'),input=$('#usernameInput');
  status.textContent='Cargando perfil…';status.dataset.error='';
  const {data,error}=await supabase.rpc('get_trainer_profile');
  if(error){
    currentUsername='';input.value='';status.dataset.error='true';
    status.textContent=socialErrorMessage(error);
    setSocialAvailability(false);
    $('#socialSetupNotice').hidden=false;
    $('#socialSetupNotice').textContent='El sistema de amigos aún no está disponible. Aplica la migración de amigos e intercambios.';
    $('#friendRequestStatus').textContent='';$('#friendRequestStatus').dataset.error='';
    return {error};
  }
  currentUsername=typeof data==='string'?data:'';
  $('#authIdentity').textContent=currentUsername?`@${currentUsername}`:'';
  input.value=currentUsername;status.dataset.error='';
  usernameChangeCost=null;
  const {data:changeCost,error:changeCostError}=await supabase.rpc('get_trainer_username_change_cost');
  if(!changeCostError&&Number.isInteger(Number(changeCost))&&Number(changeCost)>0)usernameChangeCost=Number(changeCost);
  updateUsernameButton();
  setSocialAvailability(!!currentUsername);
  status.textContent=currentUsername
    ?usernameChangeCost===null?'Cambio de nombre pendiente de activar en el servidor.':`Los cambios cuestan ${usernameChangeCost} monedas.`
    :'Necesitas un nombre de usuario para añadir amigos.';
  $('#socialSetupNotice').hidden=!!currentUsername;
  if(!currentUsername)$('#socialSetupNotice').textContent='Define tu nombre de usuario en Cuenta para empezar a conectar con otros entrenadores.';
  await loadSocialDashboard();
  return {error:null};
}
function socialButton(label,className,handler){
  const button=document.createElement('button');button.type='button';button.className=className;button.textContent=label;button.onclick=handler;return button;
}
async function loadSocialDashboard(refreshTradeChoices=true){
  if(!cloudMode||!currentUserId||socialDashboardLoading)return;
  if(!currentUsername){setSocialAvailability(false);return}
  socialDashboardLoading=true;
  const dashboardStatus=$('#socialDashboardStatus');
  let friendsResult,requestsResult,tradesResult;
  try{
    [friendsResult,requestsResult,tradesResult]=await Promise.all([
      supabase.rpc('list_friends'),supabase.rpc('list_friend_requests'),supabase.rpc('list_trade_offers')
    ]);
  }catch(error){
    socialDashboardLoading=false;dashboardStatus.dataset.error='true';dashboardStatus.textContent=socialErrorMessage(error);return {error};
  }
  const failures=[friendsResult.error,requestsResult.error,tradesResult.error].filter(Boolean);
  dashboardStatus.dataset.error=failures.length?'true':'';
  dashboardStatus.textContent=failures.length?socialErrorMessage(failures[0]):'';
  const friends=friendsResult.data||[],requests=requestsResult.data||[],trades=(tradesResult.data||[]).filter(trade=>trade.trade_status==='pending');
  $('#friendN').textContent=String(friends.length);
  $('#incomingFriendEmpty').hidden=requests.length>0;
  $('#friendsEmpty').hidden=friends.length>0;
  $('#tradesEmpty').hidden=trades.length>0;
  const requestList=$('#incomingFriendList');requestList.replaceChildren();
  requests.forEach(request=>{
    const item=document.createElement('li'),name=document.createElement('span'),actions=document.createElement('div');
    item.className='social-row';name.className='social-name';name.textContent=`@${request.username}`;actions.className='social-actions';
    actions.append(
      socialButton('Aceptar','social-action primary',()=>respondToFriendRequest(request.friend_id,true)),
      socialButton('Rechazar','social-action',()=>respondToFriendRequest(request.friend_id,false))
    );item.append(name,actions);requestList.append(item);
  });
  const friendList=$('#friendList');friendList.replaceChildren();
  const friendSelect=$('#tradeFriendSelect'),previousFriend=friendSelect.value;
  friendSelect.replaceChildren(new Option('Selecciona un amigo',''));
  friends.forEach(friend=>{
    const item=document.createElement('li'),name=document.createElement('span'),actions=document.createElement('div'),option=new Option(`@${friend.username}`,friend.friend_id);
    item.className='social-row';name.className='social-name';name.textContent=`@${friend.username}`;actions.className='social-actions';
    actions.append(
      socialButton('Intercambiar','social-action primary',()=>{friendSelect.value=friend.friend_id;loadTradeChoices(friend.friend_id);$('#tradeOfferTitle').scrollIntoView({behavior:'smooth',block:'start'})}),
      socialButton('Quitar amigo','social-action danger',()=>removeFriend(friend.friend_id,friend.username))
    );item.append(name,actions);friendList.append(item);friendSelect.append(option);
  });
  friendSelect.disabled=!currentUsername||!friends.length;
  if(friends.some(friend=>friend.friend_id===previousFriend))friendSelect.value=previousFriend;
  if(friendSelect.value){if(refreshTradeChoices)await loadTradeChoices(friendSelect.value)}
  else resetTradeChoices();

  const tradeList=$('#tradeList');tradeList.replaceChildren();
  trades.forEach(trade=>{
    const item=document.createElement('li'),summary=document.createElement('div'),description=document.createElement('p'),status=document.createElement('span'),actions=document.createElement('div');
    item.className='social-row trade-row';summary.className='trade-summary';description.textContent=`@${trade.other_username}`;
    status.className=`trade-status ${trade.trade_status}`;
    status.textContent={pending:'Pendiente',completed:'Completado',declined:'Rechazado',cancelled:'Cancelado'}[trade.trade_status]||trade.trade_status;
    const cards=document.createElement('div');cards.className='trade-stickers';
    cards.append(createTradeSticker('Ofrecida',trade.offered_pokemon_id,trade.offered_is_shiny,trade.offered_source));
    cards.append(createTradeSticker('Solicitada',trade.requested_pokemon_id,trade.requested_is_shiny,trade.requested_source));
    summary.append(description,cards);actions.className='social-actions';
    if(trade.trade_status==='pending'&&trade.recipient_id===currentUserId){
      actions.append(socialButton('Aceptar intercambio','social-action primary',()=>acceptTrade(trade.trade_id)),socialButton('Rechazar','social-action',()=>closeTrade(trade.trade_id)));
    }else if(trade.trade_status==='pending'&&trade.sender_id===currentUserId){
      actions.append(socialButton('Cancelar oferta','social-action',()=>closeTrade(trade.trade_id)));
    }
    item.append(summary,status,actions);tradeList.append(item);
  });
  socialDashboardLoading=false;
  return {error:null};
}
function createTradeSticker(label,pokemonId,isShiny,source){
  const card=document.createElement('div'),image=document.createElement('img'),details=document.createElement('span'),name=document.createElement('strong'),origin=document.createElement('small');
  card.className='trade-sticker-card';image.src=isShiny?SHINY_ART(pokemonId):ART(pokemonId);image.alt='';image.loading='lazy';
  details.className='trade-sticker-details';name.textContent=`#${String(pokemonId).padStart(3,'0')}${isShiny?' · shiny':''}`;
  origin.textContent=`${label} · ${source==='legacy'?'importada':'de sobres'}`;
  details.append(origin,name);card.append(image,details);
  info(pokemonId).then(pokemon=>{
    image.src=imageFor(pokemon,isShiny);
    name.textContent=`${pokemon.name}${isShiny?' · shiny':''}`;
  }).catch(()=>{});
  return card;
}
function resetTradeChoices(){
  $('#tradeOfferedCard').replaceChildren(new Option('Elige primero un amigo',''));
  $('#tradeRequestedCard').replaceChildren(new Option('Elige primero un amigo',''));
  $('#tradeOfferedCard').disabled=true;$('#tradeRequestedCard').disabled=true;$('#sendTradeButton').disabled=true;
}
function populateTradeChoices(selector,items,placeholder){
  const select=$(selector);select.replaceChildren(new Option(placeholder,''));
  items.forEach(item=>{
    const option=new Option(`#${String(item.pokemon_id).padStart(3,'0')}${item.is_shiny?' · shiny':''} · ${item.source==='legacy'?'importada':'de sobres'} · ×${item.quantity}`,`${item.pokemon_id}:${item.is_shiny}:${item.source}`);
    select.append(option);
    info(item.pokemon_id).then(p=>{option.textContent=`${p.name}${item.is_shiny?' shiny':''} · ${item.source==='legacy'?'importada':'de sobres'} · ×${item.quantity}`}).catch(()=>{});
  });
  select.disabled=!items.length;
}
async function loadTradeChoices(friendId){
  const [ownResult,friendResult]=await Promise.all([
    supabase.rpc('get_trade_inventory',{p_user_id:currentUserId}),
    supabase.rpc('get_trade_inventory',{p_user_id:friendId})
  ]);
  if(ownResult.error||friendResult.error){
    $('#tradeStatus').dataset.error='true';$('#tradeStatus').textContent=socialErrorMessage(ownResult.error||friendResult.error);resetTradeChoices();return;
  }
  populateTradeChoices('#tradeOfferedCard',ownResult.data||[],'Selecciona tu carta');
  populateTradeChoices('#tradeRequestedCard',friendResult.data||[],'Selecciona la carta que quieres');
  $('#sendTradeButton').disabled=!ownResult.data?.length||!friendResult.data?.length||!currentUsername;
  if(!ownResult.data?.length||!friendResult.data?.length){
    $('#tradeStatus').dataset.error='';
    $('#tradeStatus').textContent=!ownResult.data?.length?'No tienes cartas sueltas para ofrecer.':'Tu amigo no tiene cartas sueltas disponibles.';
  }else $('#tradeStatus').textContent='';
}
async function respondToFriendRequest(friendId,accept){
  const {error}=await supabase.rpc('respond_friend_request',{p_friend_id:friendId,p_accept:accept});
  if(error){$('#friendRequestStatus').dataset.error='true';$('#friendRequestStatus').textContent=socialErrorMessage(error);return}
  $('#friendRequestStatus').dataset.error='';$('#friendRequestStatus').textContent=accept?'Solicitud aceptada.':'Solicitud rechazada.';
  await loadSocialDashboard();
}
async function removeFriend(friendId,username){
  if(!confirm(`¿Quitar a @${username} de tu lista de amigos?`))return;
  const {error}=await supabase.rpc('remove_friend',{p_friend_id:friendId});
  if(error){$('#friendRequestStatus').dataset.error='true';$('#friendRequestStatus').textContent=socialErrorMessage(error);return}
  $('#friendRequestStatus').dataset.error='';$('#friendRequestStatus').textContent=`@${username} ya no está en tu lista.`;
  await loadSocialDashboard();
}
async function submitTradeOffer(event){
  event.preventDefault();
  const [offeredId,offeredShiny,offeredSource]=$('#tradeOfferedCard').value.split(':');
  const [requestedId,requestedShiny,requestedSource]=$('#tradeRequestedCard').value.split(':');
  const friendId=$('#tradeFriendSelect').value,button=$('#sendTradeButton');
  if(!friendId||!offeredId||!requestedId)return;
  if(!confirm('¿Enviar esta oferta de intercambio? La otra persona deberá aceptarla.'))return;
  button.disabled=true;$('#tradeStatus').dataset.error='';$('#tradeStatus').textContent='Enviando oferta…';
  const {error}=await supabase.rpc('create_trade_offer',{
    p_recipient_id:friendId,p_offered_pokemon_id:Number(offeredId),p_offered_is_shiny:offeredShiny==='true',p_offered_source:offeredSource,
    p_requested_pokemon_id:Number(requestedId),p_requested_is_shiny:requestedShiny==='true',p_requested_source:requestedSource
  });
  button.disabled=false;
  if(error){$('#tradeStatus').dataset.error='true';$('#tradeStatus').textContent=socialErrorMessage(error);return}
  $('#tradeStatus').dataset.error='';$('#tradeStatus').textContent='Oferta enviada. La carta se intercambia cuando tu amigo la acepta.';
  $('#tradeOfferForm').reset();await loadSocialDashboard();
}
async function acceptTrade(tradeId){
  const {error}=await supabase.rpc('accept_trade_offer',{p_trade_id:tradeId});
  if(error){$('#tradeStatus').dataset.error='true';$('#tradeStatus').textContent=socialErrorMessage(error);return}
  $('#tradeStatus').dataset.error='';$('#tradeStatus').textContent='Intercambio completado.';
  const inventoryStatus=await loadCloudInventory();
  if(inventoryStatus.error){$('#tradeStatus').dataset.error='true';$('#tradeStatus').textContent='Intercambio completado, pero el inventario no pudo actualizarse. Recarga la vista.';return}
  await loadSocialDashboard();
}
async function closeTrade(tradeId){
  const {error}=await supabase.rpc('close_trade_offer',{p_trade_id:tradeId});
  if(error){$('#tradeStatus').dataset.error='true';$('#tradeStatus').textContent=socialErrorMessage(error);return}
  $('#tradeStatus').dataset.error='';$('#tradeStatus').textContent='Oferta cerrada.';await loadSocialDashboard();
}
function refreshVisibleSocialDashboard(){
  if(document.visibilityState==='visible'&&cloudMode&&!$('#friends').hidden&&!socialDashboardLoading){
    loadSocialDashboard(false);
  }
}
window.setInterval(refreshVisibleSocialDashboard,20000);
window.addEventListener('focus',refreshVisibleSocialDashboard);
document.addEventListener('visibilitychange',refreshVisibleSocialDashboard);
function showAuthState(session){
  if(demoMode&&session)return;
  if(!session){demoMode=false;currentUserId=null;currentUsername=''}
  else currentUserId=session.user.id;
  const signedIn=!!session;
  authForm.hidden=signedIn;
  if(signedIn){
    setCloudReadOnlyView(false);isSuperAdmin=false;updateTestControls();
    const check=++playerStateCheck;
    $('#authIdentity').textContent='';
    $('#accountStatus').textContent='';
    authMessage.textContent='Verificando acceso al estado del jugador…';
    window.setTimeout(async()=>{
      const {data,error}=await supabase.from('player_state').select('coins,starter_packs,daily_streak,last_daily').eq('user_id',session.user.id).maybeSingle();
      if(check!==playerStateCheck)return;
      if(error){authMessage.dataset.error='true';authMessage.textContent=`La sesión funciona, pero falló la lectura protegida: ${error.message}`;return}
      if(!data){authMessage.dataset.error='true';authMessage.textContent='No se encontró el estado inicial. Hay que revisar el trigger de registro.';return}
      cloudPlayerState=data;updateOpenPackLabel();updateDailyBonusButton();
      const {data:adminStatus,error:adminError}=await supabase.rpc('is_super_admin');
      if(check!==playerStateCheck)return;
      isSuperAdmin=!adminError&&adminStatus===true;updateTestControls();
      const inventoryStatus=await loadCloudInventory();
      if(check!==playerStateCheck)return;
      if(inventoryStatus.error){authMessage.dataset.error='true';authMessage.textContent=`La sesión funciona, pero falló la lectura del inventario: ${inventoryStatus.error.message}`;return}
      const missionStatus=await loadCloudMissions();
      if(check!==playerStateCheck)return;
      if(missionStatus.error){authMessage.dataset.error='true';authMessage.textContent=`No se pudieron cargar las misiones: ${missionStatus.error.message}`;return}
      const [gamesStatus,milestonesStatus]=await Promise.all([loadCloudGames(),loadCloudMilestones()]);
      if(check!==playerStateCheck)return;
      setCloudReadOnlyView(true);tick();updateProgress();renderAlbum();
      await loadSocialProfile();
      if(check!==playerStateCheck)return;
      authMessage.dataset.error='';
      const adminStatusText=adminError?'No se pudo verificar el rol; Pruebas permanece oculta.':isSuperAdmin?'Superadministrador confirmado.':'Pruebas permanece oculta para esta cuenta.';
      const missionStatusText=missionStatus.error?'No se pudieron cargar las misiones.':`Misiones cargadas: ${document.querySelectorAll('#cloudMissionResults .cloud-mission').length}.`;
      const extraStatus=[gamesStatus.error?'Minijuegos pendientes de migración.':'Minijuegos cargados.',milestonesStatus.error?'Hitos pendientes de migración.':'Hitos cargados.'].join(' ');
      authMessage.textContent=`Acceso propio confirmado: ${data.coins} monedas y ${data.starter_packs} sobres. Inventario cargado. ${missionStatusText} ${extraStatus} ${adminStatusText}`;
    },0);
  }else{
    $('#accountMenu').open=false;$('#accountStatus').textContent='';
    playerStateCheck++;setCloudReadOnlyView(false);isSuperAdmin=false;updateTestControls();cloudPlayerState=null;updateOpenPackLabel();$('#packRpcResults').replaceChildren();$('#cloudAlbumResults').replaceChildren();$('#cloudMissionResults').replaceChildren();$('#cloudGamesResults').replaceChildren();$('#cloudGamePlay').replaceChildren();$('#cloudGamePlay').hidden=true;$('#cloudMilestoneResults').replaceChildren();$('#adminTestResults').replaceChildren();
    if(!authMessage.dataset.error)authMessage.textContent='Inicia sesión o crea una cuenta para continuar.';
  }
}
authForm.addEventListener('submit',async event=>{
  event.preventDefault(); authMessage.dataset.error=''; authMessage.textContent='Iniciando sesión…';
  const submitButtons=authForm.querySelectorAll('button'); submitButtons.forEach(button=>button.disabled=true);
  const {data,error}=await supabase.auth.signInWithPassword({email:$('#authEmail').value.trim(),password:$('#authPassword').value});
  submitButtons.forEach(button=>button.disabled=false);
  if(error){authMessage.dataset.error='true';authMessage.textContent=error.message;return}
  showAuthState(data.session);
});
$('#signUpButton').onclick=async()=>{
  authMessage.dataset.error='';authMessage.textContent='Creando cuenta…';$('#signUpButton').disabled=true;
  const {data,error}=await supabase.auth.signUp({
    email:$('#authEmail').value.trim(),password:$('#authPassword').value,
    options:{emailRedirectTo:new URL('./',window.location.href).href}
  });
  $('#signUpButton').disabled=false;
  if(error){authMessage.dataset.error='true';authMessage.textContent=error.message;return}
  if(data.session)showAuthState(data.session);
  else authMessage.textContent='Cuenta creada. Revisa tu correo para confirmar la dirección.';
};
$('#signOutButton').onclick=async()=>{
  const button=$('#signOutButton'),status=$('#accountStatus');
  button.disabled=true;status.dataset.error='';status.textContent='Cerrando sesión…';
  authMessage.dataset.error='';authMessage.textContent='Cerrando sesión…';
  const {error}=await supabase.auth.signOut();button.disabled=false;
  if(error){
    status.dataset.error='true';status.textContent=`No se pudo cerrar sesión: ${error.message}`;
    authMessage.dataset.error='true';authMessage.textContent=error.message;return;
  }
  status.textContent='';$('#accountMenu').open=false;
  authMessage.textContent='Sesión cerrada.';
};
$('#saveUsernameButton').onclick=async()=>{
  const button=$('#saveUsernameButton'),input=$('#usernameInput'),status=$('#usernameStatus'),username=input.value.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,20}$/.test(username)){status.dataset.error='true';status.textContent='Usa entre 3 y 20 letras, números o guiones bajos.';return}
  const previousUsername=currentUsername;
  if(previousUsername&&username!==previousUsername&&usernameChangeCost===null){
    status.dataset.error='true';status.textContent='Aplica la migración 005 antes de cambiar un nombre guardado.';return;
  }
  if(previousUsername&&username!==previousUsername&&!confirm(`Cambiar @${previousUsername} por @${username} cuesta ${usernameChangeCost} monedas. ¿Continuar?`))return;
  button.disabled=true;status.dataset.error='';status.textContent='Guardando nombre…';
  const {data,error}=await supabase.rpc('set_trainer_username',{p_username:username});button.disabled=false;
  if(error){
    status.dataset.error='true';
    status.textContent=error.message?.includes('insufficient_username_change_coins')?`Necesitas ${usernameChangeCost} monedas para cambiar tu nombre.`:socialErrorMessage(error);
    updateUsernameButton();return;
  }
  const result=Array.isArray(data)?data[0]:data;
  currentUsername=typeof result==='string'?result:result?.username||username;input.value=currentUsername;status.dataset.error='';
  $('#authIdentity').textContent=`@${currentUsername}`;
  if(result&&typeof result==='object'&&Number.isFinite(Number(result.coins_balance))){
    cloudPlayerState={...cloudPlayerState,coins:Number(result.coins_balance)};S.coins=Number(result.coins_balance);renderCoins();tick();
  }
  const changeCost=Number(result?.change_cost)||0;
  status.textContent=changeCost?`Nombre cambiado a @${currentUsername} · −${changeCost} monedas · saldo ${result.coins_balance}.`:`Tu nombre: @${currentUsername} · guardado gratis.`;
  setSocialAvailability(true);updateUsernameButton();
  $('#socialSetupNotice').hidden=true;await loadSocialDashboard();
};
$('#usernameInput').addEventListener('input',updateUsernameButton);
$('#friendRequestForm').addEventListener('submit',async event=>{
  event.preventDefault();const status=$('#friendRequestStatus'),input=$('#friendUsernameInput'),button=$('#friendRequestForm button[type="submit"]');
  if(!currentUsername){status.dataset.error='true';status.textContent='Primero define tu nombre de usuario en Cuenta.';return}
  const username=input.value.trim().toLowerCase();button.disabled=true;status.dataset.error='';status.textContent='Enviando solicitud…';
  const {data,error}=await supabase.rpc('request_friend',{p_username:username});button.disabled=false;
  if(error){status.dataset.error='true';status.textContent=socialErrorMessage(error);return}
  const result=Array.isArray(data)?data[0]:data;
  status.dataset.error='';status.textContent=result?.request_status==='accepted'?`Ya son amigos con @${result.friend_username}.`:`Solicitud enviada a @${result?.friend_username||username}.`;
  input.value='';await loadSocialDashboard();
});
$('#tradeFriendSelect').onchange=()=>{
  const friendId=$('#tradeFriendSelect').value;
  if(friendId)loadTradeChoices(friendId);else resetTradeChoices();
};
$('#tradeOfferForm').addEventListener('submit',submitTradeOffer);
$('#refreshSocialButton').onclick=()=>loadSocialProfile();
$('#claimDailyRpcButton').onclick=async()=>{
  const button=$('#claimDailyRpcButton');button.disabled=true;authMessage.dataset.error='';
  authMessage.textContent='Solicitando el bono diario al servidor…';
  const {data,error}=await supabase.rpc('claim_daily_bonus');
  if(error){
    authMessage.dataset.error='true';authMessage.textContent=`No se pudo reclamar el bono: ${error.message}`;
    button.disabled=false;return;
  }
  const result=Array.isArray(data)?data[0]:data;
  if(!result){authMessage.dataset.error='true';authMessage.textContent='El servidor respondió sin datos del bono.';button.disabled=false;return}
  button.textContent='Bono diario reclamado';
  cloudPlayerState={...cloudPlayerState,coins:result.coins,daily_streak:result.daily_streak,last_daily:result.last_daily};updateOpenPackLabel();updateDailyBonusButton();
  authMessage.textContent=`RPC correcto: +${result.reward} monedas. Saldo en Supabase: ${result.coins}. Racha: ${result.daily_streak}.`;
};
$('#adminTestPackButton').onclick=async()=>{
  const button=$('#adminTestPackButton'),results=$('#adminTestResults');
  button.disabled=true;results.replaceChildren();authMessage.dataset.error='';
  authMessage.textContent='Solicitando una vista de prueba…';
  const {data,error}=await supabase.rpc('admin_test_pack');
  button.disabled=false;
  if(error){authMessage.dataset.error='true';authMessage.textContent=`No se pudo generar la prueba: ${error.message}`;return}
  if(!Array.isArray(data)||data.length!==5){
    authMessage.dataset.error='true';authMessage.textContent=`Respuesta inesperada: se recibieron ${data?.length||0} cartas.`;return;
  }
  const heading=document.createElement('h2'),list=document.createElement('ul');
  heading.textContent='Sobre de prueba · no guardado';list.className='rpc-pack-list';
  data.forEach(card=>{
    const item=document.createElement('li'),image=document.createElement('img'),name=document.createElement('span');
    image.src=card.is_shiny?SHINY_ART(card.pokemon_id):ART(card.pokemon_id);image.alt='';image.loading='lazy';
    name.textContent=`#${String(card.pokemon_id).padStart(3,'0')}${card.is_shiny?' · SHINY':''}`;
    item.append(image,name);list.append(item);
    info(card.pokemon_id).then(p=>{name.textContent=`#${String(card.pokemon_id).padStart(3,'0')} ${p.name}${card.is_shiny?' · SHINY':''}`}).catch(()=>{});
  });
  results.replaceChildren(heading,list);
  authMessage.textContent='Vista generada por Supabase. No se modificaron monedas, sobres ni inventario.';
};
$('#openPackRpcButton').onclick=async()=>{
  const button=$('#openPackRpcButton');button.disabled=true;$('#packBtn').disabled=true;
  authMessage.dataset.error='';authMessage.textContent='Abriendo sobre de forma segura…';
  $('#packRpcResults').replaceChildren();
  const {data,error}=await supabase.rpc('open_pack');
  if(error){
    authMessage.dataset.error='true';authMessage.textContent=`No se pudo abrir el sobre: ${error.message}`;
    updateOpenPackLabel();tick();return;
  }
  if(!Array.isArray(data)||data.length!==5){
    authMessage.dataset.error='true';authMessage.textContent=`Respuesta inesperada de Supabase: se recibieron ${data?.length||0} cartas.`;
    updateOpenPackLabel();tick();return;
  }
  const first=data[0];cloudPlayerState={...cloudPlayerState,coins:first.coins_balance,starter_packs:first.starter_packs_remaining};
  const inventoryStatus=await loadCloudInventory();updateOpenPackLabel();
  revealCloudPack(data);
  if(inventoryStatus.error){authMessage.dataset.error='true';authMessage.textContent=`Sobre guardado, pero no se pudo leer el inventario: ${inventoryStatus.error.message}`;return}
  await Promise.all([loadCloudMissions(),loadCloudMilestones()]);
  authMessage.textContent=`Sobre registrado: 5 estampas en tu inventario. Saldo: ${first.coins_balance} monedas; sobres gratis: ${first.starter_packs_remaining}.`;
};
supabase.auth.onAuthStateChange((_event,session)=>showAuthState(session));
supabase.auth.getSession().then(({data,error})=>{
  if(error){authMessage.dataset.error='true';authMessage.textContent='No se pudo consultar la sesión. Inténtalo de nuevo.';return}
  showAuthState(data.session);
}).catch(()=>{authMessage.dataset.error='true';authMessage.textContent='No se pudo conectar con Supabase.'});
const KEY='pokealbum-v2', DEMO_KEY='pokealbum-admin-demo-v1';
let S={packs:3,last:Date.now(),starterPacks:5,coins:500,owned:{},stickers:{},shinyOwned:{},shinyStickers:{},profile:'normal'};
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)))}catch{}
S.owned ||= {}; S.stickers ||= {}; S.shinyOwned ||= {}; S.shinyStickers ||= {};
if(!PROFILES[S.profile])S.profile='normal';
S.coins ??=500; S.starterPacks ??=5; const starterPacksBeforeCap=Number(S.starterPacks)||0; S.starterPacks=Math.max(0,Math.min(5,starterPacksBeforeCap)); S.daily ||= {last:'',streak:0}; S.missions ||= {date:'',list:[]}; S.games ||= {date:'',played:{}}; S.claimed ||= {}; S.lifePacks ??=0;
Object.keys(S.owned).forEach(id=>{
  const extra=Math.max(0,Number(S.owned[id])-1);
  if(extra){S.stickers[id]=(S.stickers[id]||0)+extra;S.owned[id]=1}
});
const save=()=>{try{localStorage.setItem(demoMode?DEMO_KEY:KEY,JSON.stringify(S))}catch{}};
function loadDemoState(){
  const state={packs:3,last:Date.now(),starterPacks:5,coins:500,owned:{},stickers:{},shinyOwned:{},shinyStickers:{},profile:'normal'};
  try{
    const stored=JSON.parse(localStorage.getItem(DEMO_KEY));
    if(stored&&typeof stored==='object'&&!Array.isArray(stored))Object.assign(state,stored);
  }catch{}
  state.owned||={};state.stickers||={};state.shinyOwned||={};state.shinyStickers||={};
  state.coins??=500;state.starterPacks??=5;state.daily||={last:'',streak:0};state.missions||={date:'',list:[]};
  state.games||={date:'',played:{}};state.claimed||={};state.lifePacks??=0;state.profile='normal';
  return state;
}
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
  fill.style.width=percentage+'%'; fill.style.setProperty('--progress-hue',String(8+percentage*.3));
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
const shinyChance=(profile=S.profile)=>demoMode?PROFILES.test.baseShinyChance:PROFILES[profile].baseShinyChance;
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
  const activeProfile=demoMode?PROFILES.test:PROFILES[S.profile];
  if(activeProfile.unlimited){
    $('#packN').textContent='∞'; $('#packBtn').disabled=false;
    $('#packPrice').textContent='5 cartas · gratis';
    $('#timer').textContent=demoMode?'Demo admin: sobres ilimitados · progreso local aislado.':'Pruebas: sobres ilimitados · 50% shiny por carta.';
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
function revealCloudPack(cards){
  const box=$('#cards');box.replaceChildren();$('#close').hidden=false;$('#close').textContent='Voltear todas';$('#reveal').hidden=false;
  cards.forEach(cardData=>{
    const id=cardData.pokemon_id,shiny=cardData.is_shiny,card=document.createElement('button');
    card.className='card';card.classList.toggle('shiny',shiny);
    card.setAttribute('aria-label',`Carta ${shiny?'shiny ':''}número ${id}, guardada. Pulsa para voltear.`);
    card.innerHTML=`<span class="in"><span class="back"></span><span class="front type-bg r-common"><img alt="" src="${shiny?SHINY_ART(id):ART(id)}"><b>#${String(id).padStart(3,'0')}</b><i>Estampa${shiny?' shiny':''}</i>${shiny?'<strong class="shine-mark">SHINY</strong>':''}</span></span>`;
    applyTypeTheme(card.querySelector('.front'),'normal');
    card.onclick=()=>{
      if(!card.classList.contains('on')){
        card.classList.add('on');card.setAttribute('aria-label',`Estampa ${shiny?'shiny ':''}#${id}, guardada`);
        if(!cloudMode)trackEvent('flip',1);
        updateRevealAction();return;
      }
      showDetail(id,shiny);
    };
    box.append(card);
    info(id).then(p=>{
      const front=card.querySelector('.front');
      front.classList.remove('r-common','r-uncommon','r-rare','r-legendary');front.classList.add(`r-${rarity(p)}`);
      front.querySelector('img').src=imageFor(p,shiny);front.querySelector('b').textContent=`#${id} ${p.name}`;
      front.querySelector('i').textContent=`${RL[rarity(p)]} · ${p.types.join(', ')}`;
      applyTypeTheme(front,p.types[0]);
    }).catch(()=>{});
  });
  updateRevealAction();say('Las 5 estampas del sobre se guardaron en tu colección.');box.querySelector('.card')?.focus();
}
function updateRevealAction(){
  const cards=[...$('#cards').querySelectorAll('.card')];
  $('#close').textContent=cards.length&&cards.every(card=>card.classList.contains('on'))?'Continuar':'Voltear todas';
}

async function openPack(){
  if(cloudMode){$('#openPackRpcButton').click();return}
  const activeProfile=demoMode?PROFILES.test:PROFILES[S.profile];
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
  if(!activeProfile.unlimited||demoMode){S.lifePacks++;trackEvent('pack',1);trackEvent('shiny',shinyCount);trackEvent('new',newCount);checkMilestones()}
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
  if(cloudMode||demoMode||!isSuperAdmin)return;
  S.profile=b.dataset.profile;
  save(); tick(); if(S.profile==='normal')checkMilestones(); say(S.profile==='test'?'Perfil de pruebas activado.':'Perfil normal activado.');
});
$('#toggleDemoModeButton').onclick=async()=>{
  if(!isSuperAdmin)return;
  const button=$('#toggleDemoModeButton');button.disabled=true;
  if(!demoMode){
    demoMode=true;S=loadDemoState();save();setCloudReadOnlyView(false);
    updateEconomy();renderAlbum();renderQuests();
    document.querySelector('nav [data-tab="packs"]').click();
    $('#accountMenu').open=false;button.disabled=false;return;
  }
  $('#adminModeStatus').textContent='Restaurando tu vista en línea…';
  demoMode=false;setCloudReadOnlyView(true);
  document.querySelector('nav [data-tab="packs"]').click();
  const inventoryStatus=await loadCloudInventory();
  if(inventoryStatus.error){
    demoMode=true;setCloudReadOnlyView(false);updateEconomy();renderAlbum();renderQuests();
    $('#adminModeStatus').textContent='No se pudo cargar la colección en línea. La demo sigue activa.';
    button.disabled=false;return;
  }
  await Promise.all([loadCloudMissions(),loadCloudGames(),loadCloudMilestones()]);
  updateTestControls();$('#accountMenu').open=false;button.disabled=false;
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#reveal').hidden&&!$('#close').hidden){$('#reveal').hidden=true;$('#packBtn').focus()}});

// --- Álbum y reserva de estampas ---
const PAGE_SIZE=18, SIDE_SIZE=9, PAGE_COUNT=Math.ceil(TOTAL/PAGE_SIZE), DETAIL_DELAY=300;
let detailVariants=[],detailIndex=-1,detailRequest=0,detailLoading=false;
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
  if(cloudMode)return;
  const placed=Object.keys(S.owned).length, loose=Object.values(S.stickers).reduce((a,n)=>a+n,0)+Object.values(S.shinyStickers).reduce((a,n)=>a+n,0);
  if(!placed&&!loose)return;
  if(!confirm(`Se borrarán ${placed} estampas pegadas y ${loose} en reserva. Esta acción no se puede deshacer. ¿Continuar?`))return;
  S.owned={}; S.stickers={}; S.shinyOwned={}; S.shinyStickers={}; selectedSticker=null; selectedDropTarget=null; currentPage=0;
  save(); renderAlbum(); say('Colección vaciada.');
};
function placeSticker(id,shiny=false,replaceNormal=false){
  if(cloudMode){placeCloudSticker(id,shiny);return}
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
  if(cloudMode){placeAllCloudStickers();return}
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
  if(cloudMode){sellCloudSticker(id,shiny);return}
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
function getOwnedDetailVariants(){
  const ids=new Set([...Object.keys(S.owned),...Object.keys(S.stickers),...Object.keys(S.shinyOwned),...Object.keys(S.shinyStickers)]);
  const variants=[];
  ids.forEach(key=>{
    const id=Number(key);if(!Number.isInteger(id)||id<1||id>TOTAL)return;
    if((!!S.owned[id]&&!S.shinyOwned[id])||Number(S.stickers[id])>0)variants.push({id,shiny:false});
    if(!!S.shinyOwned[id]||Number(S.shinyStickers[id])>0)variants.push({id,shiny:true});
  });
  return variants.sort((a,b)=>a.id-b.id||Number(a.shiny)-Number(b.shiny));
}
function updateDetailControls(){
  const previous=$('#detailPrev'),next=$('#detailNext'),position=$('#detailPosition');
  if(!previous||!next||!position)return;
  previous.disabled=detailLoading||detailIndex<=0;
  next.disabled=detailLoading||detailIndex<0||detailIndex>=detailVariants.length-1;
  position.textContent=detailVariants.length?`${detailIndex+1} de ${detailVariants.length}`:'0 de 0';
}
function navigateDetail(offset){
  if(detailLoading)return;
  const nextIndex=detailIndex+offset;
  if(nextIndex<0||nextIndex>=detailVariants.length)return;
  const next=detailVariants[nextIndex];showDetail(next.id,next.shiny);
}
async function showDetail(id,shiny=false){
  const request=++detailRequest;
  detailVariants=getOwnedDetailVariants();
  detailIndex=detailVariants.findIndex(card=>card.id===id&&card.shiny===shiny);
  if(detailIndex<0){detailVariants.push({id,shiny});detailVariants.sort((a,b)=>a.id-b.id||Number(a.shiny)-Number(b.shiny));detailIndex=detailVariants.findIndex(card=>card.id===id&&card.shiny===shiny)}
  detailLoading=true;
  const previous=$('#detailPrev'),next=$('#detailNext');
  if(previous)previous.disabled=true;if(next)next.disabled=true;
  try{const p=await info(id);if(request!==detailRequest)return;
    const inventory=shiny?S.shinyStickers:S.stickers, isPlaced=!!S.owned[id]&&!!S.shinyOwned[id]===shiny;
    const replaceNormal=shiny&&!!S.owned[id]&&!S.shinyOwned[id]&&!!inventory[id];
    const status=isPlaced?'Pegada':replaceNormal?'Shiny repetida · puedes cambiarla':'En reserva';
    const description=await speciesDescription(id).catch(()=> 'La descripción no está disponible ahora.');
    if(request!==detailRequest)return;
    $('#detailBody').innerHTML=`<article class="detail-sticker${shiny?' is-shiny':''}"><div class="detail-topline"><span>POKÉÁLBUM · KANTO</span><span>#${String(id).padStart(3,'0')}</span></div><div class="detail-art type-bg${shiny?' shiny':''}"><img alt="${shiny?'Shiny ':''}${p.name}" src="${imageFor(p,shiny)}">${shiny?'<span class="shine-mark">SHINY</span>':''}<button id="detailPrev" class="detail-nav detail-nav-prev" type="button" aria-label="Carta anterior" title="Carta anterior">←</button><span id="detailPosition" class="detail-position" aria-live="polite"></span><button id="detailNext" class="detail-nav detail-nav-next" type="button" aria-label="Siguiente carta" title="Siguiente carta">→</button></div><div class="detail-copy"><p class="detail-eyebrow">${RL[rarity(p)]}${shiny?' · VARIANTE SHINY':''}</p><h3 id="detailTitle">${p.name}</h3><div class="detail-types">${p.types.map(type=>`<span>${TYPE_LABELS[type]||type}</span>`).join('')}</div><p class="detail-description">${description}</p><p class="detail-inventory">${status} · ×${inventory[id]||(isPlaced?1:0)||1}</p></div></article>`;
    $('#detailPrev').onclick=()=>navigateDetail(-1);$('#detailNext').onclick=()=>navigateDetail(1);
    applyTypeTheme($('#detailBody .detail-art'),p.types[0]);
    $('#detailBody .detail-art').classList.toggle('shiny',shiny);
    const [typeColor,typePale]=TYPE_THEMES[p.types[0]]||TYPE_THEMES.normal;
    $('#detailBody .detail-copy').style.setProperty('--type-color',typeColor);
    $('#detailBody .detail-copy').style.setProperty('--type-pale',typePale);
    $('#placeSticker').dataset.id=id; $('#placeSticker').dataset.shiny=String(shiny); $('#placeSticker').textContent=replaceNormal?(S.profile==='normal'?`Cambiar por shiny · +${SHINY_UPGRADE_REWARD} monedas`:'Cambiar por shiny · Pruebas'):'Pegar en el álbum';
    $('#placeSticker').classList.toggle('replace-shiny',replaceNormal); $('#placeSticker').hidden=!inventory[id]||!!S.owned[id]&&!replaceNormal;
    $('#removeSticker').dataset.id=id; $('#removeSticker').dataset.shiny=String(shiny); $('#removeSticker').hidden=!isPlaced;
    detailLoading=false;updateDetailControls();
    if(!$('#detail').open)$('#detail').showModal();
  }catch{if(request===detailRequest){detailLoading=false;updateDetailControls();say('No se pudo cargar el detalle. Revisa tu conexión.')}}
}
$('#placeSticker').onclick=()=>{
  const id=Number($('#placeSticker').dataset.id), shiny=$('#placeSticker').dataset.shiny==='true';
  if(cloudMode){$('#detail').close();placeCloudSticker(id,shiny);return}
  const replaceNormal=shiny&&!!S.owned[id]&&!S.shinyOwned[id];
  if(!(shiny?S.shinyStickers:S.stickers)[id]||(S.owned[id]&&!replaceNormal))return;
  $('#detail').close(); currentPage=Math.floor((id-1)/PAGE_SIZE); renderPage(); placeSticker(id,shiny,replaceNormal);
};
$('#removeSticker').onclick=()=>{
  const id=Number($('#removeSticker').dataset.id), shiny=$('#removeSticker').dataset.shiny==='true';
  if(cloudMode){$('#detail').close();removeCloudSticker(id);return}
  if(!S.owned[id]||!!S.shinyOwned[id]!==shiny)return;
  const inventory=shiny?S.shinyStickers:S.stickers; inventory[id]=(inventory[id]||0)+1;
  delete S.owned[id]; delete S.shinyOwned[id];
  save(); $('#detail').close(); renderAlbum(); say(`Estampa ${shiny?'shiny ':''}${id} devuelta a tu reserva.`);
  document.querySelector(`[data-slot="${id}"]`)?.focus();
};
document.querySelectorAll('nav button[data-tab]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button[data-tab]').forEach(x=>x===b?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  $('#packs').hidden=b.dataset.tab!=='packs'; $('#album').hidden=b.dataset.tab!=='album'; $('#quests').hidden=b.dataset.tab!=='quests'; $('#friends').hidden=b.dataset.tab!=='friends';
  if(b.dataset.tab==='album')renderAlbum();
  if(b.dataset.tab==='quests'){if(cloudMode)Promise.all([loadCloudMissions(),loadCloudGames(),loadCloudMilestones()]);else renderQuests()}
  if(b.dataset.tab==='friends'&&cloudMode)loadSocialDashboard();
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
  if(!S.missions||!Array.isArray(S.missions.list))S.missions={date:'',list:[]};
  if(S.missions.date===today&&S.missions.list.length>=6)return;
  if(S.missions.date===today){
    const available=MISSION_POOL.filter(candidate=>!S.missions.list.some(mission=>mission.type===candidate.type&&mission.goal===candidate.goal));
    while(S.missions.list.length<6&&available.length){const index=rnd(available.length);S.missions.list.push({...available.splice(index,1)[0],progress:0,claimed:false})}
    save();return;
  }
  const pool=[...MISSION_POOL],list=[];
  while(list.length<6){const index=rnd(pool.length);list.push({...pool.splice(index,1)[0],progress:0,claimed:false})}
  S.missions={date:today,list};save();
}
function ensureGames(){
  const today=localDate();
  if(!S.games||S.games.date!==today||!S.games.played)S.games={date:today,played:{}};
}
function missionLabel(type){return {pack:'Sobres abiertos',place:'Estampas pegadas',flip:'Cartas reveladas',shiny:'Estampas shiny',new:'Estampas nuevas',typeCorrect:'Tipos acertados',guessCorrect:'Pokémon adivinados',gameComplete:'Minijuegos completados'}[type]||type}
function trackEvent(type,amount){
  if(S.profile==='test'||!amount)return;
  ensureMissions();let changed=false;
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
function claimDaily(){
  if(cloudMode){$('#claimDailyRpcButton').click();return}
  if(!dailyAvailable())return;
  const streak=nextStreak();
  S.daily={last:localDate(),streak};
  award(dailyReward(),`Bono diario · racha ${streak}`);
  renderQuests();
}
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
