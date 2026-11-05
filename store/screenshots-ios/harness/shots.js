const {chromium}=require('playwright');
const SIZES={phone:{w:440,h:956,dsf:3,tag:'iphone-6.9-1320x2868'},tablet:{w:1032,h:1376,dsf:2,tag:'ipad-13-2064x2752'}};
const OUT=process.argv[3]||'/tmp/claude-0/out/draft';
require('fs').mkdirSync(OUT,{recursive:true});
const only=process.argv[2]||'phone';
const BASE='http://localhost:8099';
async function open(b,size,query){
  const ctx=await b.newContext({viewport:{width:size.w,height:size.h},deviceScaleFactor:size.dsf});
  const pg=await ctx.newPage();
  pg.on('pageerror',e=>console.log('PAGEERR',e.message.slice(0,160)));
  await pg.goto(BASE+query); await pg.waitForTimeout(1800);
  await pg.evaluate(()=>{const t=[...document.querySelectorAll('div')].find(d=>d.textContent==='Preview in your browser'&&d.children.length===0); if(t&&t.parentElement) t.parentElement.remove();});
  return pg;
}
const clickText=async(pg,t,o={})=>{await pg.getByText(t,{exact:o.exact??false}).filter({visible:true}).first().click(); await pg.waitForTimeout(900);};
const scrollTo=async(pg,text,pad=24)=>{await pg.getByText(text,{exact:false}).filter({visible:true}).first().evaluate((el,pad)=>{
  el.scrollIntoView({block:'start'}); let p=el.parentElement; while(p){ if(p.scrollHeight>p.clientHeight+5 && getComputedStyle(p).overflowY!=='visible' && getComputedStyle(p).overflowY!=='hidden'){p.scrollTop-=pad;break;} p=p.parentElement;}
 },pad); await pg.waitForTimeout(500);};
const BAD=[/Phil/i,/Preview in your browser/,/SprigList/i,/Hoya and Orchid Commons/,/Commons sales card/,/\u2014|\u2013|--/];
const snap=async(pg,name,size)=>{const t=await pg.evaluate(()=>document.body.innerText); const hits=BAD.filter(r=>r.test(t)).map(String); const origin=/Made with Skrybix by Gathering Moss/.test(t); console.log('CHECK',name,size.tag,hits.length?'BAD '+hits.join(' '):'clean', origin?'origin-line':''); return pg.screenshot({path:`${OUT}/${name}-${size.tag}.png`});};
(async()=>{
  const b=await chromium.launch(); const size=SIZES[only];
  const sample=async(q)=>{const pg=await open(b,size,q); await clickText(pg,'Look around a sample showcase first'); return pg;};
  const showcase=async(pg)=>{await clickText(pg,'Grower Showcase, 4 lots'); await pg.waitForTimeout(600);};
  const bottom=async(pg)=>{await pg.evaluate(()=>{const els=[...document.querySelectorAll('*')].filter(p=>p.scrollHeight>p.clientHeight+5&&['auto','scroll'].includes(getComputedStyle(p).overflowY)); els.forEach(e=>e.scrollTop=e.scrollHeight);}); await pg.waitForTimeout(500);};
  // 1 sale builder
  let pg=await sample('/'); await clickText(pg,'New showcase',{exact:true});
  for (const t of ['Hoya NOID','Dischidia ruscifolia','Hoya obovata','Hoya linearis']) { await pg.getByText(t).first().click(); await pg.waitForTimeout(200); }
  await clickText(pg,'Build a showcase with 4 plants'); await pg.waitForTimeout(700); await snap(pg,'01-sale-builder',size); await pg.context().close();
  // 2 announcement
  pg=await sample('/'); await showcase(pg); await snap(pg,'02-announcement-card',size); await pg.context().close();
  // 3 stamped photos
  pg=await sample('/?data=photos'); await snap(pg,'03a-plant-list',size); await clickText(pg,'Hoya carnosa Krimson Queen'); await pg.waitForTimeout(2000); await snap(pg,'03b-plant-card-top',size);
  await scrollTo(pg,'Photo 2',size.h-80-Math.round(Math.min(size.w-32,688)*4/3)-115); await snap(pg,'03-plant-stamped-photos',size); await pg.context().close();
  // 4 claims in arrival order: numbered, winner and alternates marked
  pg=await sample('/?data=arrival'); await showcase(pg); await clickText(pg,'Claims',{exact:true}); await pg.waitForTimeout(800); await bottom(pg); await snap(pg,'04-claim-tracker-arrival-order',size); await pg.context().close();
  // 5, 6 pro
  pg=await sample('/?shot=pro&data=rundown'); await showcase(pg); await clickText(pg,'Claims',{exact:true}); await clickText(pg,'After the showcase',{exact:true}); await pg.waitForTimeout(800);
  await snap(pg,'05a-rundown-top',size);
  await pg.getByText('Jada Winslow').filter({visible:true}).first().click(); await pg.waitForTimeout(500);
  await scrollTo(pg,'Waiting on payment',16); await snap(pg,'05-pro-rundown',size);
  await scrollTo(pg,'Priya Lund',16); await snap(pg,'05c-rundown-priya',size);
  await pg.evaluate(()=>window.scrollTo(0,0));
  await scrollTo(pg,'Buyer checkout',24);
  await clickText(pg,'Packing',{exact:true}); await pg.waitForTimeout(800); await snap(pg,'06-packing-view',size);
  await pg.context().close();
  // 7 paywall
  pg=await open(b,size,'/paywall?shot=paywall'); await pg.waitForTimeout(800); await snap(pg,'07a-paywall-top',size);
  await bottom(pg); await snap(pg,'07-paywall',size);
  await b.close();
})().catch(e=>{console.log('FAIL',e.message.slice(0,400));process.exit(1)});
