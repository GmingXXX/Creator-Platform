import type {ReactNode} from 'react';
import {Modal} from '../../components/ui';
import '../../styles/agent-creation.css';
export function CreationSurface({inline,open,onClose,title,children,footer}:{inline?:boolean;open:boolean;onClose:()=>void;title:string;children:ReactNode;footer:ReactNode}){
 if(inline)return <section className="agent-creation-surface" aria-label={title} hidden={!open}><header><h2>{title}</h2><p>在这里确认方案、调整素材；完成后直接体验作品。</p></header><div className="agent-creation-body">{children}</div><footer>{footer}</footer></section>;
 return <Modal open={open} onClose={onClose} title={title} wide footer={footer}>{children}</Modal>;
}
