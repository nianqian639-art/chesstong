import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const commonSource = readFileSync(new URL('../public/js/common.js', import.meta.url), 'utf8');
function functionSource(source: string, name: string, nextName: string) {
  const start=source.indexOf(`function ${name}(`),end=source.indexOf(`function ${nextName}(`,start);
  if(start<0||end<0) throw new Error(`Cannot find ${name} in source`);
  return source.slice(start,end);
}

function puzzleHarness(correct: boolean) {
  const elements: Record<string, any> = { practiceBoard: { fen:'', click:null }, problemMeta:{innerHTML:''}, practiceResult:{innerHTML:''} };
  const context=vm.createContext({
    document:{getElementById:(id:string)=>elements[id]},
    renderBoard:(element:any,fen:string,_selected:string,click:(square:string,piece:string)=>void)=>{element.fen=fen;element.click=click;},
    API:{user:{points:0},req:async()=>({isCorrect:correct,awardedPoints:0})},
    esc:(value:string)=>value,practiceUi:(key:string)=>key,playUiSound(){},getRank(){return{level:1}},
    ctTrialMode:true,window:{ctTrialMode:true},toast(){},chooseBoardMove:async(_fen:string,from:string,to:string)=>from+to,
  });
  vm.runInContext(`let currentProblem={id:'test',question:'Find mate',fen:'6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1'};
    let practiceBoardFen=currentProblem.fen,practiceSelected='',practiceSolved=false,practiceSubmitting=false,practiceAttempt=0,lastPracticeAnswer='';`,context);
  vm.runInContext(functionSource(commonSource,'parseFen','sqName'),context);
  const submitStart=appSource.indexOf('async function submitPracticeMove('),submitEnd=appSource.indexOf('async function submitPractice()',submitStart);
  vm.runInContext(functionSource(appSource,'previewPracticeMove','renderProblem')+functionSource(appSource,'renderProblem','showHint')+appSource.slice(submitStart,submitEnd),context);
  return {context,elements};
}

const flush=async()=>{for(let i=0;i<8;i++) await Promise.resolve();};

it('shows a solved puzzle move on the board and keeps the solved position', async()=>{
  const h=puzzleHarness(true);
  vm.runInContext('renderProblem()',h.context);
  await h.elements.practiceBoard.click('a1','R');
  await h.elements.practiceBoard.click('a8','');
  await flush();
  expect(h.elements.practiceResult.innerHTML).toContain('correct');
  expect(h.elements.practiceBoard.fen.startsWith('R5k1/')).toBe(true);
  expect(h.elements.practiceBoard.fen).toContain('/6PP/6K1 b ');
  expect(vm.runInContext('practiceSolved',h.context)).toBe(true);
});

it('restores the original position after an incorrect move', async()=>{
  const h=puzzleHarness(false);
  const initial='6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1';
  vm.runInContext('renderProblem()',h.context);
  await h.elements.practiceBoard.click('a1','R');
  await h.elements.practiceBoard.click('a2','');
  await flush();
  expect(h.elements.practiceResult.innerHTML).toContain('wrong');
  expect(h.elements.practiceBoard.fen).toBe(initial);
  expect(vm.runInContext('practiceSolved',h.context)).toBe(false);
});

it('previews promotion, en passant, and castling correctly',()=>{
  const h=puzzleHarness(true);
  const promotion=vm.runInContext(`previewPracticeMove('7k/P7/8/8/8/8/8/7K w - - 0 1','a7a8n')`,h.context) as string;
  expect(promotion.startsWith('N6k/')).toBe(true);
  const enPassant=vm.runInContext(`previewPracticeMove('7k/8/8/3pP3/8/8/8/7K w - d6 0 1','e5d6')`,h.context) as string;
  expect(enPassant.startsWith('7k/8/3P4/8/')).toBe(true);
  const castle=vm.runInContext(`previewPracticeMove('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1g1')`,h.context) as string;
  expect(castle.endsWith('/R4RK1 b kq - 1 1')).toBe(true);
});

it('shows visible loading feedback and locks the explanation button until generation finishes', async()=>{
  let resolveRequest: (value:any)=>void = ()=>{};
  const pending = new Promise(resolve=>{resolveRequest=resolve;});
  const button={disabled:false,attributes:{} as Record<string,string>,setAttribute(key:string,value:string){this.attributes[key]=value;},removeAttribute(key:string){delete this.attributes[key];}};
  const elements:Record<string,any>={practiceResult:{innerHTML:'',appendChild(el:any){elements[el.id]=el;}}};
  const context=vm.createContext({
    document:{getElementById:(id:string)=>elements[id],querySelector:()=>button,createElement:()=>({id:'',className:'',innerHTML:'',textContent:'',attributes:{} as Record<string,string>,setAttribute(key:string,value:string){this.attributes[key]=value;}})},
    API:{req:()=>pending},practiceUi:(key:string)=>key==='loading'?'Generating explanation…':key,
    explanationMatchesCurrentLanguage:()=>true,cleanLearnerExplanation:(value:string)=>value,
    speakButton:()=>'',learnerExplanationHtml:(value:string)=>value,getLang:()=>"en",toast(){},
  });
  vm.runInContext("let currentProblem={id:'p1',solution:'e4'}, explainInProgress=false, lastPracticeAnswer='e4';",context);
  const start=appSource.indexOf('async function explainAnswer()'),end=appSource.indexOf('// ── AI Battle ──',start);
  expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);
  vm.runInContext(appSource.slice(start,end),context);
  const request=vm.runInContext('explainAnswer()',context) as Promise<void>;
  expect(button.disabled).toBe(true);
  expect(button.attributes['aria-busy']).toBe('true');
  expect(elements.explanationFeedback.innerHTML).toContain('loading-spinner');
  expect(elements.explanationFeedback.innerHTML).toContain('Generating explanation…');
  resolveRequest({explanation:'A clear explanation.'});
  await request;
  expect(elements.explanationFeedback.className).toBe('explanation-feedback explanation-success');
  expect(elements.explanationFeedback.innerHTML).toContain('A clear explanation.');
  expect(button.disabled).toBe(false);
  expect(button.attributes['aria-busy']).toBeUndefined();
});
