/**
 * Plano del Balneario Zeus, temporada 2025-2026.
 *
 * Relevado de la foto del plano en papel (docs/Plano foto.jpeg). La version
 * navegable fuera de la app esta en docs/plano-zeus.html.
 *
 * Con el plano activo, las unidades de carpas y sombrillas salen de aca y no
 * de la capacidad configurada: las carpas del plano van del 1 al 134 pero son
 * 117, porque faltan la 4 a la 11, la 26, la 27 y la 77 a la 83. Armar la
 * lista como 1..capacidad dejaria afuera a la 118-134.
 *
 * Coordenadas en un lienzo de 1290 x 900.
 */

// El sistema es de Zeus. Si algun dia se usa en otro balneario, esto pasa a
// depender del establecimiento.
export const PLANO_ACTIVO = true;

function rango(a, b) {
  const o = [];
  for (let i = a; i <= b; i += 1) o.push(i);
  return o;
}

export const CARPA = { w: 36, h: 15, paso: 17 };
export const SOMB = { r: 11, dx: 32, dy: 40 };

// Columnas de carpas: la pila arranca en (x, y) y la "suelta" va al pie,
// dejando una celda de aire, igual que en el original.
const COLUMNAS_CARPAS = [
  // mitad izquierda (bajo las terrazas)
  { x: 232, y: 207, nums: rango(118, 122), suelta: 123, marcaX: true },
  { x: 322, y: 207, nums: rango(112, 117), suelta: 124, marcaX: true },
  { x: 412, y: 207, nums: rango(105, 111), suelta: 125 },
  { x: 488, y: 207, nums: rango(97, 104), suelta: 126 },
  { x: 562, y: 207, nums: rango(89, 96), suelta: 127 },
  // mitad derecha (bajo deck y restaurant)
  { x: 648, y: 258, nums: rango(84, 88), suelta: 128, marcaX: true },
  { x: 718, y: 258, nums: rango(71, 76), suelta: 129, marcaX: true },
  { x: 793, y: 258, nums: rango(64, 70), suelta: 130 },
  { x: 868, y: 258, nums: rango(56, 63), suelta: 131 },
  { x: 953, y: 258, nums: rango(47, 55), suelta: 132 },
  { x: 1038, y: 258, nums: rango(37, 46), suelta: 133 },
  { x: 1113, y: 275, nums: rango(28, 36), suelta: 134 }
];

// Carpas fuera del campo: en el quincho y sobre las terrazas.
const CARPAS_SUELTAS = [
  { x: 86, y: 258, w: 20, h: 24, num: 1 },
  { x: 108, y: 258, w: 20, h: 24, num: 2 },
  { x: 130, y: 258, w: 20, h: 24, num: 3 },
  ...rango(12, 15).map((num, i) => ({ x: 302 + i * 18, y: 118, w: 18, h: 30, num })),
  ...rango(16, 25).map((num, i) => ({ x: 433 + i * 16.6, y: 118, w: 16.6, h: 30, num }))
];

