import { describe, it, expect, vi } from 'vitest';

// jsPDF simulado: registra los textos que se escriben y acepta cualquier otro metodo.
vi.mock('jspdf', () => {
  class JsPDF {
    constructor() {
      this.textos = [];
      globalThis.ultimoPdf = this;
      return new Proxy(this, {
        get(target, clave) {
          if (clave in target) return target[clave];
          if (clave === 'internal') {
            return { pageSize: { getWidth: () => 80, getHeight: () => 297, width: 80, height: 297 } };
          }
          return () => 10;
        }
      });
    }

    text(texto) {
      this.textos.push(Array.isArray(texto) ? texto.join(' ') : String(texto));
    }

    splitTextToSize(texto) {
      return [String(texto)];
    }
  }
  return { jsPDF: JsPDF, default: JsPDF };
});

const { generateReceipt } = await import('./generateReceipt');

const CARPA = {
  id: 60, serviceType: 'carpa', resourceNumber: 12, startDate: '2026-12-01', endDate: '2026-12-05',
  customerName: 'Lucia', totalPrice: '100000', paidAmount: 0, payments: [],
  vinculadas: [
    { id: 501, serviceType: 'pileta', vinculo: 'incluido', paseNombres: ['Lucia', 'Ana'] },
    { id: 502, serviceType: 'parking', vinculo: 'incluido', resourceNumber: 45, vehiclePlate: 'AB123CD', totalPrice: '700000', paidAmount: 700000 },
    { id: 503, serviceType: 'pileta', vinculo: 'adicional', paseNombres: ['Caro'] }
  ]
};

describe('comprobante de una carpa con servicios incluidos', () => {
  it('lista la pileta incluida con sus personas y cada cochera', () => {
    generateReceipt(CARPA, { name: 'Zeus', hasPileta: true });
    const textos = globalThis.ultimoPdf.textos.join(' | ');

    expect(textos).toContain('Pileta incluida:');
    expect(textos).toContain('4 pases (Lucia, Ana)');
    expect(textos).toContain('Cochera incluida:');
    expect(textos).toContain('Plaza 45, AB 123 CD');
  });
});
