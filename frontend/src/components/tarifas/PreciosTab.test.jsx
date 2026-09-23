import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreciosTab from './PreciosTab';

const SERVICIOS = [{ id: 'carpa', label: 'Carpas' }];
const PERIODOS = [
  { id: 1, nombre: 'Alta', mesInicio: 12, diaInicio: 15, mesFin: 3, diaFin: 15, prioridad: 1 },
  { id: 2, nombre: 'Baja', mesInicio: 3, diaInicio: 16, mesFin: 12, diaFin: 14, prioridad: 1 }
];
const SECTORES = [{ id: 3, serviceType: 'carpa', nombre: 'Terraza', color: '#F97316', unidades: [118] }];
const GENERAL_ALTA = { id: 20, serviceType: 'carpa', alcance: 'tipo', sectorId: null, resourceNumber: null, clase: 'fecha', periodoId: 1, precio: 14000 };

function renderizar(tarifas = [GENERAL_ALTA], ejecutar = vi.fn().mockResolvedValue('')) {
  render(<PreciosTab servicios={SERVICIOS} periodos={PERIODOS} sectores={SECTORES} tarifas={tarifas} ejecutar={ejecutar} />);
  return ejecutar;
}

describe('PreciosTab por fecha', () => {
  it('muestra la grilla con filas por alcance y columnas por periodo', () => {
    renderizar();
    expect(screen.getByLabelText('Todas las carpas · Alta')).toHaveValue('14000');
    expect(screen.getByLabelText('Terraza · Baja')).toHaveValue('');
  });

  it('una celda nueva crea la tarifa al salir', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Terraza · Alta'), '18000');
    await userEvent.tab();
    expect(ejecutar).toHaveBeenCalledWith('tarifas', {
      method: 'POST',
      body: { serviceType: 'carpa', alcance: 'sector', sectorId: 3, resourceNumber: null, clase: 'fecha', periodoId: 1, precio: 18000 }
    });
  }, 15000);

  it('cambiar una celda existente la edita y vaciarla la borra', async () => {
    const ejecutar = renderizar();
    const celda = screen.getByLabelText('Todas las carpas · Alta');
    await userEvent.clear(celda);
    await userEvent.type(celda, '15000');
    await userEvent.tab();
    expect(ejecutar).toHaveBeenCalledWith('tarifas/20', { method: 'PATCH', body: { precio: 15000 } });
    await userEvent.clear(celda);
    await userEvent.tab();
    expect(ejecutar).toHaveBeenLastCalledWith('tarifas/20', { method: 'DELETE' });
  }, 15000);

  it('agrega una fila para una unidad suelta', async () => {
    renderizar();
    await userEvent.type(screen.getByLabelText('Número de unidad'), '58');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar unidad' }));
    expect(screen.getByLabelText('Carpa 58 · Alta')).toBeInTheDocument();
  }, 15000);
});

describe('PreciosTab por estadia', () => {
  it('crea una tarifa de temporada completa a precio cerrado', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Nombre de la tarifa'), 'Temporada completa');
    await userEvent.type(screen.getByLabelText('Desde (días)'), '90');
    await userEvent.selectOptions(screen.getByLabelText('Cómo se cobra'), 'cerrado');
    await userEvent.type(screen.getByLabelText('Precio (ARS)'), '3500000');
    await userEvent.selectOptions(screen.getByLabelText('Solo si entra en'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tarifa por estadía' }));
    expect(ejecutar).toHaveBeenCalledWith('tarifas', {
      method: 'POST',
      body: { serviceType: 'carpa', alcance: 'tipo', sectorId: null, resourceNumber: null, clase: 'estadia', nombre: 'Temporada completa', diasMin: 90, diasMax: null, modo: 'cerrado', precio: 3500000, periodoId: 1 }
    });
  }, 15000);
});
