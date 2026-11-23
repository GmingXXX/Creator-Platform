import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { X, Search, FolderOpen, Check, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import {BrandMark} from './BrandMark';
import '../styles/brand-experience.css';

export function Button({children,variant='secondary',size,className,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger';size?:'sm'|'icon'}) {
 return <button type="button" {...props} className={clsx('btn',`btn-${variant}`,size&&`btn-${size}`,className)}>{children}</button>;
}
export function Modal({open,onClose,title,description,children,footer,wide}: {open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;footer?:ReactNode;wide?:boolean}) {
 return <Dialog.Root open={open} onOpenChange={v=>!v&&onClose()}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className={clsx('modal',wide&&'modal-wide')} aria-describedby={description?undefined:undefined}><div className="modal-heading"><div><Dialog.Title>{title}</Dialog.Title>{description?<Dialog.Description>{description}</Dialog.Description>:<Dialog.Description className="sr-only">{title}的详细内容与操作</Dialog.Description>}</div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="关闭对话框"><X size={18}/></Button></Dialog.Close></div><div className="modal-body">{children}</div>{footer&&<div className="modal-footer">{footer}</div>}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function Popover({trigger,children,align='start'}:{trigger:ReactNode;children:ReactNode;align?:'start'|'end'|'center'}){
 const [open,setOpen]=useState(false);
 return <PopoverPrimitive.Root open={open} onOpenChange={setOpen}><PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger><PopoverPrimitive.Portal><PopoverPrimitive.Content className="popover" align={align} sideOffset={8} collisionPadding={12} onClick={e=>{if((e.target as HTMLElement).closest('[data-popover-close]'))setOpen(false)}}>{children}</PopoverPrimitive.Content></PopoverPrimitive.Portal></PopoverPrimitive.Root>;
}
export function Menu({trigger,items}:{trigger:ReactNode;items:{label:string;onClick:()=>void;icon?:ReactNode;danger?:boolean;disabled?:boolean}[]}){
 return <Dropdown.Root><Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger><Dropdown.Portal><Dropdown.Content className="dropdown-menu" align="end" sideOffset={6}>{items.map((i,n)=><Dropdown.Item key={`${i.label}-${n}`} disabled={i.disabled} className={clsx('dropdown-item',i.danger&&'danger')} onSelect={i.onClick}>{i.icon}{i.label}</Dropdown.Item>)}</Dropdown.Content></Dropdown.Portal></Dropdown.Root>;
}
export function Badge({children,className,tone='neutral'}:{children:ReactNode;className?:string;tone?:string}){return <span className={clsx('badge',`badge-${tone}`,className)}>{children}</span>}
export function PageHeader({title,description,children}:{title:string;description?:string;children?:ReactNode}){return <header className="page-heading"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="page-heading-actions">{children}</div></header>}
export function EmptyState({title,description,action}:{title:string;description?:string;action?:ReactNode}){return <div className="empty-state"><div className="empty-symbol"><FolderOpen size={28}/></div><h3>{title}</h3>{description&&<p>{description}</p>}{action}</div>}
export function SearchInput({value,onChange,placeholder='搜索',className}:{value:string;onChange:(v:string)=>void;placeholder?:string;className?:string}){return <div className={clsx('search-input',className)}><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button aria-label="清除搜索" onClick={()=>onChange('')}><X size={14}/></button>}</div>}
export function Tabs<T extends string>({ value, onChange, items, glass = false }: {
 value: T;
 onChange: (value: T) => void;
 items: { value: T; label: ReactNode }[];
 glass?: boolean;
}) {
 const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
  if (!items.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = items.findIndex(item => item.value === value);
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + step + items.length) % items.length;
  onChange(items[next].value);
  event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
 };
 return <div className={clsx('tabs', glass && items.length === 2 && 'tabs-glass-pair')} role="tablist" onKeyDown={navigate}>
  {items.map(item => <button key={item.value} role="tab" tabIndex={value === item.value ? 0 : -1}
   aria-selected={value === item.value} className={clsx(value === item.value && 'active')}
   onClick={() => onChange(item.value)}>{item.label}</button>)}
 </div>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Logo({small=false}:{small?:boolean}){return <div className={clsx('brand',small&&'brand-small')}><BrandMark/>{!small&&<span>智创<span className="brand-latin">Studio</span></span>}</div>}

type Notice={id:number;text:string;error:boolean};
let notices:Notice[]=[];const subscribers=new Set<()=>void>();
function emit(){subscribers.forEach(fn=>fn())}
export function toast(text:string,error=false){const id=Date.now()+Math.random();notices=[...notices.slice(-2),{id,text,error}];emit();setTimeout(()=>{notices=notices.filter(n=>n.id!==id);emit()},4200)}
export function ToastHost(){const items=useSyncExternalStore(fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)},()=>notices);return <div className="toast-host" aria-live="polite">{items.map(n=><div key={n.id} className={clsx('toast',n.error&&'toast-error')}>{n.error?<AlertCircle size={17}/>:<Check size={17}/>}<span>{n.text}</span><button aria-label="关闭通知" onClick={()=>{notices=notices.filter(i=>i.id!==n.id);emit()}}><X size={14}/></button></div>)}</div>}
export function useDocumentTitle(title:string){useEffect(()=>{document.title=`${title} · 智创平台`},[title])}
export function downloadBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
