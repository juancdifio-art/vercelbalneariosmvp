import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EstablishmentConfigForm from './EstablishmentConfigForm';

const BASE = {
  estName: 'Zeus', setEstName: vi.fn(),
  estHasParking: true, setEstHasParking: vi.fn(), estParkingCapacity: '300', setEstParkingCapacity: vi.fn(),
  estHasCarpas: true, setEstHasCarpas: vi.fn(), estCarpasCapacity: '117', setEstCarpasCapacity: vi.fn(),
  estHasSombrillas: true, setEstHasSombrillas: vi.fn(), estSombrillasCapacity: '218', setEstSombrillasCapacity: vi.fn(),
  estHasPileta: true, setEstHasPileta: vi.fn(), estPoolMaxOccupancy: '60', setEstPoolMaxOccupancy: vi.fn(),
  onSubmit: vi.fn((e) => e.preventDefault()), estSaving: false, error: '', success: ''
};

const AJUSTES = { pasesPiletaPorCarpa: '4', pasesPiletaPorSombrilla: '0', maxPersonasPorUnidad: '6' };

describe('EstablishmentConfigForm: servicios incluidos', () => {
  it('muestra los pases por carpa y sombrilla y el tope de personas', () => {
    render(<EstablishmentConfigForm {...BASE} estAjustes={AJUSTES} setEstAjustes={vi.fn()} />);

    expect(screen.getByLabelText('Pases de pileta por carpa')).toHaveValue(4);
    expect(screen.getByLabelText('Pases de pileta por sombrilla')).toHaveValue(0);
    expect(screen.getByLabelText('Máximo de personas por unidad')).toHaveValue(6);
  });

  it('al cambiar un valor avisa con el campo que cambio', () => {
    const setEstAjustes = vi.fn();
    render(<EstablishmentConfigForm {...BASE} estAjustes={AJUSTES} setEstAjustes={setEstAjustes} />);

    fireEvent.change(screen.getByLabelText('Pases de pileta por carpa'), { target: { value: '5' } });

    const actualizar = setEstAjustes.mock.calls[0][0];
    expect(actualizar(AJUSTES)).toEqual({ ...AJUSTES, pasesPiletaPorCarpa: '5' });
  });

  it('sin pileta no muestra los pases', () => {
    render(<EstablishmentConfigForm {...BASE} estHasPileta={false} estAjustes={AJUSTES} setEstAjustes={vi.fn()} />);

    expect(screen.queryByLabelText('Pases de pileta por carpa')).toBeNull();
    expect(screen.getByLabelText('Máximo de personas por unidad')).toBeInTheDocument();
  });
});
