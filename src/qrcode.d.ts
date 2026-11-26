declare module 'qrcode' {
 const QRCode:{create(text:string,options:{errorCorrectionLevel:'M'}):{modules:{size:number;get(row:number,col:number):number}}};
 export default QRCode;
}
