import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TarifasSection from './TarifasSection';

const ALTA = { id: 1, nombre: 'Temporada alta', mesInicio: 12, diaInicio: 15, mesFin: 3, diaFin: 15, prioridad: 1 };
const calendario = Array.from({ length: 366 }, (_, i) => ({ mes: 1, dia: 1, periodoId: i % 2 ? 1 : null }));

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
  });

  it('muestra el error del servidor en castellano', async () => {
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    await userEvent.type(screen.getByLabelText('Nombre del período'), 'Enero');
    await userEvent.type(screen.getByLabelText('Desde (día/mes)'), '1/1');
    await userEvent.type(screen.getByLabelText('Hasta (día/mes)'), '31/1');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar período' }));
    expect(await screen.findByText('Ya hay un período con la misma prioridad en esas fechas. Subile la prioridad al más específico.')).toBeInTheDocument();
  });

  it('valida el formato dia/mes antes de mandar', async () => {
    render(<TarifasSection establishment={EST} />);
    await screen.findByRole('row', { name: /Temporada alta/ });
    await userEvent.type(screen.getByLabelText('Nombre del período'), 'X');
    await userEvent.type(screen.getByLabelText('Desde (día/mes)'), 'diciembre');
    await userEvent.type(screen.getByLabelText('Hasta (día/mes)'), '1/1');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar período' }));
    expect(screen.getByText('Las fechas van como día/mes, por ejemplo 15/12.')).toBeInTheDocument();
    expect(global.fetch.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false);
  });
});
