import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SectoresTab from './SectoresTab';

const SERVICIOS = [{ id: 'carpa', label: 'Carpas' }, { id: 'parking', label: 'Estacionamiento' }];
const TERRAZA = { id: 3, serviceType: 'carpa', nombre: 'Terraza', color: '#F97316', unidades: [118, 119] };

const unidad = (n) => document.querySelector(`[data-unidad="carpa-${n}"]`);

describe('SectoresTab', () => {
  it('pinta las unidades de otro sector con su color', () => {
    render(<SectoresTab servicios={SERVICIOS} sectores={[TERRAZA]} ejecutar={vi.fn()} establishment={{ parkingCapacity: 10 }} />);
    expect(unidad(118).querySelector('rect').getAttribute('fill')).toBe('#FED7AA');
  });

  it('arma un sector nuevo tocando el plano y lo guarda', async () => {
    const ejecutar = vi.fn().mockResolvedValue('');
    render(<SectoresTab servicios={SERVICIOS} sectores={[TERRAZA]} ejecutar={ejecutar} establishment={{ parkingCapacity: 10 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo sector' }));
    await userEvent.type(screen.getByLabelText('Nombre del sector'), 'Frente al mar');
    await userEvent.click(unidad(58));
    await userEvent.click(unidad(59));
    await userEvent.click(unidad(118)); // es de Terraza: no se toma
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sector' }));
    expect(ejecutar).toHaveBeenCalledWith('tarifas/sectores', {
      method: 'POST',
      body: { serviceType: 'carpa', nombre: 'Frente al mar', color: '#0EA5E9', unidades: [58, 59] }
    });
  }, 15000);

  it('en estacionamiento elige plazas de una lista', async () => {
    const ejecutar = vi.fn().mockResolvedValue('');
    render(<SectoresTab servicios={SERVICIOS} sectores={[]} ejecutar={ejecutar} establishment={{ parkingCapacity: 10 }} />);
    await userEvent.selectOptions(screen.getByLabelText('Servicio'), 'parking');
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo sector' }));
    await userEvent.type(screen.getByLabelText('Nombre del sector'), 'Techado');
    await userEvent.click(screen.getByRole('button', { name: 'Plaza 3' }));
    expect(screen.getByRole('button', { name: 'Plaza 3' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sector' }));
    expect(ejecutar.mock.calls[0][1].body.unidades).toEqual([3]);
  }, 15000);
});
