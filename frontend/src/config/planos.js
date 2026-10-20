/**
 * Planos dibujados, uno por balneario.
 *
 * El establecimiento guarda la clave de su plano (`establishments.plano`) y el
 * dibujo vive en el codigo: lo hacemos nosotros en el onboarding de cada
 * balneario. Un balneario sin plano numera carpas y sombrillas de 1 a la
 * capacidad configurada y no muestra el dibujo.
 *
 * Hoy hay uno solo, el de Zeus (`PlanoBalneario` lo dibuja). Un segundo plano
 * suma su clave aca y su propio dibujo.
 */
import { NUMEROS_CARPAS, NUMEROS_SOMBRILLAS } from './planoZeus';

const PLANOS = {
  zeus: { nombre: 'Balneario Zeus', carpa: NUMEROS_CARPAS, sombrilla: NUMEROS_SOMBRILLAS }
};

/** El plano del establecimiento, o null si no tiene. */
export function planoDe(establishment) {
  return PLANOS[establishment?.plano] || null;
}
