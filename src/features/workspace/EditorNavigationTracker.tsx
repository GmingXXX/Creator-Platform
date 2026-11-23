import {useLayoutEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {trackEditorNavigation} from './editor-return';
export function EditorNavigationTracker(){
 const location=useLocation();
 useLayoutEffect(()=>{trackEditorNavigation(location.pathname+location.search,location.state?.editorReturnTo);},[location.pathname,location.search,location.state]);
 return null;
}
