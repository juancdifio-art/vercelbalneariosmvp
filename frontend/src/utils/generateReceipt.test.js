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

describe('comprobante de la cuenta completa', () => {
  it('suma la carpa, la cochera y la pileta paga, y el saldo es el de toda la cuenta', () => {
    generateReceipt({
      ...CARPA, totalPrice: '100000', paidAmount: 100000,
      payments: [
        { amount: 50000, paymentDate: '2026-10-06', method: 'cash' },
        { amount: 60000, paymentDate: '2026-10-07', method: 'transfer' }
      ],
      vinculadas: [
        { id: 501, serviceType: 'pileta', vinculo: 'incluido', paseNombres: ['Lucia'], totalPrice: '0', paidAmount: 0 },
        { id: 502, serviceType: 'parking', vinculo: 'incluido', resourceNumber: 1, vehiclePlate: 'AE512KD', totalPrice: '25000', paidAmount: 10000 },
        { id: 503, serviceType: 'pileta', vinculo: 'adicional', paseNombres: ['Marta'], totalPrice: '30000', paidAmount: 0 }
      ]
    }, { name: 'Zeus', hasPileta: true });
    const textos = globalThis.ultimoPdf.textos;
    const tras = (etiqueta) => textos[textos.indexOf(etiqueta) + 1];

    expect(textos.join(' | ')).toContain('Pileta paga:');
    expect(tras('Total de la cuenta:')).toBe('$155.000,00');
    expect(tras('Total a Pagar:')).toBe('$155.000,00');
    expect(tras('Total Pagado:')).toBe('$110.000,00');
    expect(textos.join(' | ')).toContain('SALDO: $45.000,00');
  });

  it('una reserva sin nada asociado sale como antes', () => {
    generateReceipt({ ...CARPA, vinculadas: [], paidAmount: 0 }, { name: 'Zeus' });
    const textos = globalThis.ultimoPdf.textos;
    expect(textos).not.toContain('Total de la cuenta:');
    expect(textos[textos.indexOf('Total a Pagar:') + 1]).toBe('$100.000,00');
  });
});
