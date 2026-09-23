import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationEditModal from './ReservationEditModal';
import ReservationDetailsModal from './ReservationDetailsModal';
import { PRECIO_VACIO } from '../lib/tarifas';

const DESGLOSE = { clase: 'fecha', tramos: [{ desde: '2026-01-10', hasta: '2026-01-12', periodoId: 1, periodo: 'Alta', dias: 3, precioDia: 10000, subtotal: 30000 }], diasSinTarifa: [] };
const GRUPO = {
  id: 60, serviceType: 'carpa', resourceNumber: 58, startDate: '2026-01-10', endDate: '2026-01-12',
  customerName: 'Lucia', totalPrice: '25000', dailyPrice: '8333', paidAmount: 0, status: 'active',
  precioTarifa: '30000.00', desglose: DESGLOSE, motivoAjuste: 'cliente de años'
};

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ payments: [], reservationGroups: [] }) }));
});
afterEach(() => vi.restoreAllMocks());

function EdicionConEstado() {
  const [modal, setModal] = useState({
    ...GRUPO, tempCustomerName: 'Lucia', tempNotes: '',
    tempPrecio: { ...PRECIO_VACIO, precioTarifa: 30000, desglose: DESGLOSE, cobrado: '25000', motivo: 'cliente de años' }
  });
  return (
    <ReservationEditModal modal={modal} saving={false} setModal={setModal} onSave={vi.fn()} onClose={vi.fn()}
      establishment={{ carpasCapacity: 100 }} reservationGroups={[]} />
  );
}

describe('precio al editar', () => {
  it('sin tocar fechas muestra lo guardado y no cotiza', () => {
    render(<EdicionConEstado />);
    expect(screen.getByText('3 días Alta × $10.000 = $30.000')).toBeInTheDocument();
    expect(screen.getByLabelText('Total cobrado (ARS)')).toHaveValue('25.000');
    expect(screen.getByLabelText(/Motivo del ajuste/)).toHaveValue('cliente de años');
    expect(global.fetch.mock.calls.some((c) => String(c[0]).includes('/tarifas/cotizar'))).toBe(false);
  });

  it('borrar el motivo de un ajuste deshabilita guardar', async () => {
    render(<EdicionConEstado />);
    await userEvent.clear(screen.getByLabelText(/Motivo del ajuste/));
    expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeDisabled();
  });

  it('muestra el aviso cuando el servidor exige el motivo del ajuste', () => {
    const modal = {
      ...GRUPO, tempCustomerName: 'Lucia', tempNotes: '',
      tempPrecio: { ...PRECIO_VACIO, precioTarifa: 30000, desglose: DESGLOSE, cobrado: '25000', motivo: 'cliente de años' }
    };
    render(
      <ReservationEditModal
        modal={modal}
        saving={false}
        setModal={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        establishment={{ carpasCapacity: 100 }}
        reservationGroups={[]}
        error="El total es distinto al de la tarifa: falta el motivo del ajuste."
      />
    );
    expect(screen.getByText('El total es distinto al de la tarifa: falta el motivo del ajuste.')).toBeInTheDocument();
  });
});

describe('precio en el detalle', () => {
  it('muestra el desglose y el ajuste con su motivo', async () => {
    render(<ReservationDetailsModal reservation={GRUPO} establishment={{}} parseLocalDateFromInput={() => null}
      onClose={vi.fn()} onEdit={vi.fn()} onCancel={vi.fn()} onAddPayment={vi.fn()} onViewReservation={vi.fn()} onViewClient={vi.fn()} />);
    expect(screen.getByText('3 días Alta × $10.000 = $30.000')).toBeInTheDocument();
    expect(screen.getByText(/Tarifa \$30\.000 · Cobrado \$25\.000 · Motivo: cliente de años/)).toBeInTheDocument();
  });
});
