// Presentation preferences are local to this browser and persist across visits.
const FONT_STYLES = ['default', 'brush', 'serif'];
function setInterfaceFont(value){
  const font = FONT_STYLES.includes(value) ? value : 'default';
  document.documentElement.dataset.interfaceFont = font;
  localStorage.setItem('ct.interfaceFont', font);
  const select = document.getElementById('interfaceFont');
  if(select) select.value = font;
}
function setResultFont(value){
  const font = FONT_STYLES.includes(value) ? value : 'brush';
  document.documentElement.dataset.resultFont = font;
  localStorage.setItem('ct.resultFont', font);
  const select = document.getElementById('resultFont');
  if(select) select.value = font;
}
setInterfaceFont(localStorage.getItem('ct.interfaceFont'));
setResultFont(localStorage.getItem('ct.resultFont'));
let resultTimer = null;
let visibleGameResult = null;
function resultReasonKey(reason){
  return ({checkmate:'checkmate',stalemate:'stalemate',resign:'resignReason',timeout:'timeoutReason',disconnect:'disconnectReason',draw:'drawn'})[reason] || '';
}
function resultText(result,reason){
  const key = resultReasonKey(reason);
  return t(result) + (key ? ' · ' + t(key) : '');
}
function closeGameResult(){
  clearTimeout(resultTimer); resultTimer=null;
  document.getElementById('gameResultOverlay')?.remove();
  visibleGameResult=null;
}
function refreshGameResult(){
  if(!visibleGameResult) return;
  const title=document.getElementById('gameResultTitle');
  const reason=document.getElementById('gameResultReason');
  if(title) title.textContent=t(visibleGameResult.result);
  if(reason) reason.textContent=visibleGameResult.reason ? t(resultReasonKey(visibleGameResult.reason)) : '';
}
function showGameResult(result, reason){
  closeGameResult();
  visibleGameResult={result,reason};
  // Allow the final position to paint before presenting the result.
  resultTimer=setTimeout(()=>{
    const overlay=document.createElement('div');
    overlay.id='gameResultOverlay'; overlay.className='game-result-overlay';
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','gameResultTitle');
    overlay.innerHTML='<div class="game-result-card"><div class="game-result-mark">♚</div><h2 id="gameResultTitle"></h2><p id="gameResultReason"></p><button class="btn btn-primary" data-i18n="viewBoard"></button></div>';
    overlay.querySelector('button').textContent=t('viewBoard');
    overlay.querySelector('button').onclick=closeGameResult;
    overlay.onclick=e=>{if(e.target===overlay) closeGameResult();};
    document.body.appendChild(overlay);refreshGameResult();
    overlay.querySelector('button').focus();
  },650);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeGameResult();});

let pendingPromotion = null;
function cancelPromotion(){ if(pendingPromotion) pendingPromotion(null); }
async function chooseBoardMove(fen, from, to){
  if(pendingPromotion) return null;
  const piece = parseFen(fen)[8 - Number(from[1])]?.['abcdefgh'.indexOf(from[0])];
  const promotes = ((piece === 'P' && from[1] === '7' && to[1] === '8') ||
    (piece === 'p' && from[1] === '2' && to[1] === '1')) && Math.abs(from.charCodeAt(0)-to.charCodeAt(0)) <= 1;
  if(!promotes) return from + to;
  return new Promise(resolve=>{
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'promotionOverlay'; overlay.className = 'modal-overlay'; overlay.style.display='flex';
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','promotionTitle');
    overlay.innerHTML = `<div class="modal-box" style="text-align:center"><h3 id="promotionTitle">${t('choosePromotion')}</h3><div class="row" style="justify-content:center">${['q','r','b','n'].map((p,i)=>`<button class="btn btn-ghost" data-promotion="${p}" aria-label="${t(['promotionQueen','promotionRook','promotionBishop','promotionKnight'][i])}"><span style="font-size:36px">${PIECES[piece === 'P' ? p.toUpperCase() : p]}</span> ${t(['promotionQueen','promotionRook','promotionBishop','promotionKnight'][i])}</button>`).join('')}</div><button class="btn btn-ghost" id="cancelPromotion">${t('cancelMove')}</button></div>`;
    const keydown = e=>{
      if(e.key==='Escape'){e.preventDefault();finish(null);}
      if(e.key==='Tab'){
        const buttons=[...overlay.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
        e.preventDefault();buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
      }
    };
    const finish = promotion=>{
      document.removeEventListener('keydown',keydown);
      overlay.remove();pendingPromotion=null;
      if(previousFocus?.isConnected) previousFocus.focus();
      resolve(promotion ? from + to + promotion : null);
    };
    pendingPromotion=finish;
    overlay.querySelectorAll('[data-promotion]').forEach(button=>button.onclick=()=>finish(button.dataset.promotion));
    overlay.querySelector('#cancelPromotion').onclick=()=>finish(null);
    document.addEventListener('keydown',keydown);document.body.appendChild(overlay);
    overlay.querySelector('button').focus();
  });
}
