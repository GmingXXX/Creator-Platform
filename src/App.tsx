import {WorkspaceCreationAccess,WorkspaceWorkAccess} from './features/workspace/WorkspaceAccess';
import { Component, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStudio } from './domain/store';
import { ToastHost, Button } from './components/ui';
import { AppShell } from './features/AppShell';
import {AdminPage} from './features/resources/AdminPage';
import LoginPage from './features/LoginPage';
import HomePage from './features/HomePage';
import RunPage from './features/RunPage';
import {EditorNavigationTracker} from './features/workspace/EditorNavigationTracker';
import { RunEngine } from './features/RunEngine';
import EditorPage from './features/editor/EditorPage';
import { RuntimePreview } from './features/RuntimePreview';
import { ProjectsPage, LibraryPage, SkillsPage, DesignSystemDetailPage, CommunityPage, ReviewPage } from './features/resources';
import { PresentationEditorPage, VideoStudioPage, StoryEditorPage } from './features/studios';

function Protected(){const loggedIn=useStudio(s=>s.loggedIn),location=useLocation();return loggedIn?<Outlet/>:<Navigate to="/login" state={{from:location.pathname+location.search}} replace/>}
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:Error){console.error('页面载入失败',error)}
 render(){if(this.state.failed)return <div className="loading-screen"><div><h2>页面暂时没有打开</h2><p>你的本地作品仍然保留，可以重新载入继续。</p><Button onClick={()=>location.reload()}>重新载入</Button></div></div>;return this.props.children}
}
export default function App(){return <ErrorBoundary><MotionConfig reducedMotion="user"><HashRouter><EditorNavigationTracker/><RunEngine/><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<Protected/>}><Route element={<AppShell/>}><Route index element={<WorkspaceCreationAccess><HomePage/></WorkspaceCreationAccess>}/><Route path="create/:id" element={<WorkspaceCreationAccess><RunPage/></WorkspaceCreationAccess>}/><Route path="projects" element={<ProjectsPage/>}/><Route path="library" element={<LibraryPage/>}/><Route path="skills" element={<SkillsPage/>}/><Route path="design-systems" element={<Navigate to="/community?tab=systems" replace/>}/><Route path="design-systems/:id" element={<DesignSystemDetailPage/>}/><Route path="community" element={<CommunityPage/>}/><Route path="review" element={<ReviewPage/>}/><Route path="admin" element={<AdminPage/>}/><Route path="presentations" element={<Navigate to="/projects?category=presentation-video" replace/>}/><Route path="dream" element={<Navigate to="/projects?category=interactive-film" replace/>}/></Route><Route path="editor/:id" element={<WorkspaceWorkAccess><EditorPage/></WorkspaceWorkAccess>}/><Route path="preview/:id" element={<WorkspaceWorkAccess preview><RuntimePreview/></WorkspaceWorkAccess>}/><Route path="presentations/:id" element={<WorkspaceWorkAccess><PresentationEditorPage/></WorkspaceWorkAccess>}/><Route path="present/:id" element={<WorkspaceWorkAccess><PresentationEditorPage/></WorkspaceWorkAccess>}/><Route path="video/:id" element={<WorkspaceWorkAccess><VideoStudioPage/></WorkspaceWorkAccess>}/><Route path="dream/:id" element={<WorkspaceWorkAccess><StoryEditorPage/></WorkspaceWorkAccess>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes><ToastHost/></HashRouter></MotionConfig></ErrorBoundary>}
