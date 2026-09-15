# Google Play — materiais da ficha

O padrão do Google é diferente do da Apple em quase tudo que importa, e os
arquivos **não são reaproveitáveis** entre as duas lojas.

## O que a Play exige

| Peça | Formato | Observação |
|---|---|---|
| **Feature graphic** | 1024 × 500 px, PNG ou JPG, **sem transparência** | Obrigatório. Não existe equivalente na Apple. É o banner no topo da ficha e o que aparece em listas de destaque. |
| **Ícone da ficha** | 512 × 512 px, PNG 32 bits | Já existe; sai do `android-icon-foreground`. |
| **Capturas de telefone** | mín. 2, máx. 8. Lado menor ≥ 320 px, maior ≤ 3840 px, proporção entre 16:9 e 9:16 | O emulador Pixel dá 1080 × 2400, que está dentro. |
| **Capturas de tablet** | opcional | Só se a ficha declarar suporte a tablet. **Não declare.** Ver abaixo. |

### Diferenças que mudam o desenho, não só o tamanho

1. **A primeira imagem não domina como na Apple.** Na App Store a busca mostra
   as três primeiras capturas; na Play o que aparece primeiro é o **feature
   graphic**. É nele que o esforço de marketing rende mais.

2. **O texto sobre a captura é tolerado, não esperado.** A Play é mais próxima
   de mostrar o app como ele é. Uma faixa de texto por imagem, curta, funciona;
   a composição pesada que a App Store premia costuma parecer anúncio aqui.

3. **Nada de "prêmio", "nº 1", "melhor app" nem menção a outra loja.** A
   política da Play recusa alegação de ranking e qualquer referência a preço ou
   promoção dentro da arte.

## Tablet: não declarar

A Apple nos obrigou a suportar iPad porque a versão anterior já suportava. **Na
Play não há essa amarra** — a ficha só mostra e exige capturas de tablet se você
declarar suporte. Como não há demanda conhecida, o caminho barato é não declarar
e não gerar as capturas.

Se um dia declarar, o app já está pronto: a largura máxima de conteúdo que
resolveu o iPad vale para qualquer tela larga, inclusive Android.

## Prompt para o Claude Design — feature graphic

```
Crie um artboard de 1024 x 500 px: o feature graphic da Google Play do app
Agenda Psi.

CONTEXTO
Agenda Psi é um app de gestão de consultório para psicólogos e psicanalistas
brasileiros que atendem por conta própria. Sem secretária, sem clínica, sem
sistema. O público quer passar menos tempo no administrativo e saber se o mês
fechou no azul.

O QUE O QUADRO PRECISA FAZER
É o primeiro contato visual na Play, antes das capturas. Em 1024 x 500 cabe UMA
ideia. A ideia é: a papelada do consultório resolvida no telefone.

COMPOSIÇÃO
- Fundo: gradiente sóbrio, de um azul profundo para um azul-petróleo. Sem
  textura, sem padrão geométrico, sem "bolhas".
- À esquerda, ocupando cerca de metade da largura: o nome "Agenda Psi" em
  branco, peso semibold, e abaixo uma linha de apoio em azul muito claro:
  "A gestão do seu consultório, resolvida."
- À direita: um aparelho Android em perspectiva leve, mostrando a tela de
  Início. O aparelho pode sangrar na borda direita e inferior.
- Margem de segurança de 40 px em toda volta. A Play recorta as bordas em
  algumas superfícies, e texto colado na borda some.

RESTRIÇÕES
- Sem ponto de exclamação, sem emoji.
- Sem selo, sem "baixe agora", sem estrela de avaliação, sem menção a preço,
  promoção ou a outra loja — a política da Play recusa.
- Sem ícone do app: ele já aparece ao lado, na ficha.
- O texto tem de ser legível em 200 px de largura, que é como o quadro aparece
  em algumas listas.

EXPORTAÇÃO
PNG, 1024 x 500, sem transparência.
```

## Prompt para as capturas de telefone

Mesmo prompt do iPhone, em `prompt-claude-design-iphone.md`, com três trocas:

1. **artboards de 1080 x 2400**, não 1242 x 2688;
2. **moldura de aparelho Android**, não de iPhone;
3. as capturas vêm de `telas-android/`, que mostram o app com o desenho
   Material — grupos de lista sem cartão e títulos em azul, que é o previsto
   para a plataforma e não um defeito.

## O que falta antes de gerar as capturas

As capturas do Android **ainda não existem**. Falta entrar na conta de
demonstração no emulador — e senha não é coisa que o assistente digite. Feito o
login, as seis telas saem em minutos, pelo mesmo caminho do iOS.
