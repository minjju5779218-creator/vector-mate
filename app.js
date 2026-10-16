'use strict';
const $=id=>document.getElementById(id);
let inputImage=null,inputName='illustration',svgText='',svgUrl=null,originalUrl=null;
const settingLabels={detail:['','매우 단순','단순','균형','정밀','매우 정밀'],noise:['없음','약함','보통','강함','매우 강함']};
for(const key of ['colors','detail','noise','smooth']) $(key).addEventListener('input',()=>{$(key+'Value').textContent=key==='colors'?$('colors').value+'색':key==='smooth'?['원본 유지','약하게','보통','강하게'][+$('smooth').value]:settingLabels[key][+$(key).value];});
function showMessage(str,err=false){$('status').textContent=str;$('status').style.color=err?'#d64c59':'#696b7e'}
function setPreview(id,url){let img=$(id),ph=$(id==='originalImg'?'origPlaceholder':'svgPlaceholder');img.src=url;img.style.display='block';ph.style.display='none'}
async function loadFile(file){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){showMessage('PNG, JPG, WEBP만 지원합니다.',true);return}if(file.size>15*1024*1024){showMessage('15MB 이하 이미지를 선택해 주세요.',true);return}
try{const tmp=URL.createObjectURL(file);let img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=tmp});if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>90e6)throw Error('이미지 해상도가 너무 큽니다.');inputImage=img;inputName=file.name.replace(/\.[^.]+$/,'').replace(/[^가-힣a-zA-Z0-9_\-]/g,'_')||'illustration';if(originalUrl)URL.revokeObjectURL(originalUrl);originalUrl=tmp;setPreview('originalImg',tmp);$('filename').textContent=`${file.name} · ${img.naturalWidth} × ${img.naturalHeight}`;$('convert').disabled=false;resetResult();showMessage('준비 완료. SVG 변환하기를 눌러주세요.')}catch(e){showMessage(e.message||'이미지를 열 수 없습니다.',true)}}
function resetResult(){svgText='';$('vectorImg').style.display='none';$('svgPlaceholder').style.display='block';for(const id of ['downloadSvg','downloadPng'])$(id).disabled=true;for(const id of ['pathCount','colorCount','fileSize'])$(id).textContent='—'}
$('fileInput').addEventListener('change',e=>loadFile(e.target.files[0]));$('pickBtn').addEventListener('click',e=>{e.stopPropagation();$('fileInput').click()});$('dropZone').addEventListener('click',()=>$('fileInput').click());$('dropZone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}});for(const name of ['dragenter','dragover'])$('dropZone').addEventListener(name,e=>{e.preventDefault();$('dropZone').classList.add('drag')});for(const name of ['dragleave','drop'])$('dropZone').addEventListener(name,e=>{e.preventDefault();$('dropZone').classList.remove('drag')});$('dropZone').addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
for(const [id,klass] of [['tabBoth','both'],['tabOrig','original'],['tabSvg','vector']])$(id).onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));$(id).classList.add('active');$('previewArea').className='preview-area '+klass};
function quantize(data,w,h,k,alphaEnabled){const n=w*h,valid=[],samples=[];const stride=Math.max(1,Math.floor(n/15000));for(let i=0;i<n;i++){if(alphaEnabled&&data[i*4+3]<128)continue;valid.push(i);if(i%stride===0)samples.push([data[i*4],data[i*4+1],data[i*4+2]])}if(!samples.length)throw Error('그릴 수 있는 불투명 픽셀이 없습니다.');let centroids=[samples[0]];while(centroids.length<Math.min(k,samples.length)){let far=0,pick=samples[0];for(const v of samples){let best=Infinity;for(const c of centroids){const d=(v[0]-c[0])**2+(v[1]-c[1])**2+(v[2]-c[2])**2;if(d<best)best=d}if(best>far){far=best;pick=v}}if(far<1)break;centroids.push([...pick])}for(let it=0;it<9;it++){const sums=centroids.map(()=>[0,0,0,0]);for(const v of samples){let best=Infinity,idx=0;for(let j=0;j<centroids.length;j++){const c=centroids[j],d=(v[0]-c[0])**2+(v[1]-c[1])**2+(v[2]-c[2])**2;if(d<best){best=d;idx=j}}const s=sums[idx];s[0]+=v[0];s[1]+=v[1];s[2]+=v[2];s[3]++}centroids=centroids.map((c,j)=>sums[j][3]?sums[j].slice(0,3).map(x=>Math.round(x/sums[j][3])):c)}const ids=new Int16Array(n);ids.fill(-1);for(const i of valid){let best=Infinity,idx=0;for(let j=0;j<centroids.length;j++){const c=centroids[j],d=(data[i*4]-c[0])**2+(data[i*4+1]-c[1])**2+(data[i*4+2]-c[2])**2;if(d<best){best=d;idx=j}}ids[i]=idx}return {ids,palette:centroids.map(c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join(''))}}
// Directed boundary tracing. Only <path> primitives are written into the final SVG.
function traceColor(ids,w,h,color){const edges=new Map();function add(x1,y1,x2,y2){const a=y1*(w+1)+x1,b=y2*(w+1)+x2;let arr=edges.get(a);if(!arr){arr=[];edges.set(a,arr)}arr.push(b)}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=y*w+x;if(ids[i]!==color)continue;if(y===0||ids[i-w]!==color)add(x,y,x+1,y);if(x===w-1||ids[i+1]!==color)add(x+1,y,x+1,y+1);if(y===h-1||ids[i+w]!==color)add(x+1,y+1,x,y+1);if(x===0||ids[i-1]!==color)add(x,y+1,x,y)}const loops=[];let guard=0;while(edges.size&&guard++<w*h*3){const start=edges.keys().next().value;let at=start,pts=[],steps=0;while(steps++<w*h*5){const x=at%(w+1),y=Math.floor(at/(w+1));pts.push([x,y]);const arr=edges.get(at);if(!arr||!arr.length)break;let next=arr.pop();if(!arr.length)edges.delete(at);at=next;if(at===start){if(pts.length>=3)loops.push(pts);break}}}return loops}
function simplify(points,epsilon){if(points.length<=4)return points;let compact=[];for(let i=0;i<points.length;i++){let a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];if((b[0]-a[0])*(c[1]-b[1])===(b[1]-a[1])*(c[0]-b[0]))continue;compact.push(b)}if(compact.length<=4)return compact;const pts=compact.concat([compact[0]]),keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;let stack=[[0,pts.length-1]];while(stack.length){const [a,b]=stack.pop(),p=pts[a],q=pts[b],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;let best=0,idx=-1;for(let i=a+1;i<b;i++){let v=pts[i],t=den?Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/den)):0,dist=(v[0]-p[0]-t*dx)**2+(v[1]-p[1]-t*dy)**2;if(dist>best){best=dist;idx=i}}if(best>epsilon*epsilon&&idx>0){keep[idx]=1;stack.push([a,idx],[idx,b])}}let result=[];for(let i=0;i<pts.length-1;i++)if(keep[i])result.push(pts[i]);return result.length>=3?result:compact}
// Convert reduced outlines into short, selectively smoothed cubic Bézier segments.
// Corners remain sharp; mild turns along a curve receive tangential handles.
function curvedPath(pts, smooth){
  const n=pts.length;if(n<3)return '';
  const fmt=v=>Number(v.toFixed(2)).toString();
  const xy=p=>fmt(p[0])+' '+fmt(p[1]);
  if(!smooth)return 'M'+pts.map(xy).join('L')+'Z';
  const soft=[];
  for(let i=0;i<n;i++){
    const a=pts[(i+n-1)%n],b=pts[i],c=pts[(i+1)%n];
    let ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-b[0],vy=c[1]-b[1];
    let la=Math.hypot(ux,uy),lb=Math.hypot(vx,vy),cos=la*lb?(ux*vx+uy*vy)/(la*lb):-1;
    soft.push(cos>0.12 && la>0.3 && lb>0.3);
  }
  const ins=[],outs=[];
  for(let i=0;i<n;i++){
    const a=pts[(i+n-1)%n],b=pts[i],c=pts[(i+1)%n];
    if(!soft[i]){ins.push(b);outs.push(b);continue}
    const la=Math.hypot(b[0]-a[0],b[1]-a[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const r=Math.min(la,lb)*0.22;
    ins.push([b[0]-(b[0]-a[0])/la*r,b[1]-(b[1]-a[1])/la*r]);
    outs.push([b[0]+(c[0]-b[0])/lb*r,b[1]+(c[1]-b[1])/lb*r]);
  }
  let d='M'+xy(outs[n-1]);
  for(let j=0;j<n;j++){
    const i=j,prev=(i+n-1)%n;
    d+='L'+xy(ins[i]);
    if(soft[i])d+='Q'+xy(pts[i])+' '+xy(outs[i]);
  }
  return d+'Z';
}
function cleanLabels(ids,w,h,rounds){
  // Median-like majority filter: smooth stray pixels without changing larger masses.
  let a=ids;
  for(let iter=0;iter<rounds;iter++){
    const b=new Int16Array(a);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x,v=a[i];if(v<0)continue;
      const around=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w-1],a[i-w+1],a[i+w-1],a[i+w+1]];
      const freq=new Map();for(const c of around)if(c>=0)freq.set(c,(freq.get(c)||0)+1);
      let best=v,count=0;for(const [c,num] of freq)if(num>count){count=num;best=c}
      if(count>=5&&best!==v)b[i]=best;
    }a=b;
  }
  return a;
}
function area(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1]}return a/2}
function svgFromImage(img,options){let w=img.naturalWidth,h=img.naturalHeight,scale=Math.min(1,options.resolution/Math.max(w,h));let tw=Math.max(1,Math.round(w*scale)),th=Math.max(1,Math.round(h*scale));const cv=document.createElement('canvas');cv.width=tw;cv.height=th;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,tw,th);if(options.smooth>0)ctx.filter='blur('+[0,0.5,0.85,1.25][options.smooth]+'px)';ctx.drawImage(img,0,0,tw,th);ctx.filter='none';let data=ctx.getImageData(0,0,tw,th).data;const result=quantize(data,tw,th,options.colors,options.transparent);const ids=options.smooth?cleanLabels(result.ids,tw,th,options.smooth):result.ids,palette=result.palette;const epsilon=[0,2.6,1.85,1.3,.8,.35][options.detail],minArea=[0,3,12,30,80][options.noise];let paths=[],used=0;for(let c=0;c<palette.length;c++){let loops=traceColor(ids,tw,th,c),d=[];for(let loop of loops){if(Math.abs(area(loop))<minArea)continue;loop=simplify(loop,epsilon);if(loop.length<3)continue;d.push(curvedPath(loop,options.smooth>0))}if(d.length){used++;paths.push(`<path fill="${palette[c]}" fill-rule="evenodd" d="${d.join('')}"/>`)}}if(!paths.length)throw Error('변환된 도형이 없습니다. 작은 점 제거를 줄여보세요.');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${tw} ${th}">\n${paths.join('\n')}\n</svg>`;return{svg,paths:paths.length,colors:used}}
$('convert').onclick=async()=>{if(!inputImage)return;$('convert').disabled=true;showMessage('픽셀 색상과 외곽선을 분석하고 있습니다…');await new Promise(r=>setTimeout(r,35));try{const result=svgFromImage(inputImage,{colors:+$('colors').value,detail:+$('detail').value,noise:+$('noise').value,resolution:+$('resolution').value,transparent:$('transparent').checked,smooth:+$('smooth').value});svgText=result.svg;const blob=new Blob([svgText],{type:'image/svg+xml;charset=utf-8'});if(svgUrl)URL.revokeObjectURL(svgUrl);svgUrl=URL.createObjectURL(blob);setPreview('vectorImg',svgUrl);$('pathCount').textContent=result.paths.toLocaleString();$('colorCount').textContent=result.colors+'색';$('fileSize').textContent=(blob.size/1024).toFixed(1)+' KB';$('downloadSvg').disabled=false;$('downloadPng').disabled=false;showMessage('변환 완료! SVG 파일을 다운로드할 수 있습니다.')}catch(e){showMessage('변환 실패: '+e.message,true)}finally{$('convert').disabled=false}};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('downloadSvg').onclick=()=>{if(svgText)download(new Blob([svgText],{type:'image/svg+xml;charset=utf-8'}),inputName+'_vector.svg')};
$('downloadPng').onclick=async()=>{if(!svgText)return;try{const img=new Image(),temp=URL.createObjectURL(new Blob([svgText],{type:'image/svg+xml'}));await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=temp});const cv=document.createElement('canvas');cv.width=inputImage.naturalWidth;cv.height=inputImage.naturalHeight;cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);URL.revokeObjectURL(temp);cv.toBlob(b=>b?download(b,inputName+'_vector_preview.png'):showMessage('PNG 저장에 실패했습니다.',true),'image/png')}catch(e){showMessage('PNG 저장에 실패했습니다.',true)}};
