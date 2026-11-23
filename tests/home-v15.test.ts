import {describe,it,expect,vi} from 'vitest';
import {rankTemplates,applyPrompt,joinDictation,VoiceSession} from '../src/features/home/home-logic';
import type {Template} from '../src/domain/types';
const template=(id:string,likes:number,uses:number)=>({id,likes,uses} as Template);
describe('home creation helpers',()=>{
 it('balances favorites and reuse rankings without mutating data',()=>{const items=[template('a',100,1),template('b',80,80),template('c',1,100)];expect(rankTemplates(items).map(x=>x.id)).toEqual(['c','b','a']);expect(items[0].id).toBe('a');});
 it('does not replace an unsent draft',()=>{expect(applyPrompt('my draft','suggestion')).toBe('my draft\n\nsuggestion');expect(applyPrompt('','suggestion')).toBe('suggestion');});
 it('preserves typed content when appending speech',()=>{expect(joinDictation('原有文字','录音文字')).toBe('原有文字\n录音文字');expect(joinDictation('原有文字','')).toBe('原有文字');});
});
describe('dictation sessions',()=>{
 const setup=()=>{const recognition={onresult:null,onend:null,onerror:null,start:vi.fn(),stop:vi.fn(),abort:vi.fn()} as any;const done=vi.fn(),error=vi.fn(),update=vi.fn();const voice=new VoiceSession(recognition,{done,error,update});return {voice,recognition,done,error};};
 it('stop returns recognized text without sending',()=>{const s=setup();s.voice.start();s.recognition.onresult({results:[[{transcript:'你好'}]]});s.voice.stop(false);s.recognition.onend();expect(s.done).toHaveBeenCalledWith('你好',false);});
 it('send waits for recognition end and latest result',()=>{const s=setup();s.voice.start();s.voice.stop(true);expect(s.done).not.toHaveBeenCalled();s.recognition.onresult({results:[[{transcript:'完整结果'}]]});s.recognition.onend();expect(s.done).toHaveBeenCalledWith('完整结果',true);});
 it('cancel ignores late results',()=>{const s=setup();s.voice.start();s.voice.cancel();s.recognition.onresult?.({results:[[{transcript:'不应保存'}]]});s.recognition.onend?.();expect(s.done).not.toHaveBeenCalled();expect(s.recognition.abort).toHaveBeenCalled();});
 it('permission errors never send',()=>{const s=setup();s.voice.start();s.voice.stop(true);s.recognition.onerror({error:'not-allowed'});s.recognition.onend();expect(s.done).not.toHaveBeenCalled();expect(s.error).toHaveBeenCalled();});
 it('empty speech does not submit original text',()=>{const s=setup();s.voice.start();s.voice.stop(true);s.recognition.onend();expect(s.done).not.toHaveBeenCalled();expect(s.error).toHaveBeenCalled();});
 it('ignores duplicate end events',()=>{const s=setup();s.voice.start();s.recognition.onresult({results:[[{transcript:'一次'}]]});s.recognition.onend();s.recognition.onend();expect(s.done).toHaveBeenCalledTimes(1);});
});
