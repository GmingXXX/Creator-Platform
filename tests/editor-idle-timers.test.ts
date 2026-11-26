import {expect,it,vi} from 'vitest';
import {startIdleTimers} from '../src/features/editor/editor-idle-timers';
it('自动轮播不推迟普通空闲规则，单独暂停勾选规则的剩余时间',()=>{
 vi.useFakeTimers();vi.setSystemTime(0);
 try{
 const fire=vi.fn();const timer=startIdleTimers([{id:'plain',seconds:60},{id:'paused',seconds:60,pauseDuringMedia:true}],r=>fire(r.id));
 vi.advanceTimersByTime(10000);timer.media(true);vi.advanceTimersByTime(30000);timer.media(false);timer.media(true);vi.advanceTimersByTime(20000);
 expect(fire.mock.calls).toEqual([['plain']]);timer.media(false);vi.advanceTimersByTime(49000);expect(fire).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(1000);expect(fire.mock.calls).toEqual([['plain'],['paused']]);timer.activity();vi.advanceTimersByTime(3000);timer.dispose();vi.advanceTimersByTime(90000);expect(fire).toHaveBeenCalledTimes(2)
 }finally{vi.useRealTimers()}
});
