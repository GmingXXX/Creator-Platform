import {afterEach,describe,expect,it,vi} from 'vitest';
import {editorShortcutBlocked,editorTextInput} from '../src/features/editor/editor-keyboard';
class Target { constructor(private match:string=''){} closest(selector:string){return selector.includes(this.match)&&this.match?this:null;} }
function setup(dialogs:{modal:string|null;visible:boolean}[]=[]){vi.stubGlobal('Element',Target);vi.stubGlobal('document',{querySelectorAll:()=>dialogs.map(d=>({getAttribute:()=>d.modal,getClientRects:()=>d.visible?[{}]:[]}))});}
afterEach(()=>vi.unstubAllGlobals());
describe('editor keyboard focus guards',()=>{
 it('does not let the mounted but hidden assistant disable shortcuts',()=>{setup([{modal:'false',visible:false}]);expect(editorShortcutBlocked(new Target() as unknown as EventTarget)).toBe(false)});
 it('permits canvas shortcuts with a visible nonmodal assistant',()=>{setup([{modal:'false',visible:true}]);expect(editorShortcutBlocked(null)).toBe(false)});
 it('blocks visible modal dialogs and ignores hidden ones',()=>{setup([{modal:'true',visible:true}]);expect(editorShortcutBlocked(null)).toBe(true);setup([{modal:'true',visible:false}]);expect(editorShortcutBlocked(null)).toBe(false)});
 it('keeps keystrokes inside assistant and popover controls',()=>{setup();for(const match of ['[role="dialog"]','[data-radix-popper-content-wrapper]'])expect(editorShortcutBlocked(new Target(match) as unknown as EventTarget)).toBe(true)});
 it('protects inputs and nested editable text but allows canvas focus',()=>{setup();for(const match of ['input','textarea','select','[contenteditable="true"]'])expect(editorTextInput(new Target(match) as unknown as EventTarget)).toBe(true);expect(editorTextInput(new Target() as unknown as EventTarget)).toBe(false);expect(editorTextInput(null)).toBe(false)});
});
