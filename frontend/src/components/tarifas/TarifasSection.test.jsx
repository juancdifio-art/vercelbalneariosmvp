import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TarifasSection from './TarifasSection';

const ALTA = { id: 1, nombre: 'Temporada alta', mesInicio: 12, diaInicio: 15, mesFin: 3, diaFin: 15, prioridad: 1 };
const DIAS_POR_MES_2024 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const calendario = [];
{
  let i = 0;
  for (let mes = 1; mes <= 12; mes++) {
    for (let dia = 1; dia <= DIAS_POR_MES_2024[mes - 1]; dia++) {
      calendario.push({ mes, dia, periodoId: i % 2 ? 1 : null });
      i++;
    }
  }
}

let respuestas;
beforeEach(() => {
  respuestas = {
    'GET tarifas/periodos': { periodos: [ALTA], calendario },
    'GET tarifas/sectores': { sectores: [] },
    'GET tarifas': { tarifas: [] }
  };
  global.fetch = vi.fn((url, opciones = {}) => {
    const ruta = String(url).split('/api/')[1].split('?')[0];
    const clave = `${opciones.method || 'GET'} ${ruta}`;
    const cuerpo = respuestas[clave] ?? { error: 'periodo_superpuesto' };
    return Promise.resolve({ ok: !cuerpo.error, status: cuerpo.error ? 409 : 200, json: () => Promise.resolve(cuerpo) });
  });
});
afterEach(() => vi.restoreAllMocks());

const EST = { hasCarpas: true, hasSombrillas: true, hasParking: true, parkingCapacity: 10 };

describe('TarifasSection: periodos', () => {
  it('lista los periodos con sus fechas', async () => {
    render(<TarifasSection establishment={EST} />);
    const fila = await screen.findByRole('row', { name: /Temporada alta/ });
    expect(within(fila).getByText('15/12 → 15/03')).toBeInTheDocument();
  });

  it('crea un periodo con dia/mes', async () => {
    respuestas['POST tarifas/periodos'] = { periodo: { id: 2 } };
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    await userEvent.type(screen.getByLabelText('Nombre del período'), 'Navidad');
    await userEvent.type(screen.getByLabelText('Desde (día/mes)'), '24/12');
    await userEvent.type(screen.getByLabelText('Hasta (día/mes)'), '26/12');
    await userEvent.clear(screen.getByLabelText('Prioridad'));
    await userEvent.type(screen.getByLabelText('Prioridad'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar período' }));
    const post = global.fetch.mock.calls.find((c) => c[1]?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ nombre: 'Navidad', mesInicio: 12, diaInicio: 24, mesFin: 12, diaFin: 26, prioridad: 10 });
  }, 15000);

  it('muestra el error del servidor en castellano', async () => {
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    await userEvent.type(screen.getByLabelText('Nombre del período'), 'Enero');
    await userEvent.type(screen.getByLabelText('Desde (día/mes)'), '1/1');
    await userEvent.type(screen.getByLabelText('Hasta (día/mes)'), '31/1');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar período' }));
    expect(await screen.findByText('Ya hay un período con la misma prioridad en esas fechas. Subile la prioridad al más específico.')).toBeInTheDocument();
  }, 15000);

  it('valida el formato dia/mes antes de mandar', async () => {
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    await userEvent.type(screen.getByLabelText('Nombre del período'), 'X');
    await userEvent.type(screen.getByLabelText('Desde (día/mes)'), 'diciembre');
    await userEvent.type(screen.getByLabelText('Hasta (día/mes)'), '1/1');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar período' }));
    expect(screen.getByText('Las fechas van como día/mes, por ejemplo 15/12.')).toBeInTheDocument();
    expect(global.fetch.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false);
  }, 15000);
});

describe('TarifasSection: cartel de servicios sin tarifas', () => {
  it('avisa por cada servicio que no tiene ninguna tarifa cargada', async () => {
    respuestas['GET tarifas'] = { tarifas: [{ id: 1, serviceType: 'carpa', alcance: 'tipo', clase: 'fecha', periodoId: 1, precio: 14000 }] };
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    const cartel = screen.getByRole('status');
    expect(within(cartel).getByText('Sombrillas: sin precios cargados. Las reservas van a pedir el total a mano.')).toBeInTheDocument();
    expect(within(cartel).getByText('Estacionamiento: sin precios cargados. Las reservas van a pedir el total a mano.')).toBeInTheDocument();
    expect(within(cartel).queryByText(/^Carpas:/)).not.toBeInTheDocument();
  });

  it('no muestra el cartel si todos los servicios tienen alguna tarifa', async () => {
    respuestas['GET tarifas'] = {
      tarifas: [
        { id: 1, serviceType: 'carpa', alcance: 'tipo', clase: 'fecha', periodoId: 1, precio: 14000 },
        { id: 2, serviceType: 'sombrilla', alcance: 'tipo', clase: 'fecha', periodoId: 1, precio: 8000 },
        { id: 3, serviceType: 'parking', alcance: 'tipo', clase: 'fecha', periodoId: 1, precio: 5000 }
      ]
    };
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
