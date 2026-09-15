# Prompt para o Claude Design — prints da App Store (iPhone 6,5")

Cole o bloco abaixo no Claude Design. Suba junto as capturas de
`docs/lojas/telas-iphone/`.

O que cada artboard usa está indicado no próprio prompt, pelo nome do arquivo.

---

```
Crie um canvas com 6 artboards de 1242 x 2688 px (retrato), que são as capturas
de tela da App Store de um aplicativo iOS chamado Agenda Psi.

CONTEXTO
Agenda Psi é um app de gestão de consultório para psicólogos e psicanalistas
brasileiros que atendem por conta própria — sem secretária, sem clínica, sem
sistema de gestão. O público não é entusiasta de tecnologia: é um profissional
liberal que quer passar menos tempo no administrativo e saber se o mês fechou no
azul. A dor concreta é essa: o trabalho invisível entre uma sessão e outra, e a
falta de clareza sobre o próprio faturamento.

TOM
Português do Brasil. Adulto, direto, sóbrio. NADA de ponto de exclamação, emoji,
gíria de startup ou promessa exagerada. Nada de "revolucione", "turbine",
"gestão 360". Frase curta que descreve um alívio concreto. O leitor é um clínico:
ele desconfia de entusiasmo.

ESTILO VISUAL
Clareza acima de personalidade. É uma ficha de loja, não um pôster.
- Fundo: gradiente MUITO sutil, quase branco, de um cinza-azulado frio para o
  branco. Nada de cor saturada atrás.
- Tipografia: uma sans-serif geométrica e neutra (Inter, ou a mais próxima
  disponível). Título em peso semibold; subtítulo em regular, cinza médio.
- Título: 3 a 6 palavras, no topo, alinhado à esquerda com a mesma margem do
  aparelho. Corpo de texto grande — tem de ser legível na miniatura da loja, que
  é onde a decisão acontece.
- Subtítulo: uma frase, até 10 palavras, logo abaixo do título, em cinza.
- Abaixo do texto, a captura dentro de uma moldura de iPhone moderna, simples,
  com cantos arredondados e uma sombra suave. A moldura pode ser cortada na
  base do artboard — o aparelho "entra" no quadro de baixo.
- Azul de acento apenas onde já existe nas capturas. Não introduza outra cor.
- Sem ícone de app, sem selo, sem "disponível na App Store", sem setas, sem
  balões apontando para a tela.

REGRA DE OURO
A captura de tela é o conteúdo, não decoração. Ela ocupa a maior parte do
artboard e não pode ser distorcida, rotacionada, espelhada nem recortada por
dentro. Texto de marketing nunca cobre a interface do app.

OS 6 ARTBOARDS

1. arquivo: 01-inicio.png
   título: O mês inteiro em uma tela
   subtítulo: Sessões, recebimentos, despesas e o que sobrou.

2. arquivo: 02-agenda.png
   título: A semana já montada
   subtítulo: O horário fixo de cada paciente, sem remontar toda segunda.

3. arquivo: 03-pacientes.png
   título: Quem está em dia
   subtítulo: O valor combinado e as sessões em aberto de cada paciente.

4. arquivo: 04-registrar-sessao.png
   título: A sessão registrada entre uma e outra
   subtítulo: Quatro toques, no intervalo, sem quebrar o ritmo.

5. arquivo: 05-despesas.png
   título: O custo real do consultório
   subtítulo: Aluguel, supervisão, análise e impostos no mesmo lugar.

6. arquivo: 06-paciente.png
   título: Cada paciente, o histórico inteiro
   subtítulo: Preço vigente, sessões realizadas e o que ficou em aberto.

EXPORTAÇÃO
PNG, 1242 x 2688 px, sem transparência.
```

---

## Depois de gerar

Confira antes de subir para a App Store Connect:

- **O tamanho tem de ser exato.** 1242 × 2688. A App Store Connect não
  redimensiona; ela recusa.
- **Leia as miniaturas.** Reduza cada imagem a uns 3 cm de largura e veja se o
  título ainda é legível. É esse tamanho que a maioria vai ver.
- **A primeira imagem carrega o peso.** É a única que aparece na busca. Se só uma
  fosse sobreviver, seria a do mês inteiro em uma tela.

## O que deliberadamente não está aqui

**Nada sobre IA.** O app tinha duas funções de IA e as duas saíram em 14/09/2026.

**Nada sobre SMS nas seis primeiras.** O lembrete por SMS é o que justifica a
assinatura, mas é função paga: anunciá-lo na ficha sem dizer que é pago gera
avaliação de uma estrela de quem instalou achando que vinha junto. Se você quiser
uma sétima imagem para ele, o texto precisa dizer "no plano Pro" com todas as
letras.
