import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../utils/generateContrato', () => ({ generarContratoPdf: vi.fn() }));

const { default: ContratoConfig } = await import('./ContratoConfig');
const { generarContratoPdf } = await import('../utils/generateContrato');

const responder = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  generarContratoPdf.mockClear();
  global.fetch = vi.fn((url, opts = {}) => {
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (body.titulo.length > 120) return responder({ error: 'titulo_largo' }, 400);
      return responder({ contrato: { titulo: body.titulo.trim(), condiciones: body.condiciones.trim() } });
    }
    return responder({ contrato: { titulo: 'CONTRATACIÓN 2026-2027', condiciones: '1 - Uno' } });
  });
});

describe('Panel de usuario > Contrato', () => {
  it('muestra lo guardado y guarda lo editado', async () => {
    render(<ContratoConfig establishment={{ name: 'Zeus', maxPersonasPorUnidad: 6 }} />);

    expect(await screen.findByDisplayValue('CONTRATACIÓN 2026-2027')).toBeInTheDocument();
    expect(screen.getByLabelText('Condiciones generales')).toHaveValue('1 - Uno');

    fireEvent.change(screen.getByLabelText('Condiciones generales'), { target: { value: '1 - Uno\n**OBLIGATORIO**\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Contrato guardado.')).toBeInTheDocument();
    const put = global.fetch.mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(put[0]).toMatch(/\/api\/contrato$/);
    expect(JSON.parse(put[1].body)).toEqual({ titulo: 'CONTRATACIÓN 2026-2027', condiciones: '1 - Uno\n**OBLIGATORIO**\n' });
  });

  it('muestra el error del servidor', async () => {
    render(<ContratoConfig establishment={{ name: 'Zeus' }} />);
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'x'.repeat(130) } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('El título es muy largo: máximo 120 caracteres.')).toBeInTheDocument();
  });

  it('la vista previa arma un contrato con lo que esta escrito, sin datos de cliente', async () => {
    render(<ContratoConfig establishment={{ name: 'Zeus', maxPersonasPorUnidad: 6 }} />);
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Mi contrato' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));

    const c = generarContratoPdf.mock.calls[0][0];
    expect(c.titulo).toBe('Mi contrato');
    expect(c.balneario).toBe('Zeus');
    expect(c.nomina).toHaveLength(5);
    expect(c.titular.every(([, v]) => v === '')).toBe(true);
  });
});
