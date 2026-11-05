# ✂ Corta Anúncio em L

Extensão do Chrome que **esconde o anúncio em "L" embutido nas transmissões ao vivo do YouTube**: aquele em que o jogo encolhe pro canto e a propaganda ocupa a lateral direita e a faixa de baixo do vídeo.

Esse anúncio **não é do YouTube**: ele faz parte da própria imagem da transmissão (é comum na CazéTV, por exemplo). Por isso aparece mesmo com YouTube Premium, e nenhum bloqueador de anúncio consegue tirar. Esta extensão percebe quando o "L" aparece e dá zoom no jogo até ele ocupar o player inteiro. Quando o anúncio sai, o vídeo volta ao normal.

```
   transmissão com anúncio em L              o que você vê com a extensão
 ┌──────────────────────┬───────┐          ┌──────────────────────────────┐
 │                      │       │          │                              │
 │        JOGO          │ ANÚN- │          │                              │
 │   (encolhido ~79%)   │  CIO  │   ──▶    │            JOGO              │
 │                      │       │          │       (tela inteira)         │
 ├──────────────────────┘       │          │                              │
 │           ANÚNCIO            │          │                              │
 └──────────────────────────────┘          └──────────────────────────────┘
```

## Instalação

1. Baixe este repositório (**Code → Download ZIP**) e descompacte, ou `git clone`.
2. Abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor**, no canto superior direito.
4. Clique em **Carregar sem compactação** e escolha a pasta do repositório.
5. (Opcional) Fixe o ícone pelo quebra-cabeça 🧩 da barra.

Abas do YouTube que já estavam abertas recebem a extensão automaticamente. Se alguma não receber, aperte **F5** nela.

## Uso

Funciona sozinha: abra uma live ou um vídeo no YouTube e pronto.

- **Ícone com ✂ vermelho:** está cortando um anúncio nesta aba agora.
- **Ícone com `OFF`:** desligada.
- **Clique no ícone:** abre o painel.
- **`Alt` + `Shift` + `L`:** liga e desliga sem abrir o painel.

### Painel

- **Extensão ligada:** liga e desliga.
- **Modo debug:** mostra um quadrinho no canto do player com o status (`vigiando` / `✂ CORTANDO`), as bordas medidas e uma prévia do quadro.
- **Status da aba:** se a extensão está rodando nela, se está cortando agora e quantos quadros já analisou.
- **Prévia sem o corte:** o quadro inteiro do vídeo. Quando está cortando, o anúncio escondido aparece em vermelho. Quando não está, linhas amarelas tracejadas marcam as bordas que parecem um "L".

## Como funciona

Não usa IA nem manda nada pra internet: tudo roda localmente, com uma regra de geometria.

A cada 0,5 s a extensão copia o quadro atual do vídeo pra um canvas de 256×144 e procura **um par de bordas retas** que forme o "L":

1. **Borda vertical:** a coluna onde termina o jogo e começa o painel da direita. A força dela é a fração das linhas, ao longo de toda a altura do jogo, em que a luminosidade dá um salto (> 15 níveis) de um lado pro outro.
2. **Borda horizontal:** a mesma coisa pra linha onde começa a faixa de baixo, ao longo de toda a largura do jogo.
3. **O par precisa ser coerente.** O jogo encolhe na mesma proporção nos dois eixos, então a posição das duas bordas tem que bater (diferença < 3%), entre 74% e 84% do quadro. As duas bordas precisam aparecer em pelo menos 70% da sua extensão.
4. **E precisa ficar parado.** O mesmo "L", com tolerância de 1 px, em 2 amostras seguidas. O corte só é desfeito depois de 3 amostras seguidas sem o "L".

Corte de câmera, jogador ou beirada da mesa até formam uma linha forte, mas não um "L" perfeito, fixo e na proporção certa. Escolher o **par** (e não cada borda sozinha) é o que impede a beirada da mesa de ser confundida com a borda do anúncio.

O corte em si é só CSS no `<video>`: `transform: scale(...)` a partir do canto superior esquerdo e `clip-path: inset(...)` pra esconder o resto. Nada é baixado nem alterado no vídeo.

### Calibração

Os parâmetros foram ajustados numa transmissão completa da CazéTV (2h40, analisada a 2 quadros por segundo). Resultado:

- **32 trechos cortados, todos anúncio em L ou chamada da CazéTV no mesmo formato.** Os patrocinadores incluem Proforce, Vale, Magalu, Honda e Loterias Caixa.
- **Nenhum falso positivo.** O layout de estúdio com os narradores, o replay em moldura e as vinhetas ficaram intactos.

## Limitações

- **O primeiro segundo de cada anúncio ainda aparece.** A extensão precisa ver o "L" parado em 2 amostras, mais a animação do jogo encolhendo. Cortar antes traria falsos positivos.
- **Só cobre esse formato:** jogo encolhido entre 74% e 84% do quadro, no canto superior esquerdo. Se um canal usar outro tamanho ou outro canto, a extensão ignora.
- **Funciona só em `youtube.com`.** Vídeos do YouTube embutidos em outros sites não são cobertos.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `manifest.json` | Configuração da extensão (Manifest V3) |
| `detector.js` | Detecção do "L": medição das bordas e máquina de estados com histerese |
| `content.js` | Roda na página do YouTube: lê os quadros, aplica o corte e desenha o quadrinho de debug |
| `background.js` | Selo do ícone, atalho de teclado e injeção nas abas que já estavam abertas |
| `painel.html` / `painel.js` | O painel que abre ao clicar no ícone |
