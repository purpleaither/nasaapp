import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignalObjectives } from '../components/SignalObjectives.tsx';
import { HabitatPanel } from '../components/HabitatPanel.tsx';
import { LanguageToggle } from '../components/LanguageToggle.tsx';
import { SignalState } from '../world/signal/SignalMission.ts';
import { getLanguage, setLanguage, subscribeLanguage, translate } from './index.ts';
import type { WorldManager } from '../world/WorldManager.ts';

test('PT → EN → PT translates live state and stores selection without changing mission resources',()=>{
 const state=new SignalState();state.act('start',true);state.act('battery',true);state.open=true;
 const world={getSignalStatus:()=>({...state,available:true,distance:0})} as WorldManager;
 let changes=0;const unsubscribe=subscribeLanguage(()=>changes++);
 const storage=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key),setItem:(key:string,v:string)=>storage.set(key,v)}});
 setLanguage('pt');let html=renderToStaticMarkup(<SignalObjectives world={world}/>);assert.match(html,/Restabelecer o sinal/);
 setLanguage('en');html=renderToStaticMarkup(<SignalObjectives world={world}/>);assert.match(html,/Restore the Signal/);assert.match(html,/Transmit data/);assert.match(html,/1 spare battery used/);assert.doesNotMatch(html,/Transmitir|bateria|estação/);assert.equal(state.batteries,0);assert.equal(storage.get('mars-language'),'en');
 state.solution=null;state.batteries=0;html=renderToStaticMarkup(<SignalObjectives world={world}/>);assert.match(html,/No spare battery available/);assert.match(html,/disabled=""[^>]*><strong>Install battery/);
 setLanguage('pt');html=renderToStaticMarkup(<SignalObjectives world={world}/>);assert.match(html,/Sem bateria de reserva/);assert.equal(state.completed,false);assert.equal(getLanguage(),'pt');assert.equal(changes,2);unsubscribe();
});
test('feedback, variable messages and base labels translate while names, keys and numbers remain',()=>{
 assert.equal(translate('Aproxime-se do alvo: 42 UJ restantes.','en'),'Approach the target: 42 GU remaining.');
 assert.equal(translate('BASE HABITACIONAL','en'),'HABITAT BASE');
 assert.equal(translate('C · M01 · Walker · 75%','en'),'C · M01 · Walker · 75%');
 const world={getAstronautVitals:()=>({oxygen:100,water:100,food:100,health:100})} as unknown as WorldManager;
 const habitat={location:'inside',cycling:false,label:'Pressurizado',message:'Base habitacional pressurizada. Consulte os objetivos e prepare o equipamento antes da EVA.',equipmentReady:false} as any;
 const status={phase:'preparation',geology:{energy:100,equipment:100},hull:100} as any;
 setLanguage('en');const html=renderToStaticMarkup(<HabitatPanel world={world} habitat={habitat} status={status}/>);assert.match(html,/Prepare scientific equipment/);assert.match(html,/Pressurized/);assert.doesNotMatch(html,/Preparar|Pressurizado/);assert.match(renderToStaticMarkup(<LanguageToggle/>),/Mudar idioma para português/);setLanguage('pt');
});
