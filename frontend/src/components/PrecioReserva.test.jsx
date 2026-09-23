import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrecioReserva from './PrecioReserva';
import { PRECIO_VACIO } from '../lib/tarifas';

const COMPLETA = {
  dias: 3, total: 30000, completo: true, diasSinTarifa: [],
  desglose: { clase: 'fecha', tramos: [{ desde: '2026-01-10', hasta: '2026-01-12', periodoId: 1, periodo: 'Alta', dias: 3, precioDia: 10000, subtotal: 30000 }], diasSinTarifa: [] }
};
const INCOMPLETA = {
  dias: 2, total: 0, completo: false, diasSinTarifa: ['2026-03-14', '2026-03-15'],
  desglose: { clase: 'fecha', tramos: [], diasSinTarifa: ['2026-03-14', '2026-03-15'] }
};
const COMPLETA_DECIMAL = {
  dias: 3, total: 9999.5, completo: true, diasSinTarifa: [],
  desglose: { clase: 'fecha', tramos: [{ desde: '2026-01-10', hasta: '2026-01-12', periodoId: 1, periodo: 'Alta', dias: 3, precioDia: 3333.17, subtotal: 9999.5 }], diasSinTarifa: [] }
};

function responder(cotizacion) {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ cotizacion }) }));
}

let ultimo;
function ConEstado({ desde = '2026-01-10', hasta = '2026-01-12', inicial = PRECIO_VACIO, cotizar = true }) {
  const [valor, setValor] = useState(inicial);
  const [fechas, setFechas] = useState({ desde, hasta });
  ultimo = valor;
  return (
    <>
      <button type="button" onClick={() => setFechas({ desde, hasta: '2026-01-14' })}>alargar</button>
      <PrecioReserva
        serviceType="carpa" resourceNumber={58} desde={fechas.desde} hasta={fechas.hasta}
        valor={valor} cotizar={cotizar}
        onChange={(patch) => setValor((prev) => ({ ...prev, ...patch }))}
      />
    </>
  );
}

beforeEach(() => responder(COMPLETA));
afterEach(() => vi.restoreAllMocks());

describe('PrecioReserva', () => {
  it('muestra el desglose y precarga el total de la tarifa', async () => {
    render(<ConEstado />);
    await waitFor(() => expect(screen.getByText('3 días Alta × $10.000 = $30.000')).toBeInTheDocument());
    expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('30.000');
    expect(ultimo.precioTarifa).toBe(30000);
    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/tarifas/cotizar?serviceType=carpa&resourceNumber=58&startDate=2026-01-10&endDate=2026-01-12');
  });

  it('si el total difiere pide motivo y muestra la diferencia', async () => {
    render(<ConEstado />);
    const total = await screen.findByDisplayValue('30.000');
    await userEvent.clear(total);
    await userEvent.type(total, '25000');
    expect(screen.getByText(/−\$5\.000 respecto de la tarifa/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo del ajuste/)).toBeRequired();
    expect(screen.getByText('Obligatorio si cobrás distinto a la tarifa.')).toBeInTheDocument();
  });

  it('al cambiar las fechas vuelve al precio de la tarifa y conserva el motivo', async () => {
    render(<ConEstado />);
    const total = await screen.findByDisplayValue('30.000');
    await userEvent.clear(total);
    await userEvent.type(total, '25000');
    await userEvent.type(screen.getByLabelText(/Motivo del ajuste/), 'amigo');
    responder({ ...COMPLETA, dias: 5, total: 50000, desglose: { ...COMPLETA.desglose, tramos: [{ ...COMPLETA.desglose.tramos[0], dias: 5, subtotal: 50000 }] } });
    await userEvent.click(screen.getByText('alargar'));
    await waitFor(() => expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('50.000'));
    expect(ultimo.motivo).toBe('amigo');
  });

  it('sin tarifa completa avisa Consultar precio y deja cargar a mano', async () => {
    responder(INCOMPLETA);
    render(<ConEstado desde="2026-03-14" hasta="2026-03-15" />);
    await waitFor(() => expect(screen.getByText('Consultar precio: faltan tarifas para el 14/03 y 15/03.')).toBeInTheDocument());
    expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('Total cobrado (ARS)'), '20000');
    expect(screen.queryByLabelText(/Motivo del ajuste/)).not.toBeInTheDocument();
  });

  it('sin cotizar muestra lo guardado y no llama al servidor', () => {
    render(<ConEstado cotizar={false} inicial={{ ...PRECIO_VACIO, precioTarifa: 30000, cobrado: '30000', desglose: COMPLETA.desglose }} />);
    expect(screen.getByText('3 días Alta × $10.000 = $30.000')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('una tarifa con centavos precarga con coma decimal y guarda un valor plano', async () => {
    responder(COMPLETA_DECIMAL);
    render(<ConEstado />);
    await waitFor(() => expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('9.999,5'));
    expect(ultimo.cobrado).toBe('9999.5');

    const total = screen.getByLabelText('Total cobrado (ARS)');
    await userEvent.clear(total);
    await userEvent.type(total, '25000');
    expect(ultimo.cobrado).toBe('25000');
  });

  it('si la tarifa nueva queda incompleta al cambiar de fechas, vacia el total ajustado', async () => {
    render(<ConEstado />);
    const total = await screen.findByDisplayValue('30.000');
    await userEvent.clear(total);
    await userEvent.type(total, '25000');
    responder(INCOMPLETA);
    await userEvent.click(screen.getByText('alargar'));
    await waitFor(() => expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue(''));
  });
});