// Bloques de sombrillas: cada fila es una lista de numeros, null es un hueco.
// { n, dudosa } marca una que no se ve en la foto.
const BLOQUES_SOMBRILLAS = [
  { x: 68, y: 418, filas: [
    [null, null, 203, 204, 205],
    [214, 206, 202, 201, 200, 199, 198, 197, 196, 195],
    [213, 207, 169, 168, 167, 166, 165, 164, 163, 162],
    [212, 208, 136, 135, 134, 133, 132, 131, 130, 129],
    [211, 103, 102, 101, 100, 99, 98, 97, 96, 95],
    [210, 69, 68, 67, 66, 65, 64, 63, 62, 61],
    [35, 34, 33, 32, 31, 30, 29, 28, 27, 26],
    [{ n: 209, dudosa: true }]
  ] },
  { x: 386, y: 470, filas: [
    [194, 193, 192, 191, 190, 189, 188, 187],
    [161, 160, 159, 158, 157, 156, 155, 154],
    [128, 127, 126, 125, 124, 123, 122, 121],
    [94, 93, 92, 91, 90, 89, 88, 87],
    [60, 59, 58, 57, 56, 55, 54, 53],
    [25, 24, 23, 22, 21, 20, 19, 18]
  ] },
  { x: 652, y: 505, filas: [
    [186, 185, 184, 183, 182, 181, 180, 179],
    [153, 152, 151, 150, 149, 148, 147, 146],
    [120, 119, 118, 117, 116, 115, 114, 113],
    [86, 85, 84, 83, 82, 81, 80, 79],
    [52, 51, 50, 49, 48, 47, 46, 45],
    [17, 16, 15, 14, 13, 12, 11, 10]
  ] },
  { x: 918, y: 540, filas: [
    [178, 177, 176, 175, 174, 173, 172, 171, 170, 220],
    [145, 144, 143, 142, 141, 140, 139, 138, 137, 219],
    [112, 111, 110, 109, 108, 107, 106, 105, 104, 218],
    [78, 77, 76, 75, 74, 73, 72, 71, 70, 217],
    [44, 43, 42, 41, 216, 40, 39, 38, 37, 36],
    [215, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  ] }
];

function armarCarpas() {
  const out = [];
  COLUMNAS_CARPAS.forEach((c) => {
    c.nums.forEach((num, i) => {
      out.push({ num, x: c.x, y: c.y + i * CARPA.paso, w: CARPA.w, h: CARPA.h });
    });
    out.push({ num: c.suelta, x: c.x, y: c.y + (c.nums.length + 1) * CARPA.paso, w: CARPA.w, h: CARPA.h });
  });
  CARPAS_SUELTAS.forEach((c) => out.push({ ...c }));
  return out.sort((a, b) => a.num - b.num);
}

function armarSombrillas() {
  const out = [];
  BLOQUES_SOMBRILLAS.forEach((b) => {
    b.filas.forEach((fila, r) => {
      fila.forEach((v, c) => {
        if (v == null) return;
        const obj = typeof v === 'object';
        out.push({
          num: obj ? v.n : v,
          cx: b.x + c * SOMB.dx,
          cy: b.y + r * SOMB.dy,
          dudosa: obj && Boolean(v.dudosa)
        });
      });
    });
  });
  return out.sort((a, b) => a.num - b.num);
}

export const CARPAS_PLANO = armarCarpas();
export const SOMBRILLAS_PLANO = armarSombrillas();

export const MARCAS_X = COLUMNAS_CARPAS
  .filter((c) => c.marcaX)
  .map((c) => ({ x: c.x + CARPA.w / 2, y: c.y - 5 }));

export const DUCHAS = [
  { x: 706, y: 233, r: 8 }, { x: 740, y: 233, r: 8 }, { x: 774, y: 233, r: 8 }, // bajo el deck
  { x: 212, y: 400, r: 11 },
  { x: 396, y: 396, r: 12, rotulo: 'ducha' },
  { x: 601, y: 384, r: 8 },
  { x: 832, y: 446, r: 12, rotulo: 'ducha' },
  { x: 1165, y: 522, r: 9 }
];

export const ACCESOS_PLAYA = [{ x: 304, y: 792 }, { x: 600, y: 796 }, { x: 900, y: 800 }];

// [x, y, ancho, alto]
export const CAMINOS = [
  [216, 191, 392, 9], // bajo las terrazas
  [632, 241, 496, 9], // bajo deck y restaurant
  [606, 96, 26, 756], // central
  [62, 384, 546, 12], // sobre las sombrillas, izquierda
  [632, 462, 608, 11], // sobre las sombrillas, derecha
  [356, 396, 6, 456], // entre bloques izquierdo y medio
  [884, 473, 6, 379] // entre bloques derecho y del fondo
];

// Recorte del lienzo que muestra cada vista.
export const VISTAS = {
  completo: { viewBox: '0 0 1290 900', carpas: true, sombrillas: true },
  carpas: { viewBox: '66 30 1120 440', carpas: true, sombrillas: false },
  sombrillas: { viewBox: '50 370 1200 530', carpas: false, sombrillas: true }
};

export const NUMEROS_CARPAS = CARPAS_PLANO.map((c) => c.num);
export const NUMEROS_SOMBRILLAS = SOMBRILLAS_PLANO.map((s) => s.num);
