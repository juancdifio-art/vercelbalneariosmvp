/*
 * Plano del Balneario Zeus, relevado de docs/Plano foto.jpeg.
 * Lo usan plano-zeus.html (completo), plano-carpas.html y plano-sombrillas.html.
 *
 *   PlanoZeus.dibujar(svg, { vista: 'completo' | 'carpas' | 'sombrillas' })
 *     -> devuelve la lista de unidades dibujadas.
 *   PlanoZeus.cubrePantalla(boton)
 *     -> engancha un boton que abre el plano completo a pantalla entera.
 */
(function () {
  'use strict';

  function rango(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }

  // ---------------------------------------------------------------------
  // Relevamiento. Coordenadas en un lienzo de 1290 x 900.
  // ---------------------------------------------------------------------
  var CARPA = { w: 36, h: 15, paso: 17 };   // celda y paso vertical dentro de una columna
  var SOMB  = { r: 11, dx: 32, dy: 40 };    // radio y paso entre sombrillas

  var PLANO = {
    // Columnas de carpas: la pila arranca en (x, y) y la "suelta" va al pie,
    // dejando una celda de aire, igual que en el original.
    columnasCarpas: [
      // mitad izquierda (bajo las terrazas)
      { x: 232, y: 207, nums: rango(118, 122), suelta: 123, marcaX: true },
      { x: 322, y: 207, nums: rango(112, 117), suelta: 124, marcaX: true },
      { x: 412, y: 207, nums: rango(105, 111), suelta: 125 },
      { x: 488, y: 207, nums: rango(97, 104),  suelta: 126 },
      { x: 562, y: 207, nums: rango(89, 96),   suelta: 127 },
      // mitad derecha (bajo deck y restaurant)
      { x: 648,  y: 258, nums: rango(84, 88), suelta: 128, marcaX: true },
      { x: 718,  y: 258, nums: rango(71, 76), suelta: 129, marcaX: true },
      { x: 793,  y: 258, nums: rango(64, 70), suelta: 130 },
      { x: 868,  y: 258, nums: rango(56, 63), suelta: 131 },
      { x: 953,  y: 258, nums: rango(47, 55), suelta: 132 },
      { x: 1038, y: 258, nums: rango(37, 46), suelta: 133 },
      { x: 1113, y: 275, nums: rango(28, 36), suelta: 134 }
    ],

    // Carpas fuera del campo: en el quincho y sobre las terrazas.
    carpasSueltas: [
      { x: 86,  y: 258, w: 20, h: 24, num: 1 },
      { x: 108, y: 258, w: 20, h: 24, num: 2 },
      { x: 130, y: 258, w: 20, h: 24, num: 3 }
    ].concat(
      rango(12, 15).map(function (n, i) { return { x: 302 + i * 18, y: 118, w: 18, h: 30, num: n }; }),
      rango(16, 25).map(function (n, i) { return { x: 433 + i * 16.6, y: 118, w: 16.6, h: 30, num: n }; })
    ),

    // Bloques de sombrillas: cada fila es una lista de numeros, null es un hueco.
    // {n, dudosa} marca una que no se ve en la foto.
    bloquesSombrillas: [
      { x: 68, y: 418, filas: [
        [null, null, 203, 204, 205],
        [214, 206, 202, 201, 200, 199, 198, 197, 196, 195],
        [213, 207, 169, 168, 167, 166, 165, 164, 163, 162],
        [212, 208, 136, 135, 134, 133, 132, 131, 130, 129],
        [211, 103, 102, 101, 100,  99,  98,  97,  96,  95],
        [210,  69,  68,  67,  66,  65,  64,  63,  62,  61],
        [ 35,  34,  33,  32,  31,  30,  29,  28,  27,  26],
        [{ n: 209, dudosa: true }]
      ]},
      { x: 386, y: 470, filas: [
        [194, 193, 192, 191, 190, 189, 188, 187],
        [161, 160, 159, 158, 157, 156, 155, 154],
        [128, 127, 126, 125, 124, 123, 122, 121],
        [ 94,  93,  92,  91,  90,  89,  88,  87],
        [ 60,  59,  58,  57,  56,  55,  54,  53],
        [ 25,  24,  23,  22,  21,  20,  19,  18]
      ]},
      { x: 652, y: 505, filas: [
        [186, 185, 184, 183, 182, 181, 180, 179],
        [153, 152, 151, 150, 149, 148, 147, 146],
        [120, 119, 118, 117, 116, 115, 114, 113],
        [ 86,  85,  84,  83,  82,  81,  80,  79],
        [ 52,  51,  50,  49,  48,  47,  46,  45],
        [ 17,  16,  15,  14,  13,  12,  11,  10]
      ]},
      { x: 918, y: 540, filas: [
        [178, 177, 176, 175, 174, 173, 172, 171, 170, 220],
        [145, 144, 143, 142, 141, 140, 139, 138, 137, 219],
        [112, 111, 110, 109, 108, 107, 106, 105, 104, 218],
        [ 78,  77,  76,  75,  74,  73,  72,  71,  70, 217],
        [ 44,  43,  42,  41, 216,  40,  39,  38,  37,  36],
        [215,   9,   8,   7,   6,   5,   4,   3,   2,   1]
      ]}
    ],

    duchas: [
      { x: 706, y: 233, r: 8 }, { x: 740, y: 233, r: 8 }, { x: 774, y: 233, r: 8 }, // bajo el deck
      { x: 212, y: 400, r: 11 },
      { x: 396, y: 396, r: 12, rotulo: 'ducha' },
      { x: 601, y: 384, r: 8 },
      { x: 832, y: 446, r: 12, rotulo: 'ducha' },
      { x: 1165, y: 522, r: 9 }
    ],

    accesosPlaya: [
      { x: 304, y: 792 }, { x: 600, y: 796 }, { x: 900, y: 800 }
    ]
  };

  // Recorte del lienzo que muestra cada vista.
  var VISTAS = {
    completo:   { viewBox: '0 0 1290 900',    carpas: true,  sombrillas: true  },
    carpas:     { viewBox: '66 30 1120 445',  carpas: true,  sombrillas: false },
    sombrillas: { viewBox: '50 370 1200 530', carpas: false, sombrillas: true  }
  };

  // ---------------------------------------------------------------------
  // Dibujo
  // ---------------------------------------------------------------------
  var NS = 'http://www.w3.org/2000/svg';
  var contador = 0;

  function add(parent, tag, attrs, texto) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (texto != null) n.textContent = texto;
    parent.appendChild(n);
    return n;
  }

  function dibujar(svg, opciones) {
    var vista = VISTAS[(opciones && opciones.vista) || 'completo'];
    var sufijo = '-' + (++contador);   // ids unicos si hay dos planos en la pagina
    var unidades = [];

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', vista.viewBox);
    svg.classList.add('plano');

    var defs = add(svg, 'defs', {});
    var hatch = add(defs, 'pattern', { id: 'hatch' + sufijo, patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' });
    add(hatch, 'line', { x1: 0, y1: 0, x2: 0, y2: 4, style: 'stroke: var(--linea); stroke-width: 1' });
    var marker = add(defs, 'marker', { id: 'punta' + sufijo, viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' });
    add(marker, 'path', { d: 'M 0 0 L 10 5 L 0 10 z', style: 'fill: var(--linea)' });

    var fondo = add(svg, 'g', {});
    var capaCarpas = add(svg, 'g', {});
    var capaSomb = add(svg, 'g', {});
    var escalera = 'fill: url(#hatch' + sufijo + ')';

    // Titulo
    add(fondo, 'text', { x: 200, y: 58, 'class': 'titulo' }, 'BALNEARIO ZEUS');
    var t = add(fondo, 'text', { x: 1060, y: 58, 'class': 'temporada', 'text-anchor': 'end' }, 'TEMPORADA ');
    add(t, 'tspan', {}, '2025-2026');
    add(fondo, 'text', { x: 240, y: 86, 'class': 'rotulo' }, 'QUIOSCO');
    add(fondo, 'text', { x: 438, y: 86, 'class': 'rotulo' }, 'VESTUARIOS');

    // Borde del predio
    add(fondo, 'path', { 'class': 'borde-plano', d: 'M 200 96 H 1240 V 852 H 62 V 130' });

    // Caminos
    [
      [216, 191, 392, 9],    // bajo las terrazas
      [632, 241, 496, 9],    // bajo deck y restaurant
      [606, 96, 26, 756],    // central
      [62, 384, 546, 12],    // sobre las sombrillas, izquierda
      [632, 462, 608, 11],   // sobre las sombrillas, derecha
      [356, 396, 6, 456],    // entre bloques izquierdo y medio
      [884, 473, 6, 379]     // entre bloques derecho y del fondo
    ].forEach(function (c) { add(fondo, 'rect', { x: c[0], y: c[1], width: c[2], height: c[3], 'class': 'camino' }); });
    add(fondo, 'line', { x1: 362, y1: 418, x2: 606, y2: 418, 'class': 'linea' });
    add(fondo, 'line', { x1: 385, y1: 200, x2: 385, y2: 384, 'class': 'linea' });

    // Quincho
    add(fondo, 'rect', { x: 80, y: 130, width: 86, height: 120, 'class': 'edificio' });
    add(fondo, 'text', { x: 123, y: 195, 'class': 'rotulo' }, 'QUINCHO');

    // Terrazas y escalera
    add(fondo, 'rect', { x: 200, y: 115, width: 180, height: 65, 'class': 'edificio' });
    add(fondo, 'text', { x: 275, y: 170, 'class': 'rotulo' }, 'TERRAZA');
    add(fondo, 'rect', { x: 380, y: 148, width: 46, height: 32, 'class': 'escalera', style: escalera });
    add(fondo, 'line', { x1: 403, y1: 148, x2: 403, y2: 180, 'class': 'linea' });
    add(fondo, 'rect', { x: 426, y: 115, width: 176, height: 65, 'class': 'edificio' });
    add(fondo, 'text', { x: 514, y: 170, 'class': 'rotulo' }, 'TERRAZA');

    // Admin y pasillo de entrada
    add(fondo, 'rect', { x: 602, y: 44, width: 62, height: 60, 'class': 'edificio' });
    add(fondo, 'text', { x: 633, y: 78, 'class': 'rotulo' }, 'ADMIN');
    add(fondo, 'rect', { x: 620, y: 104, width: 28, height: 22, 'class': 'edificio' });
    add(fondo, 'line', { x1: 619, y1: 186, x2: 619, y2: 142, 'class': 'flecha', 'marker-end': 'url(#punta' + sufijo + ')' });

    // Deposito
    add(fondo, 'rect', { x: 652, y: 118, width: 36, height: 114, 'class': 'edificio deposito' });
    add(fondo, 'text', { x: 670, y: 175, 'class': 'rotulo', transform: 'rotate(-90 670 175)' }, 'DEPOSITO');

    // Deck
    add(fondo, 'rect', { x: 690, y: 182, width: 128, height: 40, 'class': 'edificio' });
    add(fondo, 'text', { x: 754, y: 208, 'class': 'rotulo' }, 'DECK');
    add(fondo, 'rect', { x: 818, y: 178, width: 32, height: 22, 'class': 'escalera', style: escalera });
    add(fondo, 'text', { x: 790, y: 237, 'class': 'rotulo-chico' }, 'duchas');

    // Piscina y restaurant
    add(fondo, 'rect', { x: 850, y: 108, width: 240, height: 54, 'class': 'edificio pileta' });
    add(fondo, 'text', { x: 970, y: 140, 'class': 'rotulo' }, 'PISCINA');
    add(fondo, 'rect', { x: 856, y: 182, width: 264, height: 40, 'class': 'edificio' });
    add(fondo, 'text', { x: 988, y: 208, 'class': 'rotulo' }, 'RESTAURANT');
    add(fondo, 'rect', { x: 1068, y: 222, width: 44, height: 14, 'class': 'escalera', style: escalera });

    // Duchas
    PLANO.duchas.forEach(function (d) {
      add(fondo, 'circle', { cx: d.x, cy: d.y, r: d.r, 'class': 'ducha' });
      if (d.rotulo) add(fondo, 'text', { x: d.x + d.r + 3, y: d.y + 4, 'class': 'rotulo-chico' }, d.rotulo);
    });

    // Accesos a la playa
    PLANO.accesosPlaya.forEach(function (a) {
      add(fondo, 'rect', { x: a.x, y: a.y, width: 18, height: 36, 'class': 'edificio' });
      add(fondo, 'text', { x: a.x + 24, y: a.y + 24, 'class': 'rotulo-chico', style: 'font-size:12px;font-weight:600' }, 'acceso playa');
    });
    add(fondo, 'text', { x: 651, y: 882, 'class': 'rotulo', style: 'fill: var(--tinta-soft)' }, '▼  PLAYA');

    // Marcas x del original
    PLANO.columnasCarpas.forEach(function (c) {
      if (c.marcaX) add(fondo, 'text', { x: c.x + CARPA.w / 2, y: c.y - 5, 'class': 'marca-x' }, '×');
    });

    function carpa(x, y, w, h, num) {
      var g = add(capaCarpas, 'g', { 'class': 'carpa', 'data-num': num });
      add(g, 'title', {}, 'Carpa ' + num);
      add(g, 'rect', { x: x, y: y, width: w, height: h });
      add(g, 'text', { x: x + w / 2, y: y + h / 2 + 3 }, num < 10 ? '0' + num : String(num));
      unidades.push({ tipo: 'carpa', num: num, x: Math.round(x + w / 2), y: Math.round(y + h / 2) });
    }

    function sombrilla(cx, cy, num, dudosa) {
      var g = add(capaSomb, 'g', { 'class': 'sombrilla' + (dudosa ? ' dudosa' : ''), 'data-num': num });
      add(g, 'title', {}, 'Sombrilla ' + num + (dudosa ? ' (no se ve en la foto)' : ''));
      add(g, 'circle', { cx: cx, cy: cy, r: SOMB.r });
      add(g, 'text', { x: cx, y: cy + 3 }, String(num));
      unidades.push({ tipo: 'sombrilla', num: num, x: Math.round(cx), y: Math.round(cy), dudosa: dudosa || undefined });
    }

    if (vista.carpas) {
      PLANO.columnasCarpas.forEach(function (c) {
        c.nums.forEach(function (n, i) { carpa(c.x, c.y + i * CARPA.paso, CARPA.w, CARPA.h, n); });
        carpa(c.x, c.y + (c.nums.length + 1) * CARPA.paso, CARPA.w, CARPA.h, c.suelta);
      });
      PLANO.carpasSueltas.forEach(function (c) { carpa(c.x, c.y, c.w, c.h, c.num); });
    }

    if (vista.sombrillas) {
      PLANO.bloquesSombrillas.forEach(function (b) {
        b.filas.forEach(function (fila, r) {
          fila.forEach(function (v, c) {
            if (v == null) return;
            var obj = typeof v === 'object';
            sombrilla(b.x + c * SOMB.dx, b.y + r * SOMB.dy, obj ? v.n : v, obj && !!v.dudosa);
          });
        });
      });
    }

    // Aviso en consola si un numero se repitio al transcribir.
    ['carpa', 'sombrilla'].forEach(function (tipo) {
      var vistos = {};
      unidades.forEach(function (u) {
        if (u.tipo !== tipo) return;
        if (vistos[u.num]) console.warn('Número repetido:', tipo, u.num);
        vistos[u.num] = true;
      });
    });

    return unidades;
  }

  // ---------------------------------------------------------------------
  // Plano completo a pantalla entera
  // ---------------------------------------------------------------------
  var cubre = null;

  function abrirCubre() {
    if (!cubre) {
      cubre = document.createElement('div');
      cubre.className = 'cubre';
      cubre.setAttribute('role', 'dialog');
      cubre.setAttribute('aria-modal', 'true');
      cubre.setAttribute('aria-label', 'Plano completo del balneario');
      cubre.innerHTML =
        '<div class="cubre-barra">' +
          '<h2>Balneario Zeus · plano completo</h2>' +
          '<button type="button" class="tool fuerte" data-cerrar>✕ Cerrar plano</button>' +
        '</div>' +
        '<div class="cubre-cuerpo"></div>';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', 'Plano completo del Balneario Zeus');
      cubre.querySelector('.cubre-cuerpo').appendChild(svg);
      dibujar(svg, { vista: 'completo' });
      cubre.querySelector('[data-cerrar]').addEventListener('click', cerrarCubre);
      document.body.appendChild(cubre);
    }
    cubre.hidden = false;
    document.body.classList.add('bloqueado');
    cubre.querySelector('[data-cerrar]').focus();
  }

  function cerrarCubre() {
    if (!cubre || cubre.hidden) return;
    cubre.hidden = true;
    document.body.classList.remove('bloqueado');
    if (cubre._origen) cubre._origen.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarCubre();
  });

  function cubrePantalla(boton) {
    boton.addEventListener('click', function () {
      abrirCubre();
      cubre._origen = boton;
    });
  }

  // ---------------------------------------------------------------------
  // Utilidades de pagina
  // ---------------------------------------------------------------------
  function descargarJSON(unidades, nombre) {
    var datos = { balneario: 'Zeus', temporada: '2025-2026', lienzo: [1290, 900], unidades: unidades };
    var blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  window.PlanoZeus = {
    plano: PLANO,
    dibujar: dibujar,
    cubrePantalla: cubrePantalla,
    descargarJSON: descargarJSON
  };
})();
