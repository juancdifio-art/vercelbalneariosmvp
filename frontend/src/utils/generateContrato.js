import { jsPDF } from 'jspdf';
import { format } from '../lib/dates';

// Contrato en A4 para imprimir y firmar. Recibe lo que arma lib/contrato.js.

const MARGEN = 18;
const ALTO_LINEA = 4.4;
const GRIS = [100, 116, 139];
// Lo que no se completo queda con puntos, para llenarlo a mano.
const PUNTOS = '..............................................................';

// Las fuentes base de jsPDF solo traen Latin-1: los guiones y comillas
// tipograficos salen como basura, asi que se pasan a sus versiones simples.
export function aTextoPdf(texto) {
  return String(texto ?? '')
    .replace(/[–—−]/g, '-')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '-')
    .replace(/[^\u0000-ÿ]/g, '');
}

export function generarContratoPdf(c, { guardar = true } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  let y = MARGEN;

  const asegurar = (lugar) => {
    if (y + lugar > alto - MARGEN) {
      doc.addPage();
      y = MARGEN;
    }
  };
  const texto = (t, x, opciones) => doc.text(aTextoPdf(t), x, y, opciones);

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...GRIS);
  texto(c.balneario.toUpperCase(), MARGEN);
  if (c.numero != null) {
    doc.setFont('helvetica', 'normal');
    texto(`Reserva N° ${c.numero}`, ancho - MARGEN, { align: 'right' });
  }
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  for (const linea of doc.splitTextToSize(aTextoPdf(c.titulo), util)) {
    texto(linea, ancho / 2, { align: 'center' });
    y += 6;
  }
  y += 3;

  const seccion = (nombre) => {
    asegurar(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    texto(nombre, MARGEN);
    y += 1.5;
    doc.setDrawColor(180, 180, 180);
    doc.line(MARGEN, y, ancho - MARGEN, y);
    y += 5;
  };

  const campos = (pares) => {
    doc.setFontSize(9.5);
    for (const [etiqueta, valor] of pares) {
      asegurar(ALTO_LINEA + 2);
      doc.setFont('helvetica', 'bold');
      texto(`${etiqueta}:`, MARGEN);
      doc.setFont('helvetica', 'normal');
      const lineas = doc.splitTextToSize(aTextoPdf(valor || PUNTOS), util - 32);
      for (const linea of lineas) {
        texto(linea, MARGEN + 32);
        y += ALTO_LINEA + 1;
      }
    }
    y += 2;
  };

  seccion('DATOS DEL TITULAR');
  campos(c.titular);

  seccion('CONTRATACIÓN');
  campos([...c.contratacion, ['Estacionamiento', c.cocheras.join('  /  ')]]);

  seccion('REGISTRO DE PERSONAS');
  doc.setFontSize(9.5);
  c.nomina.forEach((p, i) => {
    asegurar(ALTO_LINEA + 3);
    doc.setFont('helvetica', 'normal');
    texto(`${i + 1})  ${p.nombre || PUNTOS}`, MARGEN);
    texto(`DNI: ${p.dni || '......................'}`, MARGEN + util * 0.68);
    y += ALTO_LINEA + 2;
  });
  y += 3;

  if (c.condiciones.some((l) => l.texto.trim())) {
    seccion('CONDICIONES GENERALES');
    doc.setFontSize(8.8);
    for (const linea of c.condiciones) {
      if (!linea.texto.trim()) {
        y += ALTO_LINEA * 0.6;
        continue;
      }
      doc.setFont('helvetica', linea.negrita ? 'bold' : 'normal');
      for (const parte of doc.splitTextToSize(aTextoPdf(linea.texto), util)) {
        asegurar(ALTO_LINEA);
        texto(parte, MARGEN);
        y += ALTO_LINEA;
      }
    }
  }

  // Firma: va entera en la misma pagina.
  y += 6;
  asegurar(34);
  y += 18;
  doc.setDrawColor(0, 0, 0);
  doc.line(ancho - MARGEN - 75, y, ancho - MARGEN, y);
  doc.line(MARGEN, y, MARGEN + 60, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  texto('Firma y aclaración del contratante', ancho - MARGEN - 37.5, { align: 'center' });
  texto('Lugar y fecha', MARGEN + 30, { align: 'center' });

  // Pie con numero de pagina
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(aTextoPdf(`Emitido el ${format(new Date(), 'dd/MM/yyyy')} · Página ${i} de ${paginas}`), ancho / 2, alto - 8, { align: 'center' });
  }
  doc.setTextColor(0, 0, 0);

  if (guardar) {
    const unidad = c.contratacion[0]?.[1] || 'unidad';
    doc.save(`Contrato ${aTextoPdf(unidad)} ${format(new Date(), 'yyyyMMdd')}.pdf`);
  }
  return doc;
}
