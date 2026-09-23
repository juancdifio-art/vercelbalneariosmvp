import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from '../lib/dates';
import DailyViewSection from './DailyViewSection';

const HOY = format(new Date(), 'yyyy-MM-dd');

// La config dice 5, pero con el plano manda el plano (117 carpas, hasta la 134).
const ESTABLECIMIENTO = {
  hasCarpas: true,
  hasSombrillas: true,
  hasParking: false,
  carpasCapacity: '5',
  sombrillasCapacity: '5'
};

const RESERVA_CARPA_134 = {
  id: 7,
  serviceType: 'carpa',
  resourceNumber: 134,
  startDate: HOY,
  endDate: HOY,
  status: 'active',
  clientId: 3,
  customerName: 'Valentina Rios',
  customerPhone: '2262-445512',
  adultsCount: 2,
  childrenCount: 1,
  totalPrice: '50000',
  paidAmount: 20000,
  notes: 'Trae sombrilla propia'
};

function renderVista(props = {}) {
  const base = {
    establishment: ESTABLECIMIENTO,
    carpasReservations: { [`${HOY}-134`]: RESERVA_CARPA_134 },
    sombrillasReservations: {},
    parkingReservations: {},
    reservationGroups: [RESERVA_CARPA_134],
    onViewReservationDetails: vi.fn(),
    onOpenNewCarpaReservation: vi.fn(),
    onOpenNewSombrillaReservation: vi.fn(),
    conPlano: true
  };
  const merged = { ...base, ...props };
  const utils = render(<DailyViewSection {...merged} />);
  return { ...utils, props: merged };
}

const unidad = (container, id) => container.querySelector(`[data-unidad="${id}"]`);

