import {it,expect} from 'vitest';
import {buildStoryQr} from '../src/domain/story-qr';
it('空内容与过长中文会显示可恢复状态',()=>{
 expect(buildStoryQr('')).toEqual({status:'empty'});
 expect(buildStoryQr('山'.repeat(1024))).toEqual({status:'too-long'});
 expect(buildStoryQr('山'.repeat(513))).toEqual({status:'too-long'});
 expect(buildStoryQr('https://example.com/泰山')).toMatchObject({status:'ready'});
});
