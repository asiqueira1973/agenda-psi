import { paginaInicial } from '../src/rules/auth-copy.js';
import { destinoDaRaiz } from './route.js';

/**
 * Página `/` (6.3): destino do link de confirmação de cadastro do app. Mostra o texto
 * aprovado (24.8). Se chegar com `?authorization_id=`, é o authorize do OAuth que caiu
 * na raiz (barra dupla da Site URL, 6.3): encaminha para `/oauth/consent`.
 */
const destino = destinoDaRaiz(location.search);
if (destino) location.replace(destino);
else document.getElementById('texto')!.textContent = paginaInicial.texto;
