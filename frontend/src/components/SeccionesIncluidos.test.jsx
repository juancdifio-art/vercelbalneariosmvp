import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PiletaSection from './PiletaSection';

// En la seccion Pileta, cada pase dice si esta incluido en una carpa o si es
// un pase pago asociado, y quienes lo tienen.

const hoy = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PASES = [
  { id: 501, serviceType: 'pileta', resourceNumber: 1, startDate: iso(hoy), endDate: iso(hoy), customerName: 'Lucia', status: 'active', adultsCount: 2, childrenCount: 0, totalPrice: '0', paidAmount: 0, vinculo: 'incluido', incluidaEnReservaId: 60, incluidaEnNumero: 12, incluidaEnTipo: 'carpa', paseNombres: ['Lucia', 'Ana'] },
  { id: 503, serviceType: 'pileta', resourceNumber: 1, startDate: iso(hoy), endDate: iso(hoy), customerName: 'Lucia', status: 'active', adultsCount: 1, childrenCount: 0, totalPrice: '5000', paidAmount: 0, vinculo: 'adicional', incluidaEnReservaId: 60, incluidaEnNumero: 12, incluidaEnTipo: 'carpa', paseNombres: ['Caro'] },
  { id: 504, serviceType: 'pileta', resourceNumber: 1, startDate: iso(hoy), endDate: iso(hoy), customerName: 'Suelto', status: 'active', adultsCount: 1, childrenCount: 0, totalPrice: '5000', paidAmount: 0, vinculo: null, paseNombres: [] }
];

describe('seccion Pileta con pases vinculados a una carpa', () => {
  it('marca el pase incluido y el pase pago, con los nombres', () => {
    render(<PiletaSection establishment={{ hasPileta: true }} reservationGroups={PASES} reservationGroupsLoading={false} onViewReservationDetails={vi.fn()} onOpenNewPoolPass={vi.fn()} />);

    expect(screen.getByText('Incluido en Carpa 12')).toBeInTheDocument();
    expect(screen.getByText('Pase pago · Carpa 12')).toBeInTheDocument();
    expect(screen.getByText('Lucia, Ana')).toBeInTheDocument();
    expect(screen.getAllByText(/Carpa 12/)).toHaveLength(2);
  });
});
