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

function puzzleHarness(correct: boolean, request?: (url:string,method:string,payload:any)=>Promise<any>) {
  const elements: Record<string, any> = { practiceBoard: { fen:'', click:null }, problemMeta:{innerHTML:''} };
  const requests: Array<{url:string;method:string;payload:any}> = [];
  const result={children:[] as any[],appendChild(el:any){this.children.push(el);elements[el.id]=el;},innerHTML:""} as any;
  Object.defineProperty(result,"innerHTML",{get(){return this._innerHTML||"";},set(value:string){for(const child of this.children)delete elements[child.id];this.children=[];this._innerHTML=value;}});
  elements.practiceResult=result;
  const explanationButton={disabled:false,attributes:{} as Record<string,string>,setAttribute(key:string,value:string){this.attributes[key]=value;},removeAttribute(key:string){delete this.attributes[key];}};
  const defaultRequest=async(url:string)=>url==="/problems/submit"
    ? {isCorrect:correct,awardedPoints:0,correctAnswer:"Ra8#"}
    : url==="/problems/explain"
      ? {explanation:"The rook controls the eighth rank.",source:"qwen",engineFeedback:"Ra8#"}
      : {answer:"It checks the king on the back rank.",source:"qwen"};
  const createElement=()=>({id:"",className:"",innerHTML:"",textContent:"",attributes:{} as Record<string,string>,children:[] as any[],appendChild(child:any){this.children.push(child);},setAttribute(key:string,value:string){this.attributes[key]=value;}});
  const context=vm.createContext({
    document:{getElementById:(id:string)=>elements[id],querySelector:()=>explanationButton,createElement},
    renderBoard:(element:any,fen:string,_selected:string,click:(square:string,piece:string)=>void)=>{element.fen=fen;element.click=click;},
    API:{user:{points:0},req:(url:string,method:string,payload:any)=>{requests.push({url,method,payload});return request?request(url,method,payload):defaultRequest(url);}},
    esc:(value:string)=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"),practiceUi:(key:string,vars:any={})=>key==="reference"?`reference: ${vars.answer}`:({explain:"AI explanation",explanation:"Position explanation:",ask:"Ask AI"}[key]||key),aiLoadingMarkup:(label:string)=>`<span class="loading-spinner"></span>${label}`,aiWaitLabel:(key:string)=>key,explanationMatchesCurrentLanguage:()=>true,cleanLearnerExplanation:(value:string)=>value,speakButton:()=>'',learnerExplanationHtml:(value:string)=>value,aiSourceLabel:(source:string)=>source,engineFeedbackMarkup:()=>'',playUiSound(){},getRank(){return{level:1}},getLang:()=>"en",
    ctTrialMode:true,window:{ctTrialMode:true},toast(){},chooseBoardMove:async(_fen:string,from:string,to:string)=>from+to,
  });
  vm.runInContext(`let currentProblem={id:'test',question:'Find mate',fen:'6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1'};
    let practiceBoardFen=currentProblem.fen,practiceSelected='',practiceSolved=false,practiceSubmitting=false,practiceAttempt=0,lastPracticeAnswer='',puzzleFollowupHistory=[],puzzleFollowupInProgress=false,followupRequestId=0,followupAttempt=-1,explainInProgress=false,explanationRequestId=0,explanationAttempt=-1;`,context);
  vm.runInContext(functionSource(commonSource,'parseFen','sqName'),context);
  const submitStart=appSource.indexOf('async function submitPracticeMove('),submitEnd=appSource.indexOf('async function submitPractice()',submitStart);
  const explainStart=appSource.indexOf('async function explainAnswer('),aiBattleStart=appSource.indexOf('// ── AI Battle ──',explainStart);
  vm.runInContext(functionSource(appSource,'previewPracticeMove','renderProblem')+functionSource(appSource,'renderProblem','showHint')+appSource.slice(submitStart,submitEnd)+appSource.slice(explainStart,aiBattleStart),context);
  return {context,elements,requests,explanationButton};
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

it('shows a visible move-checking state while the server is judging the answer', async()=>{
  let resolveRequest: (value:any)=>void = ()=>{};
  const pending=new Promise(resolve=>{resolveRequest=resolve;});
  const h=puzzleHarness(true,(url)=>url==="/problems/submit"?pending:Promise.resolve({explanation:'A clear explanation.',source:'qwen'}));
  const request=vm.runInContext('submitPracticeMove("a1a8")',h.context) as Promise<void>;
  expect(h.elements.practiceResult.innerHTML).toContain('loading-spinner');
  expect(h.elements.practiceResult.innerHTML).toContain('judging');
  resolveRequest({isCorrect:true,awardedPoints:0});
  await request;
  expect(h.elements.practiceResult.innerHTML).toContain('correct');
  expect(h.requests.some(call=>call.url==='/problems/explain')).toBe(true);
});

it('automatically requests the AI explanation after judgment and keeps follow-up available', async()=>{
  const h=puzzleHarness(false);
  await vm.runInContext('submitPracticeMove("a1a2")',h.context);
  await flush();
  expect(h.requests.map(call=>call.url)).toContain('/problems/explain');
  expect(h.elements.practiceResult.innerHTML).toContain('reference: Ra8#');
  expect(h.elements.practiceResult.innerHTML).toContain('AI explanation');
  expect(h.elements.explanationFeedback.innerHTML).toContain('The rook controls the eighth rank.');
  expect(h.elements.explanationFeedback.children[0].innerHTML).toContain('askPuzzleFollowup()');

  const askButton={disabled:false,setAttribute(){},removeAttribute(){}};
  h.elements.puzzleFollowupQuestion={value:'Why does this move work?',parentElement:{querySelector:()=>askButton}};
  h.elements.puzzleFollowupAnswers={innerHTML:'',textContent:''};
  await vm.runInContext('askPuzzleFollowup()',h.context);
  expect(h.requests.map(call=>call.url)).toContain('/problems/ask');
  expect(h.elements.puzzleFollowupAnswers.textContent).toContain('It checks the king on the back rank.');
});

it('ignores an explanation response from an earlier attempt on the same puzzle', async()=>{
  const explanations: Array<(value:any)=>void> = [];
  const h=puzzleHarness(false,(url)=>url==='/problems/explain'?new Promise(resolve=>{explanations.push(resolve);}):Promise.resolve({isCorrect:false,awardedPoints:0,correctAnswer:'Ra8#'}));
  await vm.runInContext('submitPracticeMove("a1a2")',h.context);
  await vm.runInContext('submitPracticeMove("a1a3")',h.context);
  expect(explanations).toHaveLength(2);
  explanations[1]({explanation:'Explanation for the newer attempt.',source:'qwen'});
  await flush();
  expect(h.elements.explanationFeedback.innerHTML).toContain('newer attempt');
  explanations[0]({explanation:'Stale explanation for the first attempt.',source:'qwen'});
  await flush();
  expect(h.elements.explanationFeedback.innerHTML).toContain('newer attempt');
  expect(h.elements.explanationFeedback.innerHTML).not.toContain('Stale explanation');
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
  let requestPayload:any;
  const button={disabled:false,attributes:{} as Record<string,string>,setAttribute(key:string,value:string){this.attributes[key]=value;},removeAttribute(key:string){delete this.attributes[key];}};
  const elements:Record<string,any>={practiceResult:{innerHTML:'',appendChild(el:any){elements[el.id]=el;}}};
  const context=vm.createContext({
    document:{getElementById:(id:string)=>elements[id],querySelector:()=>button,createElement:()=>({id:'',className:'',innerHTML:'',textContent:'',attributes:{} as Record<string,string>,children:[] as any[],appendChild(child:any){this.children.push(child);},setAttribute(key:string,value:string){this.attributes[key]=value;}})},
    API:{req:(_url:string,_method:string,payload:any)=>{requestPayload=payload;return pending;}},practiceUi:(key:string)=>key==='loading'?'Generating explanation…':key,
    explanationMatchesCurrentLanguage:()=>true,cleanLearnerExplanation:(value:string)=>value,
    speakButton:()=>'',learnerExplanationHtml:(value:string)=>value,engineFeedbackMarkup:()=>'',aiSourceLabel:(source:string)=>source,aiLoadingMarkup:(label:string)=>`<span class="loading-spinner"></span>${label}`,aiWaitLabel:()=>"Generating explanation…",getLang:()=>"en",toast(){},
  });
  vm.runInContext("let currentProblem={id:'p1',solution:'e4'}, explainInProgress=false, lastPracticeAnswer='a1a2', practiceSolved=false, practiceAttempt=1, explanationAttempt=-1, explanationRequestId=0;",context);
  const start=appSource.indexOf('async function explainAnswer()'),end=appSource.indexOf('// ── AI Battle ──',start);
  expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);
  vm.runInContext(appSource.slice(start,end),context);
  const request=vm.runInContext('explainAnswer()',context) as Promise<void>;
  expect(button.disabled).toBe(true);
  expect(button.attributes['aria-busy']).toBe('true');
  expect(elements.explanationFeedback.innerHTML).toContain('loading-spinner');
  expect(elements.explanationFeedback.innerHTML).toContain('Generating explanation…');
  expect(requestPayload.answer).toBe('a1a2');
  expect(requestPayload.isCorrect).toBeUndefined();
  resolveRequest({explanation:'A clear explanation.'});
  await request;
  expect(elements.explanationFeedback.className).toBe('explanation-feedback explanation-success');
  expect(elements.explanationFeedback.innerHTML).toContain('A clear explanation.');
  expect(button.disabled).toBe(false);
  expect(button.attributes['aria-busy']).toBeUndefined();
});
