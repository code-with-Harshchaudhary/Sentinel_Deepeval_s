import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Inbox, LoaderCircle, X } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export function Button({ className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={twMerge('button', `button-${variant}`, className)} {...props} />;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={twMerge('glass-card', className)}>{children}</section>;
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'violet' | 'warning' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="state-panel"><span className="state-icon"><Inbox size={20} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return <div className="state-panel"><LoaderCircle className="spin" size={22} /><p>{label}</p></div>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="state-panel state-error"><AlertTriangle size={22} /><h3>Could not load this view</h3><p>{message}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div>;
}
export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="field"><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>;
}
export function TextArea({ label, hint, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return <label className="field"><span>{label}</span><textarea {...props} />{hint && <small>{hint}</small>}</label>;
}
export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className="modal-content"><div><Dialog.Title>{title}</Dialog.Title>{description && <Dialog.Description>{description}</Dialog.Description>}</div><Dialog.Close className="icon-button" aria-label="Close"><X size={18} /></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export const statusTone = (status: string) => status === 'completed' || status === 'passed' ? 'success' : status === 'failed' ? 'danger' : status === 'running' ? 'violet' : 'neutral';
