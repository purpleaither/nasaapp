# Câmera de EVA do astronauta

`EvaCamera.ts` modela uma câmera genérica de EVA com proporções adaptadas ao
astronauta do jogo. Ela é criada por `AstronautModel.ts` e acompanha a posição
do osso do peito quando o modelo animado está disponível.

## Regiões da modelagem

- **Suporte peitoral:** placa, trilhos, travas e parafusos ligados ao traje.
- **Proteção térmica:** jaqueta cinza com abas cinza-prateadas, costuras e reforços.
- **Controles para luvas:** disparador vermelho ampliado, guarda e alavanca grande.
- **Conjunto óptico:** objetiva, anéis de proteção/foco, vidro e origem óptica.
- **Segurança:** cabo curvo segmentado, mosquetão e âncora no traje. A âncora
  permanece fixa ao suporte; o cabo acompanha o berço articulado da câmera.

O equipamento continua preso ao traje durante caminhada, giro e salto. Ele fica
oculto junto com o astronauta quando este embarca no Walker.

## Fotografar com C

1. Inicie a operação e aproxime-se do afloramento indicado.
2. A pé, pressione **C** (também funciona com Shift/Caps Lock).
3. O corpo gira para apontar a câmera do peito ao alvo. O berço ajusta a elevação.
4. A câmera científica recebe a posição e a direção da lente física do traje.
5. O disparador é pressionado, o indicador acende e a imagem vai para o painel.

É obrigatório sair do Walker para registrar o exterior avermelhado e a face
fraturada na mesma fotografia. Posicione-se à frente do canto ausente, mantendo
as duas regiões no enquadramento. Não há comparação separada.
O mesmo comando inicia a perfuração depois de voltar ao veículo. Fora do alcance, o painel
informa a distância necessária. Ctrl+C e campos de texto não acionam a câmera.

## Fluxo técnico

`InputSystem` → `VolcanicFront.COMPLETE_OBJECTIVE` → `MineralMissionScene`
→ `EVA_CAMERA_AIM` / `EVA_CAMERA_QUERY` → `FieldCamera.capture` →
`FIELD_PHOTO` → confirmação do objetivo.

`FieldCamera` registra 640×400 pixels. A fotografia conjunta exige validação geométrica
em `photoFraming.ts` e uma imagem retornada pelo renderizador; o tempo da animação, sozinho, não conta como foto.
Identificadores de captura impedem que imagens atrasadas validem outra tentativa.
Falhas ou ausência de imagem cancelam a ação e liberam nova tentativa com C.

## Testes

- `EvaCamera.test.ts`: fixação, componentes, cabo, origem óptica e disparador.
- `../astronaut.test.ts`: integração com o peito do modelo animado.
- `../../missions/EvaPhotography.test.ts`: teclado C, corpo, lente e objetivo.
- `../../missions/FieldCamera.test.ts`: leitura de pixels, imagem e falhas.

Nos testes sem GPU, somente a leitura de pixels é simulada; a entrada, as
transformações do equipamento, os eventos e as regras da missão são exercitados.
