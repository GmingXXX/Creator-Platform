/** Floating assistant panels stay mounted while closed; only active modal dialogs block the canvas. */
export function editorShortcutBlocked(target:EventTarget|null):boolean {
 const element=target instanceof Element?target:null;
 if(element?.closest('[role="dialog"], [data-radix-popper-content-wrapper]'))return true;
 return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(dialog=>dialog.getAttribute('aria-modal')!=='false'&&dialog.getClientRects().length>0);
}
export function editorTextInput(target:EventTarget|null):boolean {
 const element=target instanceof Element?target:null;
 return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
}
