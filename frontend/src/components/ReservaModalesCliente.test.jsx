import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CarpaReservationModal from './CarpaReservationModal';
import SombrillaReservationModal from './SombrillaReservationModal';
import ParkingReservationModal from './ParkingReservationModal';

// Regresion: los tres modales armaban el objeto que mandan al guardar sin el
// clientId del cliente elegido en el buscador. La reserva quedaba con el
// nombre como texto y client_id en null, y con eso no andaban la ficha del
// cliente, las "otras reservas" ni el DNI del comprobante.

function parseLocal(value) {
  if (!value) return null;
  const [a, m, d] = String(value).split('-').map(Number);
  return new Date(a, m - 1, d);
}

const CLIENTE = { id: 305, fullName: 'Valentina Rios', phone: '2262-445512' };

const MODALES = [
  { nombre: 'carpa', Modal: CarpaReservationModal, clave: 'carpaNumero' },
  { nombre: 'sombrilla', Modal: SombrillaReservationModal, clave: 'sombrillaNumero' },
  { nombre: 'estacionamiento', Modal: ParkingReservationModal, clave: 'plazaNumero' }
];

describe.each(MODALES)('modal de $nombre', ({ Modal, clave }) => {
  it('manda el clientId del cliente elegido al guardar', async () => {
    const onSaveRange = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <Modal
        form={{
          [clave]: 50,
          isReserved: false,
          startDate: '2026-09-24',
          endDate: '2026-09-26',
          clientId: CLIENTE.id,
          customerName: CLIENTE.fullName,
          customerPhone: CLIENTE.phone,
          dailyPrice: '18000',
          initialPaymentAmount: '',
          initialPaymentMethod: '',
          parkingInitialPaymentAmount: '',
          parkingInitialPaymentMethod: ''
        }}
        clients={[CLIENTE]}
        establishment={{ carpasCapacity: 100, sombrillasCapacity: 100, parkingCapacity: 100 }}
        error=""
        parseLocalDateFromInput={parseLocal}
        onChangeForm={vi.fn()}
        onSaveRange={onSaveRange}
        onReleaseRange={vi.fn()}
        onClose={vi.fn()}
        reservationGroups={[]}
      />
    );

    await user.click(screen.getByRole('button', { name: /Guardar reserva/ }));

    expect(onSaveRange).toHaveBeenCalledTimes(1);
    const extra = onSaveRange.mock.calls[0][3];
    expect(extra.clientId).toBe(CLIENTE.id);
  });
});