describe('Vista rapida con el plano', () => {
  it('en carpas dibuja solo carpas, con las 117 del plano', () => {
    const { container } = renderVista();
    expect(container.querySelectorAll('[data-unidad^="carpa-"]')).toHaveLength(117);
    expect(container.querySelectorAll('[data-unidad^="sombrilla-"]')).toHaveLength(0);
    expect(unidad(container, 'carpa-4')).toBeNull();
    expect(screen.getByText('117 unidades totales.', { exact: false })).toBeInTheDocument();
  });

  it('pinta ocupada la carpa reservada y al tocarla abre la reserva', async () => {
    const { container, props } = renderVista();
    const carpa = unidad(container, 'carpa-134');
    expect(carpa).toHaveAttribute('data-estado', 'ocupada');
    await userEvent.click(carpa);
    expect(props.onViewReservationDetails).toHaveBeenCalledWith(RESERVA_CARPA_134);
  });

  it('al tocar una carpa libre abre el alta con ese numero', async () => {
    const { container, props } = renderVista();
    await userEvent.click(unidad(container, 'carpa-118'));
    expect(props.onOpenNewCarpaReservation).toHaveBeenCalledWith(118, expect.any(Date));
  });

  it('en sombrillas dibuja solo sombrillas', async () => {
    const { container } = renderVista();
    await userEvent.click(screen.getByRole('tab', { name: 'Sombrillas' }));
    expect(container.querySelectorAll('[data-unidad^="sombrilla-"]')).toHaveLength(220);
    expect(container.querySelectorAll('[data-unidad^="carpa-"]')).toHaveLength(0);
  });

  it('se puede pasar a la lista, que tambien sale del plano', async () => {
    renderVista();
    await userEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByLabelText(/^Carpa 134 - Ocupada/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Carpa 4 -/)).not.toBeInTheDocument();
  });

  it('el plano completo cubre la pantalla con todo y se cierra con el boton o con Esc', async () => {
    renderVista();
    await userEvent.click(screen.getByRole('button', { name: /Plano completo/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Plano completo del balneario' });
    expect(dialogo.querySelectorAll('[data-unidad^="carpa-"]')).toHaveLength(117);
    expect(dialogo.querySelectorAll('[data-unidad^="sombrilla-"]')).toHaveLength(220);

    await userEvent.click(within(dialogo).getByRole('button', { name: /Cerrar plano/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Plano completo/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tocar una unidad en el plano completo lo cierra y abre la reserva', async () => {
    const { props } = renderVista();
    await userEvent.click(screen.getByRole('button', { name: /Plano completo/ }));
    const dialogo = screen.getByRole('dialog');
    await userEvent.click(dialogo.querySelector('[data-unidad="sombrilla-209"]'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onOpenNewSombrillaReservation).toHaveBeenCalledWith(209, expect.any(Date));
  });
});

describe('Vista rapida sin plano', () => {
  it('sigue siendo la grilla 1..capacidad y no ofrece plano completo', () => {
    renderVista({ conPlano: false, carpasReservations: {}, reservationGroups: [] });
    expect(screen.getByLabelText(/^Carpa 5 -/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Carpa 6 -/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Plano completo/ })).not.toBeInTheDocument();
  });
});

describe('reservas fuera del plano', () => {
  it('avisa las reservas activas en numeros que el plano no tiene y deja abrirlas', async () => {
    const huerfana = {
      id: 9, serviceType: 'carpa', resourceNumber: 7, startDate: HOY, endDate: HOY,
      status: 'active', customerName: 'Perez'
    };
    const { props } = renderVista({ reservationGroups: [RESERVA_CARPA_134, huerfana] });
    expect(screen.getByRole('alert')).toHaveTextContent('Hay 1 reserva en un número que no está en el plano');
    await userEvent.click(screen.getByRole('button', { name: 'Carpa 7 · Perez' }));
    expect(props.onViewReservationDetails).toHaveBeenCalledWith(huerfana);
  });
});

describe('tarjeta al pasar el mouse', () => {
  it('sale al instante sobre una carpa ocupada, con lo que hay que saber', async () => {
    const plaza = {
      id: 8, serviceType: 'parking', resourceNumber: 12, clientId: 3,
      startDate: HOY, endDate: HOY, status: 'active'
    };
    const { container } = renderVista({ reservationGroups: [RESERVA_CARPA_134, plaza] });
    await userEvent.hover(unidad(container, 'carpa-134'));
    const tarjeta = screen.getByRole('tooltip');
    expect(tarjeta).toHaveTextContent('Carpa 134');
    expect(tarjeta).toHaveTextContent('Valentina Rios');
    expect(tarjeta).toHaveTextContent('2262-445512');
    expect(tarjeta).toHaveTextContent('Viene solo hoy');
    expect(tarjeta).toHaveTextContent('2 adultos y 1 menor');
    expect(tarjeta).toHaveTextContent('Debe $30.000');
    expect(tarjeta).toHaveTextContent('Plaza 12');
    expect(tarjeta).toHaveTextContent('Trae sombrilla propia');

    await userEvent.unhover(unidad(container, 'carpa-134'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('sobre una libre muestra la proxima reserva', async () => {
    const manana = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
    const futura = {
      id: 11, serviceType: 'carpa', resourceNumber: 118, startDate: manana, endDate: manana,
      status: 'active', customerName: 'Martin Sosa'
    };
    const { container } = renderVista({
      carpasReservations: { [`${manana}-118`]: futura },
      reservationGroups: [futura]
    });
    await userEvent.hover(unidad(container, 'carpa-118'));
    const tarjeta = screen.getByRole('tooltip');
    expect(tarjeta).toHaveTextContent('Martin Sosa');
    expect(tarjeta).toHaveTextContent('entra mañana');
    expect(tarjeta).toHaveTextContent('Clic para reservar');
  });

  it('tambien sale en la lista', async () => {
    renderVista();
    await userEvent.click(screen.getByRole('button', { name: 'Lista' }));
    await userEvent.hover(screen.getByLabelText(/^Carpa 134 - Ocupada/));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Valentina Rios');
  });
});
