import { useSyncExternalStore } from 'react';
import translations from './en.json';
export type Language = 'pt' | 'en';
const listeners = new Set<() => void>();
function readLanguage():Language { try { return localStorage.getItem('mars-language') === 'en' ? 'en' : 'pt'; } catch { return 'pt'; } }
let language:Language = typeof window === 'undefined' ? 'pt' : readLanguage();
export function getLanguage(){return language;}
export function subscribeLanguage(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function setLanguage(next:Language){
 if(next===language)return;
 language=next;
 try{localStorage.setItem('mars-language',next);}catch{/* Storage may be unavailable. */}
 if(typeof document!=='undefined'){document.documentElement.lang=next==='pt'?'pt-BR':'en';document.title=next==='pt'?'Projeto Marte':'Mars Project';}
 listeners.forEach(listener=>listener());
}
export function useLanguage(){return useSyncExternalStore(subscribeLanguage,getLanguage,getLanguage);}
const dictionary:Record<string,string>=translations;
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fragments=Object.keys(dictionary).sort((a,b)=>b.length-a.length);
const pattern=new RegExp(fragments.map(escape).join('|'),'g');
export function translate(text:string, locale:Language=language):string{
 if(locale==='pt')return text;
 const normalized=text.replace(/\s+/g,' ').trim();
 if(dictionary[normalized])return text.replace(normalized,dictionary[normalized]);
 return text.replace(pattern,matched=>dictionary[matched]);
}
// Only renderable string values pass through here; event identifiers and game state stay unchanged.
export function localize<T>(value:T):T {
 if(typeof value==='string')return translate(value) as T;
 if(Array.isArray(value))return value.map(item=>localize(item)) as T;
 return value;
}
if(typeof document!=='undefined'){document.documentElement.lang=language==='pt'?'pt-BR':'en';document.title=language==='pt'?'Projeto Marte':'Mars Project';}
