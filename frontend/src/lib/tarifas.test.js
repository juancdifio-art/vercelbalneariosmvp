import { describe, it, expect } from 'vitest';
import {
  formatearPesos, aNumero, lineasDesglose, diferenciaAjuste, faltaMotivoAjuste,
  parseDiaMes, formatearDiaMes, filaCoincide, colorSuave, precioDesdeReserva
} from './tarifas';

describe('lineasDesglose', () => {
  it('describe los tramos por fecha', () => {
    const d = { clase: 'fecha', tramos: [
      { periodo: 'Baja', dias: 3, precioDia: 9000, subtotal: 27000 },
      { periodo: 'Alta', dias: 1, precioDia: 14000, subtotal: 14000 }
    ] };
    expect(lineasDesglose(d)).toEqual(['3 días Baja × $9.000 = $27.000', '1 día Alta × $14.000 = $14.000']);
  });
  it('describe una estadia cerrada y una por dia', () => {
    expect(lineasDesglose({ clase: 'estadia', nombre: 'Temporada completa', modo: 'cerrado', dias: 92, precio: 3500000, total: 3500000 }))
      .toEqual(['Temporada completa (precio cerrado, 92 días) = $3.500.000']);
    expect(lineasDesglose({ clase: 'estadia', nombre: 'Media temporada', modo: 'por_dia', dias: 60, precio: 12000, total: 720000 }))
      .toEqual(['Media temporada: 60 días × $12.000 = $720.000']);
  });
  it('sin desglose no hay lineas', () => {
    expect(lineasDesglose(null)).toEqual([]);
  });
});

describe('ajuste', () => {
  it('calcula la diferencia contra la tarifa', () => {
    expect(diferenciaAjuste({ precioTarifa: 30000, cobrado: '25000' })).toBe(-5000);
    expect(diferenciaAjuste({ precioTarifa: null, cobrado: '25000' })).toBe(0);
    expect(diferenciaAjuste({ precioTarifa: 30000, cobrado: '' })).toBe(0);
  });
  it('pide motivo solo si hay diferencia', () => {
    expect(faltaMotivoAjuste({ precioTarifa: 30000, cobrado: '25000', motivo: ' ' })).toBe(true);
    expect(faltaMotivoAjuste({ precioTarifa: 30000, cobrado: '25000', motivo: 'amigo' })).toBe(false);
    expect(faltaMotivoAjuste({ precioTarifa: 30000, cobrado: '30000', motivo: '' })).toBe(false);
    expect(faltaMotivoAjuste({ precioTarifa: null, cobrado: '1', motivo: '' })).toBe(false);
  });
});

describe('precioDesdeReserva', () => {
  it('conserva los centavos: no genera un ajuste falso', () => {
    const resultado = precioDesdeReserva({ precioTarifa: '9999.50', totalPrice: '9999.50', desglose: null, motivoAjuste: '' });
    expect(resultado.cobrado).toBe('9999.5');
    expect(resultado.precioTarifa).toBe(9999.5);
    expect(faltaMotivoAjuste(resultado)).toBe(false);
  });
  it('sin totales guardados, deja el precio vacio', () => {
    const resultado = precioDesdeReserva({ precioTarifa: null, totalPrice: null, desglose: null, motivoAjuste: null });
    expect(resultado.cobrado).toBe('');
    expect(resultado.precioTarifa).toBeNull();
  });
});

describe('dia/mes', () => {
  it('parsea y formatea', () => {
    expect(parseDiaMes('15/12')).toEqual({ dia: 15, mes: 12 });
    expect(parseDiaMes(' 1/3 ')).toEqual({ dia: 1, mes: 3 });
    expect(parseDiaMes('31/04')).toBeNull();
    expect(parseDiaMes('diciembre')).toBeNull();
    expect(formatearDiaMes(3, 1)).toBe('01/03');
  });
});

describe('varios', () => {
  it('aNumero y formatearPesos', () => {
    expect(aNumero('')).toBeNull();
    expect(aNumero('1500,5')).toBe(1500.5);
    expect(formatearPesos(55000)).toBe('$55.000');
  });
  it('filaCoincide compara el alcance', () => {
    expect(filaCoincide({ alcance: 'tipo' }, { alcance: 'tipo' })).toBe(true);
    expect(filaCoincide({ alcance: 'sector', sectorId: 3 }, { alcance: 'sector', sectorId: 4 })).toBe(false);
    expect(filaCoincide({ alcance: 'unidad', resourceNumber: 58 }, { alcance: 'unidad', resourceNumber: 58 })).toBe(true);
  });
  it('colorSuave devuelve el tono claro de la paleta', () => {
    expect(colorSuave('#0EA5E9')).toBe('#BAE6FD');
    expect(colorSuave('#123456')).toBe('#E2E8F0');
  });
});
