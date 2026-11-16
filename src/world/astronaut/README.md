# Astronauta

Esta pasta concentra o código do personagem. Procure por `ASTRONAUTA` ou
`#region ASTRONAUTA` para encontrar suas regiões de implementação.

| Arquivo | Responsabilidade |
| --- | --- |
| `config.ts` | **Tamanho**, altura dos pés, sombra, câmera e distâncias de embarque. |
| `index.ts` | Entrada pública do módulo. |
| `AstronautModel.ts` | Carregamento do GLB, textura, materiais e aplicação da escala. |
| `PlayerAnimator.ts` | Animações de parado, caminhada, corrida e salto. |
| `PlayerController.ts` | Entidade, movimento, corrida, salto, terreno e entrada/saída do veículo. |
| `locomotion.ts` | Giro limitado, aceleração, frenagem e deslocamento alinhado ao corpo. |
| `boarding.ts` | Proximidade do veículo, saída segura e espaço para colisão. |
| `astronaut.test.ts` | Integração do modelo, escala, animações, pausa e embarque. |
| `boarding.test.ts` | Segurança da saída e limites de proximidade. |

## Como aumentar ou diminuir

Altere apenas `ASTRONAUT_CONFIG.modelScale` em `config.ts`.
O valor anterior era **150**; agora é **300**, deixando o modelo com **o dobro do tamanho anterior** (5 vezes o tamanho inicial de 60).
Na pose inicial, sua altura é de aproximadamente **12,4 unidades do jogo**.
`fallbackScale` controla o visual provisório e `shadowDiameter`, sua sombra.
As distâncias de saída foram ampliadas para acomodar o personagem maior.

## Qualidade da caminhada lateral

`locomotion.ts` faz o corpo virar antes de completar a passada, com aceleração e
frenagem ao trocar A/D. Não há animação de strafe no modelo: o astronauta gira e
caminha na direção escolhida. A velocidade da animação acompanha o deslocamento
real para reduzir pés deslizando, inclusive junto a obstáculos.
`turnSpeed`, `acceleration` e `deceleration` em `config.ts` ajustam essa resposta.
`locomotion.test.ts` verifica mudanças laterais, diagonais e taxas de atualização.

## Aparência do traje

Em `config.ts`, `suitBrightness` clareia a textura original (atualmente 1,2)
e `suitMetalness` reduz a aparência cinza de metal (atualmente 0,03).
A aplicação fica na região `ASTRONAUTA — aparência branca do traje` de
`AstronautModel.ts`. A textura original, com detalhes, faixas e visor, é preservada.

## Recursos do personagem

Os arquivos binários ficam em `public/models/astronaut/`:
`astronaut.glb` e `Astronaut_BaseColor.png`. Essa é a pasta de recursos do
astronauta; seu código fica nesta pasta `src/world/astronaut/`.

## Pontos de integração externos

- `src/world/WorldManager.ts`: cria e destrói o controlador via `astronaut/index.ts`.
- `src/systems/CameraSystem.ts`: segue o personagem; lê o enquadramento de `config.ts`.
- `src/systems/InputSystem.ts`: envia os comandos de teclado, incluindo Espaço e E.
- `src/systems/events/worldEvents.ts`: contratos dos eventos compartilhados.
- `src/components/HudOverlay.tsx`: mostra controles e avisos de entrar/sair.

Esses sistemas continuam compartilhados com o veículo e o restante do jogo.

## Controles

WASD/setas para mover, Shift para correr, Espaço para saltar e E para entrar/sair.

## Origem

Modelo, textura e lógica de animação adaptados de `oh-mars.zip`.


## Informações e suporte de vida (`vitals/`)

Importados do `oh-mars`: vida, oxigênio, água, comida, avisos abaixo de 25%,
asfixia, recuperação de vida e morte. `AstronautHud.tsx` adapta o painel original,
com barras brancas, ícones, porcentagens e alerta vermelho; `hud.css` contém
os estilos isolados. `PlayerLifeSupport.ts` mantém os valores e emite os eventos
em `events.ts`. `types.ts` define o estado e `config.ts`, as taxas originais.

O sistema avança em `SimulationEvent.STEP`, apenas durante operação e a pé.
Correr consome mais oxigênio. A cabine preserva os suprimentos. Pausar a missão
congela o consumo. O/H/J repõem oxigênio/água/comida; os botões do painel fazem
o mesmo. Na morte do astronauta, a missão pausa e reinicia automaticamente em 3 segundos;
R ou o botão antecipa o reinício. Casco da base em zero também reinicia em 3 segundos. O painel não substitui o indicador de casco da Tortuga.

Integração: `WorldManager.ts` cria e destrói o suporte de vida;
`App.tsx` monta o painel; `PlayerController.ts` informa caminhada e corrida.


## Perigos geológicos localizados

A frente de lava e o dano térmico foram retirados da missão. Quedas de rochas
preparadas em `src/world/geological/` causam ferimentos discretos somente na área
de impacto. A cabine protege o astronauta. `GeologicalEvent.INJURY` integra esse
dano ao suporte de vida; não existe dano permanente aplicado a todo o mapa.
As colisões da queda também são consultadas ao caminhar ou procurar uma saída
segura do Walker. Caso um bloco ocupe a área do personagem, afastar-se reduz a
penetração e permite sair, em vez de aprisioná-lo.

`src/systems/missionRestart.ts` mantém o reinício para vida ou casco em zero,
com uma página e mundo novos após 3 segundos. Dano parcial e vitória não reiniciam.

## Ponto de reinício

`MISSION_CONFIG.walkerSpawn` define a origem comum da primeira partida e de
qualquer reinício: X=0, Z=0, direção=28°. A altura é calculada pelo mesmo terreno
com seed fixo. Na partida com habitat, o rover permanece nessa origem e o astronauta começa
no painel da Base Habitacional. O ciclo EVA o posiciona sempre na mesma saída,
sem velocidade acumulada.
`MISSION_CONFIG.initialCamera` guarda o enquadramento original. O `WorldManager`
aplica essa origem às entidades e à câmera antes de iniciar a nova operação.


## Reinício completo da página

Todos os reinícios (morte, destruição da base ou botão) passam por
`src/systems/restartPage.ts`. A página é recarregada para descartar completamente
o mundo anterior, incluindo contexto gráfico, eventos geológicos, teclas e listeners.
Uma marca temporária em `sessionStorage` permite iniciar a nova operação
automaticamente e é removida assim que for lida. Não salva coordenadas da morte.
Se o armazenamento estiver bloqueado, a recarga ainda ocorre e volta à preparação.

## Equipamento fotográfico EVA

A pasta `equipment/` contém a modelagem da câmera peitoral, a capa térmica,
os comandos ampliados e o cabo de segurança. Seu README identifica as regiões
da modelagem e a ligação da tecla C à captura pela lente física do traje.
