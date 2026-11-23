import {describe,it,expect} from 'vitest';
import {normalizePresentationVoice,voiceProfileKey,DEFAULT_VOICE,applyPresentationVoice} from '../src/domain/presentation-voice';
describe('presentation voice profiles',()=>{
 it('normalizes legacy or unsupported settings without pretending unsupported pitch works',()=>{
 expect(normalizePresentationVoice(undefined)).toEqual(DEFAULT_VOICE);
 expect(normalizePresentationVoice({speaker:'evil',style:'unknown',pitch:12})).toEqual(DEFAULT_VOICE);
 });
 it('invalidates audio identity for speaking style changes only',()=>{
 expect(voiceProfileKey({...DEFAULT_VOICE,style:'warm'})).not.toBe(voiceProfileKey(DEFAULT_VOICE));
 expect(voiceProfileKey({...DEFAULT_VOICE,cloneSample:{assetId:'a',name:'样本',status:'pending'}})).toBe(voiceProfileKey(DEFAULT_VOICE));
 });
 it('invalidates cached narration only when voice style changes and preserves original',()=>{
 const settings={rate:1,voice:DEFAULT_VOICE,pages:{p:{sentences:[{audioUrl:'/api/ai/audio/a.mp3',audioText:'hello',duration:2}]}}};
 const changed=applyPresentationVoice(settings,{...DEFAULT_VOICE,style:'formal'},1.2);
 expect(changed.pages.p.sentences[0].audioUrl).toBeUndefined();expect(settings.pages.p.sentences[0].audioUrl).toBeTruthy();
 expect(applyPresentationVoice(settings,DEFAULT_VOICE,1.5).pages).toBe(settings.pages);
 expect(applyPresentationVoice(settings,DEFAULT_VOICE,NaN).rate).toBe(1);
 });
 it('keeps pending samples but rejects malformed references',()=>{
 expect(normalizePresentationVoice({cloneSample:{assetId:'a',name:'样本',status:'pending'}}).cloneSample?.assetId).toBe('a');
 expect(normalizePresentationVoice({cloneSample:{assetId:'',name:'bad',status:'ready'}}).cloneSample).toBeUndefined();
 });
});
