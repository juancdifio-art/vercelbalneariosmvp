import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { addDays } from 'date-fns';
import { format } from '../lib/dates';
import CalendarioOcupacion from './CalendarioOcupacion';

const dia = (n) => format(addDays(new Date(), n), 'yyyy-MM-dd');

// Carpa 58 ocupada pasado manana (indice 2).
const RESERVA = {
  id: 5, serviceType: 'carpa', resourceNumber: 58, startDate: dia(2), endDate: dia(2),
  status: 'active', customerName: 'Martin Sosa', customerPhone: '2262-11', totalPrice: '1000', paidAmount: 1000
};

function renderCalendario(props = {}) {
  const base = {
    serviceType: 'carpa',
    prefijo: 'Carpa',
    numeros: [57, 58],
    reservations: { [`${dia(2)}-58`]: RESERVA },
    reservationGroups: [RESERVA],
    dayOffset: 0,
    hoveredReservationGroupId: null,
    setHoveredReservationGroupId: vi.fn(),
    onViewReservationDetails: vi.fn(),
    onNuevaReserva: vi.fn(),
    colores: [{ normal: 'bg-amber-300', today: 'bg-amber-500' }]
  };
  const merged = { ...base, ...props };
  const utils = render(<CalendarioOcupacion {...merged} />);
  return { ...utils, props: merged };
}

const celda = (container, numero, n) => container.querySelector(`[data-celda="${numero}-${dia(n)}"]`);

function arrastrar(container, numero, desde, hasta) {
  fireEvent.pointerDown(celda(container, numero, desde), { button: 0 });
  for (let i = Math.min(desde, hasta); i <= Math.max(desde, hasta); i += 1) {
    fireEvent.pointerEnter(celda(container, numero, i));
  }
  fireEvent.pointerEnter(celda(container, numero, hasta));
  fireEvent.pointerUp(window);
}

describe('calendario de ocupacion', () => {
  it('arrastrar sobre una fila abre la reserva con entrada y salida', () => {
    const { container, props } = renderCalendario();
    arrastrar(container, 57, 3, 7);
    expect(props.onNuevaReserva).toHaveBeenCalledWith(57, expect.any(Date), dia(3), dia(7));
  });

  it('arrastrar hacia atras tambien funciona', () => {
    const { container, props } = renderCalendario();
    arrastrar(container, 57, 7, 3);
    expect(props.onNuevaReserva).toHaveBeenCalledWith(57, expect.any(Date), dia(3), dia(7));
  });

  it('un clic sin arrastrar deja la salida vacia', () => {
    const { container, props } = renderCalendario();
    arrastrar(container, 57, 4, 4);
    expect(props.onNuevaReserva).toHaveBeenCalledWith(57, expect.any(Date), dia(4), '');
  });

  it('si el tramo pisa un dia ocupado no abre nada y avisa', () => {
    const { container, props } = renderCalendario();
    arrastrar(container, 58, 0, 4);
    expect(props.onNuevaReserva).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('carpa 58 tiene días ocupados');
  });

  it('mientras arrastra pinta el tramo y resume las fechas', () => {
    const { container } = renderCalendario();
    fireEvent.pointerDown(celda(container, 57, 1), { button: 0 });
    fireEvent.pointerEnter(celda(container, 57, 3));
    expect(celda(container, 57, 2).className).toContain('bg-cyan-600');
    expect(screen.getByRole('tooltip')).toHaveTextContent('3 días');

    // Los dias del tramo se marcan tambien en el encabezado, y la fila en su numero.
    const marcados = Array.from(container.querySelectorAll('th[data-en-tramo="si"]')).map((th) => th.dataset.dia);
    expect(marcados).toEqual([dia(1), dia(2), dia(3)]);
    expect(container.querySelector('td[data-fila="57"]').className).toContain('bg-cyan-600');
    expect(container.querySelector('td[data-fila="58"]').className).not.toContain('bg-cyan-600');

    fireEvent.pointerUp(window);
    expect(container.querySelectorAll('th[data-en-tramo="si"]')).toHaveLength(0);
  });

  it('clic en una ocupada abre la reserva', () => {
    const { container, props } = renderCalendario();
    fireEvent.click(celda(container, 58, 2));
    expect(props.onViewReservationDetails).toHaveBeenCalledWith(RESERVA);
  });

  it('al pasar el mouse por una reserva sale la tarjeta al instante', () => {
    const { container } = renderCalendario();
    fireEvent.pointerEnter(celda(container, 58, 2));
    const tarjeta = screen.getByRole('tooltip');
    expect(tarjeta).toHaveTextContent('Martin Sosa');
    expect(tarjeta).toHaveTextContent('Reservada');
    expect(tarjeta).toHaveTextContent('Entra en 2 días');
    fireEvent.pointerLeave(celda(container, 58, 2));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('Esc cancela el arrastre y al soltar no abre nada', () => {
    const { container, props } = renderCalendario();
    fireEvent.pointerDown(celda(container, 57, 1), { button: 0 });
    fireEvent.pointerEnter(celda(container, 57, 4));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelectorAll('th[data-en-tramo="si"]')).toHaveLength(0);
    fireEvent.pointerUp(window);
    expect(props.onNuevaReserva).not.toHaveBeenCalled();
  });
});
