import { setLanguage, useLanguage } from '../i18n/index.ts';
export function LanguageToggle(){
 const language=useLanguage();
 return <div className="pointer-events-auto fixed right-3 top-3 lg:right-[14rem] z-[100] rounded-lg border border-[#72472e] bg-[#20120e] p-1 text-xs text-orange-100 shadow-lg" onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()}>
 <button type="button" onClick={()=>setLanguage(language==='pt'?'en':'pt')} aria-label={language==='pt'?'Switch language to English':'Mudar idioma para português'} title={language==='pt'?'Mudar para inglês':'Switch to Portuguese'} className="min-h-10 min-w-24 rounded px-3 py-2 font-semibold hover:bg-[#3d2418] focus-visible:outline-2 focus-visible:outline-teal-300"><span lang="pt-BR" className={language==='pt'?'text-teal-200':'text-orange-100/60'}>PT</span> / <span lang="en" className={language==='en'?'text-teal-200':'text-orange-100/60'}>EN</span> ⇄</button>
 </div>;
}
