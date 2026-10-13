/* Home companion controls. Audio stays in the host so a click is a real playback gesture. */
(() => {
  if (window.__priestessHomeInstalled) return;
  window.__priestessHomeInstalled = true;
  const rootURL = new URL('./', document.currentScript?.src || location.href);
  const visibleKey = 'priestess-chibi-visible', settingsKey = 'priestess-chibi-settings-v3';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = {playing:!reduced.matches, elastic:true, period:2.7, strength:1.15,
    more:false, count:12, size:1, speed:1, motion:'bounce', edges:true, collide:false,
    restitution:.94, volume:.45};
  let config = {...defaults}, holder, frame, swarm, frameObserver, swarmObserver, audio;
  let musicOn = false, musicRequest = 0;
  const clamp = (v, lo, hi, fallback) => Number.isFinite(Number(v)) ? Math.max(lo,Math.min(hi,Number(v))) : fallback;
  function sanitize(value) {
    if (!value || typeof value !== 'object') return;
    for (const k of ['playing','elastic','more','edges','collide']) if (typeof value[k]==='boolean') config[k]=value[k];
    for (const [k,lo,hi] of [['period',.8,12],['strength',.3,1.8],['count',2,36],['size',.5,1.8],['speed',.2,3],['restitution',.5,1],['volume',0,1]]) config[k]=clamp(value[k],lo,hi,config[k]);
    config.count=Math.round(config.count);
    if (['bounce','drift','still'].includes(value.motion)) config.motion=value.motion;
  }
  try {sanitize(JSON.parse(localStorage.getItem(settingsKey)));} catch { /* Optional preferences. */ }
  if (reduced.matches) {config.playing=false; config.more=false;}
  const $ = id => holder?.querySelector(`#prts-${id}`);
  const isHome = () => location.pathname==='/' || location.pathname==='/index.html';
  function persist() {try {localStorage.setItem(settingsKey,JSON.stringify(config));} catch { /* Optional. */ }}
  function send(target, data) {target?.contentWindow?.postMessage(data,location.origin);}
  function sendConfig() {
    send(frame,{type:'priestess-config',config}); send(swarm,{type:'priestess-config',config});
  }
  function ui() {
    if (!holder) return;
    for (const k of ['playing','elastic','more','edges','collide']) $(k).checked=config[k];
    for (const k of ['period','strength','count','size','speed','restitution','volume']) $(k).value=String(config[k]);
    $('period-value').value=`${config.period.toFixed(1)} 秒 / 圈`;
    $('strength-value').value=`${config.strength.toFixed(2)} 倍`;
    $('count-value').value=`${config.count} 只`;
    $('size-value').value=`${config.size.toFixed(1)} 倍`;
    $('speed-value').value=`${config.speed.toFixed(1)} 倍`;
    $('restitution-value').value=`${Math.round(config.restitution*100)}%`;
    $('volume-value').value=`${Math.round(config.volume*100)}%`;
    $('motion').value=config.motion;
    $('more-options').hidden=!config.more;
    $('music').textContent=musicOn ? '♫ 音乐开' : '♫ 音乐关';
    $('music').setAttribute('aria-pressed',String(musicOn));
    holder.dataset.music=String(musicOn); holder.dataset.more=String(config.more);
  }
  function setConfig(values) {sanitize(values); persist(); ui(); syncSwarm(); sendConfig();}
  function setPanel(open) {
    $('panel').hidden=!open; $('settings').setAttribute('aria-expanded',String(open));
    $('settings').classList.toggle('active',open);
  }
  function stopMusic() {
    const wasOn=musicOn;
    musicRequest++; musicOn=false; audio?.pause(); ui();
    if (wasOn && $('notice')) $('notice').textContent='音乐已关闭，小普继续按当前设置运动。';
  }
  async function toggleMusic() {
    if (musicOn || audio && !audio.paused) {stopMusic(); return;}
    if (!audio) {
      audio=document.createElement('audio'); audio.id='priestess-chibi-audio';
      audio.src=new URL('assets/friends-wine.m4a',rootURL).href;
      audio.preload='none'; audio.loop=true; holder.append(audio);
      audio.addEventListener('error',()=>{stopMusic(); if ($('notice')) $('notice').textContent='音乐暂时无法播放，可以关闭后重试。';});
    }
    audio.volume=config.volume;
    const request=++musicRequest;
    // Start directly inside the click handler before yielding, avoiding autoplay-policy surprises.
    const started=audio.play();
    musicOn=true; ui();
    setConfig({playing:true,elastic:true,motion:config.motion==='drift' ? 'bounce' : config.motion});
    if ($('notice')) $('notice').textContent='音乐开启，小普开始转圈和 Q弹。';
    try {await started;} catch {
      if (request!==musicRequest) return;
      stopMusic(); if ($('notice')) $('notice').textContent='浏览器没有播放音乐，请再点一次音乐开关。';
    }
  }
  function removeFrame() {frameObserver?.disconnect(); frameObserver=null; frame?.remove(); frame=null;}
  function showFrame() {
    if (frame || !holder) return;
    frame=document.createElement('iframe'); frame.title='普瑞赛斯坐姿小手办';
    frame.src=new URL('index.html?embed&v=003',rootURL).href; frame.referrerPolicy='same-origin';
    holder.prepend(frame);
    const visibility=()=>{
      if (!frame) return;
      const r=holder.getBoundingClientRect();
      send(frame,{type:'priestess-visibility',visible:!document.hidden && r.bottom>0 && r.top<innerHeight});
    };
    frame.addEventListener('load',()=>{sendConfig(); visibility();});
    frameObserver=new IntersectionObserver(visibility); frameObserver.observe(holder);
  }
  function removeSwarm() {swarmObserver?.disconnect(); swarmObserver=null; swarm?.remove(); swarm=null;}
  function syncSwarm() {
    const header=document.getElementById('page-header');
    if (!isHome() || !config.more || !header) {removeSwarm(); return;}
    if (swarm?.isConnected) return;
    removeSwarm(); swarm=document.createElement('iframe'); swarm.id='priestess-chibi-swarm';
    swarm.title='太空中的小普群'; swarm.src=new URL('swarm.html?v=003',rootURL).href;
    swarm.referrerPolicy='same-origin'; swarm.tabIndex=-1; header.append(swarm);
    const visibility=()=>{
      if (!swarm) return;
      const r=header.getBoundingClientRect();
      send(swarm,{type:'priestess-visibility',visible:!document.hidden && r.bottom>0 && r.top<innerHeight});
    };
    swarm.addEventListener('load',()=>{sendConfig(); visibility();});
    swarmObserver=new IntersectionObserver(visibility); swarmObserver.observe(header);
  }
  function sync() {
    if (!isHome()) {
      stopMusic(); removeFrame(); removeSwarm(); holder?.remove(); holder=null; audio=null; return;
    }
    if (holder?.isConnected) {syncSwarm(); return;}
    removeFrame(); removeSwarm();
    holder=document.createElement('aside'); holder.id='priestess-chibi-home';
    holder.setAttribute('aria-label','首页普瑞赛斯小手办');
    holder.innerHTML=`
      <div class="prts-toolbar">
        <button id="prts-visible" type="button" aria-label="收起小普手办" aria-expanded="true">小普 · 收起</button>
        <button id="prts-music" type="button" aria-label="背景音乐开关" aria-pressed="false">♫ 音乐关</button>
        <button id="prts-settings" type="button" aria-label="小普设置" aria-expanded="false" aria-controls="prts-panel">⚙ 设置</button>
      </div>
      <section id="prts-panel" class="prts-panel" aria-label="小普动画设置" hidden>
        <header class="prts-panel-title"><div><small>LITTLE PRIESTESS</small><strong>小普控制室</strong></div><button id="prts-close" type="button" aria-label="关闭小普设置">×</button></header>
        <div class="prts-section">
          <label class="prts-switch"><span>自动旋转</span><input id="prts-playing" type="checkbox"></label>
          <label class="prts-slider"><span>旋转速度 <output id="prts-period-value"></output></span><input id="prts-period" type="range" min="0.8" max="12" step="0.1" aria-label="旋转一圈秒数"><small>秒数越小，转得越快</small></label>
          <label class="prts-switch"><span>Q弹形变</span><input id="prts-elastic" type="checkbox"></label>
          <label class="prts-slider"><span>Q弹强度 <output id="prts-strength-value"></output></span><input id="prts-strength" type="range" min="0.3" max="1.8" step="0.05" aria-label="Q弹强度"></label>
          <label class="prts-slider"><span>音乐音量 <output id="prts-volume-value"></output></span><input id="prts-volume" type="range" min="0" max="1" step="0.05" aria-label="音乐音量"></label>
        </div>
        <label class="prts-switch prts-more"><span>我们需要更多小普<small>让小普飞进头图的星海</small></span><input id="prts-more" type="checkbox"></label>
        <details id="prts-more-options" class="prts-more-options" open hidden>
          <summary>太空飞行设置</summary>
          <label class="prts-slider"><span>普瑞赛斯数量 <output id="prts-count-value"></output></span><input id="prts-count" type="range" min="2" max="36" step="1" aria-label="普瑞赛斯数量"></label>
          <label class="prts-slider"><span>整体大小 <output id="prts-size-value"></output></span><input id="prts-size" type="range" min="0.5" max="1.8" step="0.1" aria-label="小普整体大小"></label>
          <label class="prts-slider"><span>飞行速度 <output id="prts-speed-value"></output></span><input id="prts-speed" type="range" min="0.2" max="3" step="0.1" aria-label="小普飞行速度"></label>
          <label class="prts-select"><span>弹跳状态</span><select id="prts-motion" aria-label="小普弹跳状态"><option value="bounce">漂浮 + Q弹</option><option value="drift">仅漂浮</option><option value="still">原地 Q弹</option></select></label>
          <label class="prts-switch"><span>边框碰撞<small>关闭后穿过边缘，从另一侧返回</small></span><input id="prts-edges" type="checkbox"></label>
          <label class="prts-switch"><span>互相碰撞</span><input id="prts-collide" type="checkbox"></label>
          <label class="prts-slider"><span>碰撞回弹 <output id="prts-restitution-value"></output></span><input id="prts-restitution" type="range" min="0.5" max="1" step="0.01" aria-label="碰撞回弹"></label>
        </details>
        <footer><button id="prts-reset" type="button">恢复默认</button><span id="prts-notice" role="status" aria-live="polite">音乐默认关闭，点击后才会播放。</span></footer>
      </section>`;
    document.body.append(holder);
    const updateVisibility=visible=>{
      $('visible').textContent=visible ? '小普 · 收起' : '小普 · 展开';
      $('visible').setAttribute('aria-label',visible ? '收起小普手办' : '展开小普手办');
      $('visible').setAttribute('aria-expanded',String(visible));
      if (visible) showFrame(); else removeFrame();
    };
    $('visible').addEventListener('click',()=>{
      const visible=!frame; try {localStorage.setItem(visibleKey,String(visible));} catch {}
      updateVisibility(visible);
    });
    $('settings').addEventListener('click',()=>setPanel($('panel').hidden));
    $('close').addEventListener('click',()=>{setPanel(false); $('settings').focus();});
    $('music').addEventListener('click',toggleMusic);
    for (const k of ['playing','elastic','more','edges','collide']) $(k).addEventListener('change',e=>setConfig({[k]:e.target.checked}));
    for (const k of ['period','strength','count','size','speed','restitution','volume']) $(k).addEventListener('input',e=>{
      setConfig({[k]:Number(e.target.value)}); if (audio) audio.volume=config.volume;
    });
    $('motion').addEventListener('change',e=>setConfig({motion:e.target.value}));
    $('reset').addEventListener('click',()=>{stopMusic(); config={...defaults,playing:!reduced.matches}; persist(); ui(); syncSwarm(); sendConfig(); $('notice').textContent='已恢复默认设置，音乐保持关闭。';});
    let visible=true; try {visible=localStorage.getItem(visibleKey)!=='false';} catch {}
    ui(); updateVisibility(visible); syncSwarm();
  }
  const stylesheet=document.createElement('link'); stylesheet.rel='stylesheet';
  stylesheet.href=new URL('home-widget.css?v=003',rootURL).href; document.head.append(stylesheet);
  window.addEventListener('message',e=>{
    if (e.origin!==location.origin) return;
    if (e.source===frame?.contentWindow) {
      if (e.data?.type==='priestess-viewer-ready') sendConfig();
      if (e.data?.type==='priestess-viewer-state') {
        sanitize({playing:e.data.playing,elastic:e.data.elastic,period:e.data.period,strength:e.data.strength});
        persist(); ui(); send(swarm,{type:'priestess-config',config});
      }
    }
    if (e.source===swarm?.contentWindow) {
      if (e.data?.type==='priestess-swarm-ready') sendConfig();
      if (e.data?.type==='priestess-swarm-error' && $('notice')) $('notice').textContent='小普群暂时无法显示，关闭后重新开启可重试。';
    }
  });
  document.addEventListener('click',e=>{if (holder && !holder.contains(e.target)) setPanel(false);});
  document.addEventListener('keydown',e=>{if (e.key==='Escape' && holder && !$('panel').hidden) {setPanel(false); $('settings').focus();}});
  document.addEventListener('visibilitychange',()=>{
    send(frame,{type:'priestess-visibility',visible:!document.hidden});
    const r=document.getElementById('page-header')?.getBoundingClientRect();
    send(swarm,{type:'priestess-visibility',visible:!document.hidden && r?.bottom>0});
    if (document.hidden) stopMusic();
  });
  reduced.addEventListener('change',e=>{if (e.matches) {stopMusic(); setConfig({playing:false});}});
  window.addEventListener('pagehide',()=>stopMusic());
  document.addEventListener('pjax:complete',sync); document.addEventListener('pjax:success',sync);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',sync,{once:true}); else sync();
})();
