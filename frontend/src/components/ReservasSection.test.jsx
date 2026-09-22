import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservasSection from './ReservasSection';

// Reserva de febrero: no esta activa "hoy" en ninguna corrida del test.
const RESERVA_PASADA = {
  id: 1,
  serviceType: 'sombrilla',
  resourceNumber: 17,
  startDate: '2026-02-22',
  endDate: '2026-02-28',
  customerName: 'Andres Lopez',
  status: 'active',
  totalPrice: '105000.00',
  paidAmount: '0.00'
};

function renderSection(props = {}) {
  const base = {
    reservationGroups: [RESERVA_PASADA],
    reservationGroupsLoading: false,
    reservationFilterService: '',
    reservationFilterStatus: 'active',
    reservationFilterFrom: '',
    reservationFilterTo: '',
    onFilterServiceChange: vi.fn(),
    onFilterStatusChange: vi.fn(),
    onFilterFromChange: vi.fn(),
    onFilterToChange: vi.fn(),
    onClearFilters: vi.fn(),
    onViewDetails: vi.fn(),
    onAddPayment: vi.fn()
  };
  return render(<ReservasSection {...base} {...props} />);
}

describe('ReservasSection: estado vacio por filtros', () => {
  it('avisa que no hay resultados cuando el filtro de estado esconde todo y Servicio es "Todas"', () => {
    // Este es el bug real: 2417 reservas cargadas, filtro "Activas hoy",
    // servicio "Todas" (string vacio) => la pantalla quedaba en blanco.
    renderSection({ reservationFilterService: '' });

    expect(screen.getByText(/No se encontraron resultados/i)).toBeInTheDocument();
  });

  it('sigue avisando cuando ademas hay filtro de servicio', () => {
    renderSection({ reservationFilterService: 'sombrilla' });

    expect(screen.getByText(/No se encontraron resultados/i)).toBeInTheDocument();
  });

  it('nombra el filtro de estado que esta escondiendo las reservas', () => {
    renderSection({ reservationFilterService: '', reservationFilterStatus: 'active' });

    // 'Activas hoy' tambien existe en el <option>, por eso se busca la etiqueta del chip.
    expect(screen.getByText('Estado: Activas hoy')).toBeInTheDocument();
  });

  it('no muestra el aviso de filtros cuando no hay ninguna reserva cargada', () => {
    renderSection({ reservationGroups: [] });

    expect(screen.getByText(/No hay reservas cargadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/No se encontraron resultados/i)).not.toBeInTheDocument();
  });

  it('el boton del estado vacio limpia los filtros y tambien la busqueda local', async () => {
    const onClearFilters = vi.fn();
    const user = userEvent.setup();
    const { container } = renderSection({ onClearFilters });

    const searchInput = container.querySelector('input[type="text"]');
    await user.type(searchInput, 'Zzz');
    expect(searchInput).toHaveValue('Zzz');

    // El segundo "Limpiar filtros" es el del estado vacio (el primero es el de la barra).
    const botones = screen.getAllByRole('button', { name: /Limpiar filtros/i });
    await user.click(botones[botones.length - 1]);

    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(searchInput).toHaveValue('');
  });

  it('no muestra el aviso cuando si hay resultados', () => {
    renderSection({ reservationFilterStatus: '' });

    expect(screen.queryByText(/No se encontraron resultados/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Andres Lopez/i)).toBeInTheDocument();
  });
});
