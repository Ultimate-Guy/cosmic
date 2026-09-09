const videoInput=document.getElementById('videoUrlInput');
const shortInput=document.getElementById('shortUrlInput');
const videoList=document.getElementById('videoList');
const videoEmpty=document.getElementById('videoEmpty');
const shortPlayer=document.getElementById('shortPlayer');
const shortCounter=document.getElementById('shortCounter');
const shortDots=document.getElementById('shortDots');
const videoMessage=document.getElementById('videoMessage');
const shortMessage=document.getElementById('shortMessage');
let shorts=[];let shortIndex=0;

function extractYouTubeId(value){
  try{
    const raw=value.trim(); if(!raw)return null;
    const u=new URL(raw);
    if(u.hostname==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||null;
    if(u.hostname.includes('youtube.com')){
      if(u.pathname==='/watch')return u.searchParams.get('v');
      const parts=u.pathname.split('/').filter(Boolean);
      if(parts[0]==='shorts'||parts[0]==='embed')return parts[1]||null;
    }
  }catch(e){}
  const match=value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/i);
  return match?match[1]:null;
}
function validId(id){return !!id&&/^[\w-]{11}$/.test(id)}
function embedUrl(id){return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`}
function setMessage(el,text,error=false){el.textContent=text;el.style.color=error?'#ff6b6b':''}
function addVideo(){
  const id=extractYouTubeId(videoInput.value);
  if(!validId(id)){setMessage(videoMessage,'Enter a valid YouTube video URL.',true);return}
  setMessage(videoMessage,'');
  const unit=document.createElement('article');unit.className='video-unit';unit.dataset.videoId=id;
  const frame=document.createElement('div');frame.className='video-frame';
  const iframe=document.createElement('iframe');iframe.src=embedUrl(id);iframe.title='YouTube video';iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.loading='lazy';frame.appendChild(iframe);
  const tools=document.createElement('div');tools.className='video-tools';
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>{unit.remove();updateVideoEmpty()};
  const open=document.createElement('button');open.type='button';open.textContent='Open YouTube';open.onclick=()=>window.open(`https://www.youtube.com/watch?v=${id}`,'_blank','noopener');
  tools.append(open,close);unit.append(frame,tools);videoList.prepend(unit);videoEmpty.style.display='none';videoInput.value='';saveVideos();
}
function updateVideoEmpty(){videoEmpty.style.display=videoList.children.length?'none':'flex';saveVideos()}
function saveVideos(){localStorage.setItem('cosmicYoutubeVideos',JSON.stringify([...videoList.querySelectorAll('.video-unit')].map(x=>x.dataset.videoId)))}
function loadVideos(){try{const ids=JSON.parse(localStorage.getItem('cosmicYoutubeVideos')||'[]');ids.reverse().forEach(id=>{if(validId(id)){videoInput.value=`https://www.youtube.com/watch?v=${id}`;addVideo()}});videoInput.value=''}catch(e){}}
function clearVideos(){videoList.innerHTML='';videoEmpty.style.display='flex';localStorage.removeItem('cosmicYoutubeVideos')}

function addShort(){
  const id=extractYouTubeId(shortInput.value);
  if(!validId(id)){setMessage(shortMessage,'Enter a valid YouTube Shorts URL.',true);return}
  if(!shorts.includes(id)){shorts.push(id)}
  shortIndex=shorts.length-1;shortInput.value='';setMessage(shortMessage,'');renderShort();saveShorts();
}
function renderShort(){
  if(!shorts.length){shortPlayer.className='short-player empty-short';shortPlayer.innerHTML='<div class="empty-short-content"><i class="fas fa-mobile-screen-button"></i><strong>No Shorts loaded</strong><span>Add a Shorts URL above.</span></div>';shortCounter.textContent='0 Shorts';shortDots.innerHTML='';return}
  shortIndex=(shortIndex+shorts.length)%shorts.length;
  shortPlayer.className='short-player';shortPlayer.innerHTML='';
  const iframe=document.createElement('iframe');iframe.src=embedUrl(shorts[shortIndex]);iframe.title=`YouTube Short ${shortIndex+1}`;iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;shortPlayer.appendChild(iframe);
  shortCounter.textContent=`Short ${shortIndex+1} of ${shorts.length}`;shortDots.innerHTML='';shorts.forEach((_,i)=>{const b=document.createElement('button');b.className='short-dot'+(i===shortIndex?' active':'');b.type='button';b.title=`Short ${i+1}`;b.onclick=()=>{shortIndex=i;renderShort();saveShorts()};shortDots.appendChild(b)});
}
function nextShort(){if(shorts.length){shortIndex=(shortIndex+1)%shorts.length;renderShort();saveShorts()}}
function prevShort(){if(shorts.length){shortIndex=(shortIndex-1+shorts.length)%shorts.length;renderShort();saveShorts()}}
function saveShorts(){localStorage.setItem('cosmicYoutubeShorts',JSON.stringify(shorts))}
function loadShorts(){try{const saved=JSON.parse(localStorage.getItem('cosmicYoutubeShorts')||'[]');if(Array.isArray(saved))shorts=saved.filter(validId);renderShort()}catch(e){renderShort()}}
function clearShorts(){shorts=[];shortIndex=0;localStorage.removeItem('cosmicYoutubeShorts');renderShort()}

function setMode(shortMode){document.getElementById('watchPanel').classList.toggle('hidden',shortMode);document.getElementById('shortsPanel').classList.toggle('hidden',!shortMode);document.getElementById('watchModeBtn').classList.toggle('active',!shortMode);document.getElementById('shortsModeBtn').classList.toggle('active',shortMode)}
document.getElementById('loadVideoBtn').onclick=addVideo;document.getElementById('addShortBtn').onclick=addShort;document.getElementById('clearVideosBtn').onclick=clearVideos;document.getElementById('clearShortsBtn').onclick=clearShorts;document.getElementById('nextShortBtn').onclick=nextShort;document.getElementById('prevShortBtn').onclick=prevShort;document.getElementById('watchModeBtn').onclick=()=>setMode(false);document.getElementById('shortsModeBtn').onclick=()=>setMode(true);
videoInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addVideo()}});shortInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addShort()}});document.addEventListener('keydown',e=>{if(document.getElementById('shortsPanel').classList.contains('hidden'))return;if(e.key==='ArrowDown')nextShort();if(e.key==='ArrowUp')prevShort()});
loadVideos();loadShorts();