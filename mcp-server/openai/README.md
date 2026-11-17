# Pacote do Agenda Psi para o diretório do ChatGPT

Pacote que o painel da OpenAI pede: `plugin.json` + `mcp.json` + `assets/`, enviado como ZIP em platform.openai.com/plugins, opção "With MCP". O servidor é o mesmo do Claude (`https://app.agendapsi.app.br/mcp`). As ferramentas e o fluxo de login a OpenAI lê direto do servidor.

## Antes de gerar o ZIP
1. **Termos de uso:** troque `termsOfServiceURL` em `plugin.json` pela URL pública dos termos. A OpenAI exige as quatro URLs (site, suporte, privacidade e termos).
2. **Vídeo de demonstração:** grave os 5 casos positivos numa conta de teste com dados fictícios. Publique como "não listado" no YouTube, ou num link que o revisor consiga abrir sem login, e ponha o link em `demo_recording_url`.
3. **Conta de demonstração:** login e senha de uma conta com dados fictícios. Entram **no painel**, num campo seguro, **nunca** neste arquivo. Não pode ter verificação em duas etapas.

## Gerar o ZIP
```bash
cd mcp-server/openai && zip -r ~/Documents/agenda-psi-diretorio/agenda-psi-openai.zip plugin.json mcp.json assets
```

## No painel
1. **Verificação:** a organização em platform.openai.com precisa estar verificada (pessoa física ou empresa) para publicar em nome da Dab Lab.
2. **Envio:** em Plugins, escolha "Upload new or existing plugin", envie o ZIP e conecte o MCP.
3. **Verificação de domínio:** o painel mostra um token. Ele precisa ficar servido como texto puro em `https://app.agendapsi.app.br/.well-known/openai-apps-challenge`. Passe o token ao Claude Code, que publica o arquivo em `site/public/.well-known/`.
4. **Revisão:** resolva os achados automáticos, preencha a conta de demonstração, aceite as declarações e envie.
5. **Publicação:** o resultado chega por e-mail e aparece no painel. Depois de aprovado, clique em "Publish plugin".
