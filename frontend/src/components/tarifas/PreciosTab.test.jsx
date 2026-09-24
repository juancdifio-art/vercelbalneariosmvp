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
const ESTABLISHMENT = { carpasCapacity: 117, sombrillasCapacity: 220, parkingCapacity: 10, hasCarpas: true };

function renderizar(tarifas = [GENERAL_ALTA], ejecutar = vi.fn().mockResolvedValue(''), establishment = ESTABLISHMENT) {
  render(<PreciosTab servicios={SERVICIOS} periodos={PERIODOS} sectores={SECTORES} tarifas={tarifas} ejecutar={ejecutar} establishment={establishment} />);
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

  it('una tarifa con centavos se muestra con coma', () => {
    const TERRAZA_ALTA_CENTAVOS = { id: 21, serviceType: 'carpa', alcance: 'sector', sectorId: 3, resourceNumber: null, clase: 'fecha', periodoId: 1, precio: 14000.5 };
    renderizar([GENERAL_ALTA, TERRAZA_ALTA_CENTAVOS]);
    expect(screen.getByLabelText('Terraza · Alta')).toHaveValue('14000,5');
  });

  it('escribir con coma en una celda nueva crea la tarifa con centavos', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Terraza · Alta'), '18000,5');
    await userEvent.tab();
    expect(ejecutar).toHaveBeenCalledWith('tarifas', {
      method: 'POST',
      body: { serviceType: 'carpa', alcance: 'sector', sectorId: 3, resourceNumber: null, clase: 'fecha', periodoId: 1, precio: 18000.5 }
    });
  }, 15000);

  it('el punto se ignora al escribir en una celda', async () => {
    renderizar();
    await userEvent.type(screen.getByLabelText('Terraza · Alta'), '15.000');
    expect(screen.getByLabelText('Terraza · Alta')).toHaveValue('15000');
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

  it('el precio con puntos de miles se guarda entero', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Desde (días)'), '9a0');
    await userEvent.type(screen.getByLabelText('Hasta (días, vacío = sin tope)'), '1.20');
    await userEvent.type(screen.getByLabelText('Precio (ARS)'), '3.500.000');
    expect(screen.getByLabelText('Desde (días)')).toHaveValue('90');
    expect(screen.getByLabelText('Hasta (días, vacío = sin tope)')).toHaveValue('120');
    expect(screen.getByLabelText('Precio (ARS)')).toHaveValue('3500000');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tarifa por estadía' }));
    expect(ejecutar).toHaveBeenCalledWith('tarifas', expect.objectContaining({
      body: expect.objectContaining({ diasMin: 90, diasMax: 120, precio: 3500000 })
    }));
  }, 15000);

  it('el precio de la estadia acepta una coma decimal', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Desde (días)'), '3');
    await userEvent.type(screen.getByLabelText('Precio (ARS)'), '12000,5,0');
    expect(screen.getByLabelText('Precio (ARS)')).toHaveValue('12000,50');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tarifa por estadía' }));
    expect(ejecutar).toHaveBeenCalledWith('tarifas', expect.objectContaining({ body: expect.objectContaining({ precio: 12000.5 }) }));
  }, 15000);

  it('una unidad que no existe en el plano no llama a ejecutar', async () => {
    const ejecutar = renderizar();
    await userEvent.type(screen.getByLabelText('Desde (días)'), '90');
    await userEvent.type(screen.getByLabelText('Precio (ARS)'), '3500000');
    await userEvent.selectOptions(screen.getByLabelText('Aplica a'), 'unidad');
    await userEvent.type(screen.getByLabelText('Unidad'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar tarifa por estadía' }));
    expect(ejecutar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('La carpa 5 no está en el plano.');
  }, 15000);
});

describe('PreciosTab valida unidades contra el plano', () => {
  it('agregar una carpa que no existe en el plano (huecos 4-11) muestra el error y no crea la fila', async () => {
    renderizar();
    await userEvent.type(screen.getByLabelText('Número de unidad'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar unidad' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La carpa 5 no está en el plano.');
    expect(screen.queryByLabelText('Carpa 5 · Alta')).not.toBeInTheDocument();
  }, 15000);

  it('agregar una carpa que existe en el plano crea la fila', async () => {
    renderizar();
    await userEvent.type(screen.getByLabelText('Número de unidad'), '58');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar unidad' }));
    expect(screen.getByLabelText('Carpa 58 · Alta')).toBeInTheDocument();
  }, 15000);
});
