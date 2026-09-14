/**
 * Texto integral da Política de Privacidade e dos Termos de Uso.
 *
 * Copiado LITERALMENTE do app FlutterFlow, de
 * `lib/basicas/politica_privacidade/politica_privacidade_widget.dart`. O spec é
 * explícito no item 13 da seção 3: "texto igual, agora acessível também de
 * dentro do app". Não reescreva, não modernize, não corrija.
 *
 * Duas promessas deste texto ainda não são verdade no produto, e isso está
 * registrado como risco, não como esquecimento:
 *
 * - "Solicitar acesso, correção ou EXCLUSÃO de informações armazenadas": hoje a
 *   exclusão de conta é soft delete, e nenhum dado é apagado (risco 23.6 e a
 *   pergunta aberta 25.4, que decide o que exclusão vai significar na v2);
 * - "Exportar seus dados cadastrados (quando disponível no app)": exportação
 *   está fora do MVP (seção 14).
 *
 * O texto também cita Firebase, que este app não usa. Mantido porque é o texto
 * publicado, e mudar política de privacidade é decisão jurídica, não técnica.
 */

export const POLITICA_DE_PRIVACIDADE = `Sua privacidade e a clareza sobre como usamos as informações são muito importantes para nós. Este documento reúne nossa Política de Privacidade e nossos Termos de Uso, explicando como o app funciona, quais dados coletamos e como eles são utilizados.

1. Objetivo do App

O Agenda Psi é um aplicativo voltado para profissionais de psicologia e áreas afins, que auxilia no gerenciamento de pacientes, sessões e pagamentos.
O app é uma ferramenta de apoio administrativo e não substitui orientações clínicas, diagnósticos ou registros exigidos por Conselhos Profissionais.

2. Coleta de Dados

Durante o uso do app, podemos coletar:

Dados cadastrais inseridos pelo profissional: nome de pacientes, contatos (telefone, e-mail), anotações de agenda e informações sobre pagamentos.

Dados de uso: interações no app (ex.: criação de sessões, registros de pagamentos) para fins de funcionamento e métricas.

Dados técnicos básicos do dispositivo (ex.: modelo, sistema, erros de uso) para melhorias e suporte.

O app não coleta dados de localização nem utiliza informações de pacientes para fins de marketing.

3. Uso dos Dados

Utilizamos os dados apenas para:

Permitir que o profissional organize sua agenda e cadastros.

Gerar relatórios de sessões e pagamentos.

Melhorar a performance e confiabilidade do aplicativo.

Entrar em contato para suporte técnico (se o profissional informar e-mail).

4. Armazenamento e Segurança

Os dados são armazenados com segurança em infraestrutura de nuvem (Supabase/Firebase ou equivalentes), com autenticação individual de usuários.

Adotamos boas práticas de segurança, incluindo criptografia em trânsito (HTTPS).

No entanto, nenhum sistema é 100% inviolável. Recomendamos que o profissional evite inserir informações excessivamente sensíveis nas anotações.

5. Compartilhamento

Não vendemos nem compartilhamos dados de pacientes com terceiros.

O compartilhamento é restrito a serviços de infraestrutura essenciais (ex.: banco de dados, hospedagem).

Poderá haver compartilhamento se exigido por lei ou decisão judicial.

6. Direitos do Usuário

Você pode:

Solicitar acesso, correção ou exclusão de informações armazenadas.

Exportar seus dados cadastrados (quando disponível no app).

Entrar em contato conosco para dúvidas sobre privacidade.

7. Uso do Aplicativo

O profissional é responsável pela veracidade e adequação das informações inseridas (dados de pacientes, valores de pagamentos, anotações).

É proibido usar o app para fins ilícitos, ofensivos ou que violem a privacidade de terceiros.

O app é de uso profissional, e o usuário deve seguir a legislação e normas aplicáveis à sua prática (ex.: Código de Ética Profissional).

8. Conteúdos de Terceiros

O app pode exibir links ou integrações (ex.: envio de lembretes por e-mail, integrações de calendário). Nesses casos, aplicam-se as políticas de privacidade dos serviços terceiros.
Não nos responsabilizamos pelo conteúdo, disponibilidade ou precisão desses serviços externos.

9. Limitação de Responsabilidade

O Agenda Psi é fornecido “como está”.
Não nos responsabilizamos por:

Indisponibilidades temporárias do serviço.

Perdas ou danos resultantes de uso incorreto ou não autorizado.

Informações incompletas ou desatualizadas inseridas pelo próprio usuário.

O app é uma ferramenta de apoio administrativo, e não substitui prontuários clínicos obrigatórios nem sistemas de gestão exigidos por órgãos de classe.

10. Alterações

Podemos atualizar funcionalidades e este documento a qualquer momento.
Em caso de mudanças relevantes na forma de tratamento de dados, notificaremos os usuários pelo app ou por e-mail (quando informado).

Responsável: DabLab Tecnologia
Contato: alexandre@dablab.com.br
`;
