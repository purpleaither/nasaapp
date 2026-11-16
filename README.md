# Projeto Marte — A crosta vermelha

Jogo 3D de exploração, coleta científica, manutenção do casco e retirada de equipe em um futuro fictício.
O setor se inspira em Elysium Planitia e Cerberus Fossae. Uma sequência incomum de
sismos motiva a investigação; a origem dos sinais permanece incerta. O jogo não
apresenta uma erupção atual ou iminente em Marte como fato confirmado.

## Executar

Requer Node.js 22.12+ e npm. Nenhuma chave de API é necessária para jogar.

```sh
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite. Para gerar a versão estática: `npm run build`.
Verificação de tipos: `npm run lint`. Testes: `npm test`.

## Controles

- WASD / setas: dirigir a base Walker ou caminhar a pé.
- Shift: turbo ou corrida. Espaço: salto a pé.
- F: retornar pela câmara, a pé e próximo à entrada da base.
- E: sair ou entrar no rover quando próximo; a saída procura chão seguro.
- C: executar o objetivo científico atual, quando em alcance.
- I: consultar sensores, integridade, rotas e opções de retirada.
- O / H / J: repor oxigênio, água ou comida.
- Esc: pausar. Botões na interface também permitem executar ações.

## Missão científica — uma fotografia, uma coleta

Desembarque e fotografe, no mesmo enquadramento, o exterior avermelhado e a face
escura revelada pelo canto ausente do bloco. Não há comparação separada nem dois
pontos obrigatórios de inspeção. A câmera EVA permanece presa ao peito, com
proteção térmica cinza, comandos para luvas e cabo de segurança.

A validação usa a posição, distância (12–38 UJ da câmera), direção da lente e
projeção de pontos representativos das duas regiões e da borda comum. Não usa
reconhecimento de imagem. A foto precisa ser efetivamente salva pelo renderizador;
registros inválidos ou antigos não liberam a coleta. A orientação ao jogador é:
“Enquadre a superfície avermelhada e a face fraturada na mesma fotografia.”

Após o registro: “A superfície avermelhada contrasta com a rocha mais escura
exposta na fratura. A composição será investigada na amostra.” Embarque para
operar a broca e selar M01. A coleta termina ao acondicionar e registrar o tubo,
sem um objetivo repetido de armazenamento. Retorne à Base Habitacional, desembarque,
pressione F na entrada e, após o ciclo, use “Encerrar atividade de campo”.

O modelo é um bloco fechado com canto removido: exterior irregular, desgastado,
com poeira ocre/ferruginosa descontínua e zonas de rocha escura aparentes. A
ruptura tem facetas, degraus, contorno angular e pouca poeira nas reentrâncias.
As duas regiões compartilham grão mineral, material fosco, metalicidade zero e
bordas fisicamente coincidentes, sem placas ou casca grossa. A face escura ocupa
aproximadamente um quarto a um terço da área visível na vista de composição.
Uma luz lateral suave torna o relevo legível.

A aparência é específica deste afloramento. Não indica quando ele fraturou,
não identifica minerais por cor e não confirma atividade vulcânica.

## Base Habitacional — instalação fixa

A partida começa no painel da base pressurizada. Consulte **Objetivos**, **Recursos**
e **Equipamento**, clique em **Preparar equipamento científico** e depois em
**Iniciar saída pela câmara · EVA**. O ciclo curto anima portas intertravadas e uma
transição de tela. Ao terminar, o astronauta aparece na área livre ao pé do acesso.
Não existe exploração interna nem construção de cômodos neste MVP.

O rover Tortuga é um veículo independente e permanece no estacionamento lateral.
A base não tem rodas e não acompanha sua posição. Depois da coleta do M01, a seta
passa a apontar para a entrada da base; desembarque e use **F** a pé para retornar.
Após pressurizar, **Encerrar atividade de campo** conclui a missão. É possível voltar
antes da coleta, repor suprimentos e sair novamente para cumprir os objetivos.

O módulo cilíndrico horizontal representa aproximadamente 8 m × 4 m, usando
6,7 UJ/m para manter a escala do astronauta já existente. Possui extremidades
arredondadas, juntas, isolamento, plataforma com pés niveladores, câmara circular,
vedação, travas, degraus largos, corrimãos e área de limpeza de poeira.
Bermas laterais têm contenção própria; não cobrem entrada, radiadores ou manutenção.
As bermas representam proteção adicional, não absoluta, contra radiação e impactos.

Painéis solares ficam em estruturas separadas, com baterias, distribuição elétrica,
radiadores expostos, antena, caixas identificadas, conduítes protegidos no perímetro
e iluminação de acesso. Colisões simplificadas preservam o acesso e o estacionamento.
A fundação e a área de chegada são preparadas no terreno desde o início da partida.

`src/world/habitat/` contém o modelo, a escala, as colisões e o controlador da câmara;
`src/components/HabitatPanel.tsx` reaproveita objetivos e recursos existentes.
Portas interna e externa nunca abrem ao mesmo tempo. O interior é representado
pelo painel; a preparação repõe os suprimentos usando o suporte de vida já existente.
A pausa também congela o ciclo, com botão para retomá-lo após uma interrupção.

## Recuperar o casco

Com o astronauta embarcado, ative **Modo manutenção**, aguarde o tremor terminar e
clique em **Reparar casco** no painel da base. A manutenção recupera 2,5% de
casco/s, consome 0,45% de energia por 1% de casco recuperado e preserva 10% de
reserva para o reparo. O consumo normal do Walker continua existindo.

É possível interromper o reparo pelo botão; sair do Modo manutenção, mover o Walker,
desembarcar ou sofrer um novo tremor local também o interrompe. A pausa congela
o trabalho. O reparo não restaura instrumentos danificados nem desobstrui rotas.
Casco em zero continua acionando o reinício, sem ressurreição por manutenção.

## Crise geológica localizada

O terreno inclui planície de antigos fluxos solidificados, basaltos escuros,
regolito avermelhado, crateras e fraturas antigas com profundidade e sombras.
Não há frente de lava, fissuras emissivas, erupções decorativas ou dano térmico.

Os sismos são eventos preparados e separados por exploração. Os instrumentos
registram eventos já ocorridos; não exibem uma contagem para erupção. Quedas de
rochas são locais, com animação, poeira de impacto temporária e bloqueio real para
o astronauta e o Walker. As posições de obstáculos alimentam modelos e colisões.
A geometria do terreno permanece estática durante os tremores.

O painel I compara corredor direto e desvio: distância, terreno, gasto estimado e
exposição à escarpa. A seleção muda a orientação e o mapa; a condução é manual.
A energia depende do tempo de operação, distância percorrida e subidas.

Danos podem desabilitar instrumentos e a alimentação do relé. Após a falha do
abrigo de campo, aproxime o Walker da baliza do abrigo e use “Recolher equipe”
(alcance de 55 UJ, astronauta embarcado). Dois tripulantes são registrados na cabine.
Danos observados, baixa energia ou resgate habilitam a evacuação operacional.
Use a opção no painel I e alcance a baliza de retirada com o astronauta embarcado.
Uma retirada sem completar a coleta não afirma que o M01 foi coletado.

Vida ou casco em zero mantém o reinício automático no ponto inicial. Esgotamento
da energia interrompe a operação e permite reiniciar pelo botão. Pausa congela a
simulação, recursos e progressão dos eventos.

## Ciência, hipótese e ficção

- **Conhecimento:** o InSight detectou sismos em Marte; Cerberus Fossae é uma região
  de interesse sísmico. Fraturas e basaltos registram a história geológica marciana.
- **Hipótese:** processos magmáticos profundos podem explicar parte dos sinais;
  tremores por si só não permitem declarar erupção iminente.
- **Liberdade criativa:** datas, sequência de eventos, danos, quedas de rochas, resgate,
  durações e custos operacionais são regras de um futuro fictício. A amplitude do
  painel é relativa e ilustrativa, não uma escala de magnitude ou previsão real.

Referências: [NASA — InSight](https://science.nasa.gov/mission/insight/) e
[NASA/JPL — interior de Marte](https://www.jpl.nasa.gov/news/nasas-insight-reveals-the-deep-interior-of-mars/).

## Organização

- `src/world/geological/`: regras de cenário, traçados, colisões compartilhadas,
  modelos modulares, animação de queda, vibração estrutural e poeira de impacto.
- `src/world/volcanic/VolcanicFront.ts`: nome histórico mantido por compatibilidade;
  agora controla crise sísmica, energia, integridade, resgate e retirada, além dos
  dois objetivos científicos. Não representa uma frente vulcânica ativa.
- `src/world/terrain/`: alturas, fraturas estáticas, materiais procedurais e LOD.
- `src/components/GeologicalPanel.tsx`: relatórios, comparação de rotas e ações.
- `src/world/astronaut/`: modelo, animações, equipamento, locomoção e suporte de vida.
  Comentários `ASTRONAUTA` identificam também integrações externas. Tamanho, roupa
  e câmera ficam em `src/world/astronaut/config.ts`.
- `src/world/missions/`: afloramento M01, fotografia real, broca e marcador 3D.
- `src/systems/missionRestart.ts` e `restartPage.ts`: reinício completo, no ponto
  `MISSION_CONFIG.walkerSpawn`, com seed fixo, rover no estacionamento e astronauta no painel da base pressurizada.

Modelo e textura do astronauta importados de `oh-mars.zip`; missão 1 adaptada de
`missoes-resgate-em-marte.zip`. Referências originais preservadas em
`src/world/missions/REFERENCIAS-MISSOES.md`. As outras missões não foram ativadas.


## Missão curta: Restabelecer o sinal
No painel de objetivos, selecione “Iniciar missão de comunicação”. Prepare a EVA e saia da base normalmente. A estação com luz vermelha fica junto à placa solar existente, a oeste da base (x=-180, z=-44). Aproxime-se a pé e pressione C ou toque em Interagir com estação. Limpe por 20 segundos (cancelável, preserva 1 bateria) ou instale 1 bateria imediatamente. Em seguida, selecione Transmitir dados. A conclusão é própria deste objetivo complementar e preserva o progresso científico da missão M01. O tempo total de cerca de 2 minutos é uma estimativa, sem cronômetro obrigatório; os 20 segundos são simplificação de gameplay.

Verificação: `node --import tsx --test src/world/signal/SignalMission.test.ts`. Inclui os dois caminhos, cancelamento, estoque zerado, consumo único, interação por eventos, remoção da poeira e luz verde.


## Idiomas / Languages
Botão PT / EN no canto superior: alterna português e inglês sem reiniciar a partida. A preferência fica salva neste navegador. Menus, objetivos, mensagens, recursos, resultados, acessibilidade e placas da base são traduzidos. Teclas, nomes próprios e estado da missão são preservados. Traduções centralizadas em `src/i18n/en.json`. Testes: `node --import tsx --test src/i18n/language.test.tsx`.
