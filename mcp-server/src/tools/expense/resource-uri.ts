import { createHash } from 'node:crypto';
import { DESPESA_HTML } from '../../ui/generated.js';

/**
 * Endereço do formulário de despesa, VERSIONADO pelo conteúdo (épico 3, aprovado em
 * 15/11/2026). O Claude guardava em cache o HTML de `ui://agenda-psi/despesa.html` e
 * seguia mostrando a tela antiga depois do deploy. Com o hash do HTML no endereço, cada
 * mudança da tela gera um endereço novo, e o host é obrigado a buscar de novo. Diverge
 * da 13.1, que fixava `ui://agenda-psi/<acao>.html`.
 */
export const DESPESA_RESOURCE_URI = `ui://agenda-psi/despesa-${createHash('sha256').update(DESPESA_HTML).digest('hex').slice(0, 12)}.html`;
