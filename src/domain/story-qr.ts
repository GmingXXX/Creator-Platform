import QRCode from 'qrcode';
type StoryQr={status:'empty'|'too-long'}|{status:'ready';size:number;path:string};
export function buildStoryQr(value?:string):StoryQr {
 const text=value?.trim();
 if(!text)return {status:'empty'};
 if(text.length>512)return {status:'too-long'};
 try{
  const modules=QRCode.create(text,{errorCorrectionLevel:'M'}).modules;
  const path=Array.from({length:modules.size},(_,row)=>Array.from({length:modules.size},(_,col)=>
   modules.get(row,col)?`M${col+4} ${row+4}h1v1h-1z`:'').join('')).join('');
  return {status:'ready',path,size:modules.size+8};
 }catch{return {status:'too-long'};}
}
