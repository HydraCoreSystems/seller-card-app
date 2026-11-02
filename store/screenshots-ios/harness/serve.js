const http=require('http'),fs=require('fs'),path=require('path');
const root='/tmp/claude-0/web-shots';
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon','.json':'application/json'};
http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); let f=path.join(root,p);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(root,'index.html');
  r.setHeader('content-type',types[path.extname(f)]||'application/octet-stream'); fs.createReadStream(f).pipe(r);
}).listen(8099,()=>console.log('up'));
