// Cognitive Dashboard logic - reuses lightweight analysis subset from popup.js
// Assumes identical algorithms to maintain consistency.

(function(){
  const STATUS = document.getElementById('status');
  const exportBtn = document.getElementById('export-btn');

  function logStatus(msg){ STATUS.textContent = msg; }

  function calculateComplexity(domain, title='') {
    const base = {'github.com':0.7,'stackoverflow.com':0.8,'arxiv.org':0.9,'wikipedia.org':0.6,'reddit.com':0.4,'youtube.com':0.3};
    let score = base[domain] ?? 0.5;
    const lower = title.toLowerCase();
    ['documentation','api','tutorial','research'].forEach(k=>{ if(lower.includes(k)) score += 0.1; });
    ['meme','funny','social'].forEach(k=>{ if(lower.includes(k)) score -= 0.1; });
    return Math.min(1, Math.max(0, score));
  }

  function jaccard(a,b){
    const ta=(a||'').toLowerCase().match(/\b\w+\b/g)||[];
    const tb=(b||'').toLowerCase().match(/\b\w+\b/g)||[];
    const sa=new Set(ta), sb=new Set(tb);
    const inter=[...sa].filter(x=>sb.has(x));
    const uni=new Set([...sa,...sb]);
    return uni.size? inter.length/uni.size:0;
  }

  async function getHistory(){
    return new Promise((resolve,reject)=>{
      if(!chrome?.history) return reject(new Error('History API unavailable'));
      chrome.history.search({text:'', maxResults:2000, startTime: Date.now()-7*24*60*60*1000}, results=>{
        if(chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message)); else resolve(results||[]);
      });
    });
  }

  function extractDomain(url){ try { return new URL(url).hostname.replace('www.',''); } catch { return url; } }

  function analyze(history){
    const events = history.map(h=>({domain:extractDomain(h.url), title:h.title||'', time:h.lastVisitTime})).sort((a,b)=>a.time-b.time);
    // Temporal patterns
    const hourlyActivity = new Array(24).fill(0);
    let sessions=[]; let last=null; let start=null; const GAP=5*60*1000;
    events.forEach(e=>{ const h=new Date(e.time).getHours(); hourlyActivity[h]++; if(last===null|| e.time-last>GAP){ if(start!==null) sessions.push(last-start); start=e.time; } last=e.time; });
    if(start!==null&&last!==null) sessions.push(last-start);
    const avgSessionMinutes = sessions.length? sessions.reduce((a,b)=>a+b,0)/sessions.length/60000:0;
    const sortedCounts=[...hourlyActivity].sort((a,b)=>a-b); const threshold=sortedCounts[Math.floor(0.75*sortedCounts.length)]||0; const peakHours=hourlyActivity.map((c,i)=>({c,i})).filter(o=>o.c>=threshold&&o.c>0).map(o=>o.i);
    // Focus sessions
    let focus=[]; let cur=[];
    events.forEach(e=>{ if(!cur.length){ cur.push(e); return;} const prev=cur[cur.length-1]; const sim=jaccard(prev.title+prev.domain, e.title+e.domain); if(e.time-prev.time<=GAP && (prev.domain===e.domain || sim>0.4)){ cur.push(e);} else { focus.push(cur); cur=[e]; } }); if(cur.length) focus.push(cur);
    const focusSessions = focus.map(evts=>{ const dur=(evts[evts.length-1].time-evts[0].time)/60000; const avgC=evts.reduce((s,v)=>s+calculateComplexity(v.domain,v.title),0)/evts.length; return { durationMinutes:+dur.toFixed(2), pages: evts.length, avgComplexity:+avgC.toFixed(2), events:evts }; });
    // Complexity by hour
    const complexityByHour=new Array(24).fill().map(()=>({total:0,count:0}));
    focusSessions.forEach(s=> s.events.forEach(ev=>{ const h=new Date(ev.time).getHours(); const c=calculateComplexity(ev.domain, ev.title); complexityByHour[h].total+=c; complexityByHour[h].count++; }));
    const hourlyComplexity = complexityByHour.map(o=> o.count? o.total/o.count:0);
    // Chains
    let chains=[]; let chain=[];
    events.forEach(e=>{ if(!chain.length){ chain.push(e); return;} const prev=chain[chain.length-1]; const sim=jaccard(prev.title+prev.domain, e.title+e.domain); if(e.time-prev.time<=GAP && sim>0.3){ chain.push(e);} else { if(chain.length>1) chains.push(chain); chain=[e]; } }); if(chain.length>1) chains.push(chain);
    const chainSummaries = chains.map(c=>{ const dur=(c[c.length-1].time-c[0].time)/60000||1; const avgC=c.reduce((s,v)=>s+calculateComplexity(v.domain,v.title),0)/c.length; return { length:c.length, durationMinutes:+dur.toFixed(2), avgComplexity:+avgC.toFixed(2), scentStrength:+(c.length/dur).toFixed(2)}; });
    // Graph metrics (entropy)
    const domainCounts={}; events.forEach(e=>{ domainCounts[e.domain]=(domainCounts[e.domain]||0)+1; }); const total=events.length||1; const diversity=-Object.values(domainCounts).reduce((s,c)=>{ const p=c/total; return s+(p? p*Math.log2(p):0);},0);
    return { hourlyComplexity, peakHours, avgSessionMinutes:+avgSessionMinutes.toFixed(2), focusSessions, chainSummaries, diversity:+diversity.toFixed(3) };
  }

  function renderHeatmap(values){
    const container=document.getElementById('complexity-heatmap'); container.innerHTML='';
    const svg=d3.select(container).append('svg').attr('width',12*24).attr('height',70);
    const color=d3.scaleSequential(d3.interpolateRdYlBu).domain([1,0]);
    svg.selectAll('rect').data(values).enter().append('rect')
      .attr('x',(d,i)=>i*12).attr('y',10).attr('width',12).attr('height',30)
      .attr('fill',d=>color(d)).attr('stroke',d=> d>0.7? '#000':'#fff')
      .append('title').text((d,i)=>`Hour ${i}: ${(d*100).toFixed(0)}% complexity`);
    svg.selectAll('text.hour').data([0,6,12,18,23]).enter().append('text').attr('x',d=>d*12+6).attr('y',55).attr('text-anchor','middle').attr('font-size',9).text(d=>d);
  }

  function renderFocusTimeline(sessions){
    const container=document.getElementById('focus-timeline'); container.innerHTML='';
    const w=container.clientWidth||400; const barH=10; const h=sessions.length*(barH+4)+30;
    const svg=d3.select(container).append('svg').attr('width',w).attr('height',h);
    const maxDur=d3.max(sessions,s=>s.durationMinutes)||1; const x=d3.scaleLinear().domain([0,maxDur]).range([60,w-10]);
    svg.selectAll('rect.session').data(sessions).enter().append('rect').attr('class','session').attr('x',60).attr('y',(d,i)=>i*(barH+4)+10).attr('height',barH).attr('width',d=>x(d.durationMinutes)-60).attr('fill','#4285f4').attr('opacity',d=>0.4+0.6*d.avgComplexity).append('title').text(d=>`Duration ${d.durationMinutes}m complexity ${d.avgComplexity}`);
    svg.selectAll('text.label').data(sessions).enter().append('text').attr('x',0).attr('y',(d,i)=>i*(barH+4)+18).attr('font-size',9).text((d,i)=>'S'+(i+1));
    svg.selectAll('text.tick').data(x.ticks(4)).enter().append('text').attr('x',d=>x(d)).attr('y',h-6).attr('font-size',9).attr('text-anchor','middle').text(d=>d+'m');
  }

  function renderChains(chains){
    const tbody=document.querySelector('#chains-table tbody'); tbody.innerHTML='';
    chains.slice(0,50).forEach((c,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${i+1}</td><td>${c.length}</td><td>${c.durationMinutes}</td><td>${c.avgComplexity}</td><td>${c.scentStrength}</td>`; tbody.appendChild(tr); });
  }

  function renderInsights(data){
    const list=document.getElementById('insights-list'); list.innerHTML='';
    const averageFocus = data.focusSessions.length? (data.focusSessions.reduce((a,b)=>a+b.durationMinutes,0)/data.focusSessions.length):0;
    const topicSwitchRate = 0; // Not recomputed here; could be passed via storage
    const peakComplexityHours = data.hourlyComplexity.map((v,i)=>({v,i})).filter(o=>o.v>0.7).map(o=>o.i);
    const recs=[];
    if(averageFocus<5) recs.push('Short focus periods. Minimize interruptions.');
    if(peakComplexityHours.length===0) recs.push('No high-complexity periods detected—consider blocking time for deep work.');
    list.appendChild(li(`Peak Complexity Hours: ${peakComplexityHours.join(', ')||'None'}`));
    list.appendChild(li(`Avg Focus Duration: ${averageFocus.toFixed(2)}m`));
    list.appendChild(li(`Information Diversity (entropy): ${data.diversity}`));
    recs.length && list.appendChild(li('Recommendations:'));
    recs.forEach(r=> list.appendChild(li('• '+r)));
  }
  function li(text){ const el=document.createElement('li'); el.textContent=text; return el; }

  function wireExport(payload){
    exportBtn.addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`cognitive-dashboard-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });
  }

  async function run(){
    try {
      logStatus('Loading history...');
      const history = await getHistory();
      logStatus(`Processing ${history.length} items...`);
      const analysis = analyze(history);
      renderHeatmap(analysis.hourlyComplexity);
      renderFocusTimeline(analysis.focusSessions.slice(-40));
      renderChains(analysis.chainSummaries);
      renderInsights(analysis);
      wireExport(analysis);
      logStatus('Done');
    } catch (e) {
      logStatus('Error: '+e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', run);
})();
