# Materiais de loja

## Capturas de tela da ficha da App Store

Decisão de 14/09/2026, depois de o upload ser recusado por família de aparelhos:
**o app voltou a declarar suporte a iPad**, e ficha com iPad exige capturas de
iPad. São dois conjuntos, com tratamentos diferentes.

| Conjunto | Tamanho | Pixels (retrato) | Tratamento |
|---|---|---|---|
| iPhone | 6,5" | 1242 × 2688 | **imagem final com o texto de marketing** |
| iPad | 13" | 2064 × 2752 | **só as telas**, já no tamanho, sem texto |

São **seis** imagens no iPhone e **três** no iPad. Três bastam no iPad: quem
chega ali já decidiu instalar e só quer confirmar que o app roda no aparelho
grande. As escolhidas — Início, Agenda e Pacientes — cobrem o app inteiro.

O iPhone leva a arte de marketing porque é onde a decisão de instalar acontece.
No iPad basta a tela limpa: quem chega ali já decidiu, e o objetivo é só provar
que o app funciona no aparelho.

### Simuladores que produzem esses tamanhos

Conferidos nesta máquina em 14/09/2026:

| Tamanho | Simulador | Observação |
|---|---|---|
| 6,5" | `iPhone 11 Pro Max` ou `iPhone Xs Max` | dão 1242 × 2688 exatos |
| 13" | `iPad Pro 13-inch (M4)` ou `(M5)` | dá 2064 × 2752 |

⚠️ O iPhone 17 Pro, que é o usado no desenvolvimento, **não serve**: ele é 6,3"
e dá 1206 × 2622. A App Store Connect recusa tamanho fora da tabela dela, sem
redimensionar nada por conta própria.

Capturar com:

```bash
xcrun simctl io <udid> screenshot docs/lojas/<nome>.png
```

### O que já existe aqui

- `apple-review-assinatura-pro.png` — captura do paywall para o campo *Screenshot*
  da Review Information da assinatura. **Não é** captura de ficha: esse campo
  aceita qualquer tamanho acima de 640 × 920, e serve só para o revisor achar a
  compra.
- `apple-review-notes.md` — rascunho das notas de revisão da assinatura.

## Por que o app suporta iPad

Não foi escolha de produto. A versão do FlutterFlow declarava `"1,2"` — o Flutter
gera universal por padrão — e a Apple não aceita atualização que deixe de
suportar um aparelho já suportado. A alternativa seria publicar um app novo, com
outro bundle id, jogando fora usuários e avaliações.

Consequência prática: as telas precisam **funcionar** no iPad, não só abrir.
Revisão recusa app que aparece esticado ou quebrado no aparelho maior.

E era o caso. Na primeira captura, em 14/09/2026, o layout era o do iPhone
esticado: as linhas ocupavam os 1032pt inteiros, o nome do paciente ficava na
borda esquerda e o preço na direita, com o olho percorrendo a tela para ligar um
ao outro. O conserto foi limitar o conteúdo a `larguraMaximaDeConteudo` (700pt)
dentro do componente `Screen` — como toda tela passa por ele, uma mudança
resolveu todas.
