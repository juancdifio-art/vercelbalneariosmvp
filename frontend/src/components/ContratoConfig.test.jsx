import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../utils/generateContrato', () => ({ generarContratoPdf: vi.fn() }));

const { default: ContratoConfig } = await import('./ContratoConfig');
const { generarContratoPdf } = await import('../utils/generateContrato');

const responder = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const GUARDADO = {
  titulo: 'CONTRATACIÓN 2026-2027',
  condiciones: 'La pileta abre de {Horario de la pileta}.',
  datos: [{ nombre: 'Horario de la pileta', valor: '13.30 a 19.30 hs' }]
};
const ZEUS = { name: 'Zeus', maxPersonasPorUnidad: 6 };
const put = () => global.fetch.mock.calls.find(([, o]) => o?.method === 'PUT');

beforeEach(() => {
  generarContratoPdf.mockClear();
  global.fetch = vi.fn((url, opts = {}) => {
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (body.titulo.length > 120) return responder({ error: 'titulo_largo' }, 400);
      return responder({ contrato: { ...body, datos: body.datos.filter((d) => d.nombre) } });
    }
    return responder({ contrato: GUARDADO });
  });
});

describe('Panel de usuario > Contrato', () => {
  it('muestra lo guardado: titulo, datos y condiciones', async () => {
    render(<ContratoConfig establishment={ZEUS} />);

    expect(await screen.findByDisplayValue('CONTRATACIÓN 2026-2027')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Horario de la pileta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('13.30 a 19.30 hs')).toBeInTheDocument();
    expect(screen.getByLabelText('Condiciones generales')).toHaveValue('La pileta abre de {Horario de la pileta}.');
    // Los del sistema se ven con su valor, sin poder editarlos.
    expect(screen.getByText('Máximo de personas')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    // Y al lado, como se lee: el valor del dato resaltado.
    const vista = screen.getByLabelText('Así se lee en el contrato');
    expect(vista).toHaveTextContent('La pileta abre de 13.30 a 19.30 hs.');
    expect(within(vista).getByText('13.30 a 19.30 hs').tagName).toBe('STRONG');
  });

  it('agrega un dato, edita el texto y guarda todo junto', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    await screen.findByDisplayValue('Horario de la pileta');

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar dato' }));
    fireEvent.change(screen.getByLabelText('Nombre del dato 2'), { target: { value: 'Horario de cocheras' } });
    fireEvent.change(screen.getByLabelText('Valor del dato 2'), { target: { value: '09 a 20hs' } });
    fireEvent.change(screen.getByLabelText('Condiciones generales'), { target: { value: 'Cocheras de {Horario de cocheras}.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);

    expect((await screen.findAllByText('Contrato guardado.')).length).toBeGreaterThan(0);
    expect(put()[0]).toMatch(/\/api\/contrato$/);
    expect(JSON.parse(put()[1].body)).toEqual({
      titulo: 'CONTRATACIÓN 2026-2027',
      condiciones: 'Cocheras de {Horario de cocheras}.',
      datos: [{ nombre: 'Horario de la pileta', valor: '13.30 a 19.30 hs' }, { nombre: 'Horario de cocheras', valor: '09 a 20hs' }]
    });
  });

  it('inserta un dato donde esta el cursor del texto', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    const texto = await screen.findByLabelText('Condiciones generales');
    fireEvent.change(texto, { target: { value: 'Abre a las  hs.' } });
    texto.setSelectionRange(11, 11); // entre los dos espacios
    fireEvent.click(screen.getByRole('button', { name: 'Insertar Horario de la pileta en el texto' }));
    expect(texto).toHaveValue('Abre a las {Horario de la pileta} hs.');
  });

  it('el titulo muestra como se imprime cuando usa un dato', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'CONTRATO {Balneario}' } });
    expect(screen.getByText('CONTRATO Zeus')).toBeInTheDocument();
  });

  it('quita un dato', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Quitar el dato Horario de la pileta' }));
    expect(screen.queryByDisplayValue('Horario de la pileta')).not.toBeInTheDocument();
  });

  it('avisa los datos del texto que no estan en la tabla', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    fireEvent.change(await screen.findByLabelText('Condiciones generales'), { target: { value: '{Horario de la pileta} {Guardavidas}' } });
    expect(screen.getByRole('status')).toHaveTextContent('{Guardavidas}');
    expect(screen.getByRole('status')).not.toHaveTextContent('{Horario de la pileta}');
    // En la vista, el que falta se marca aparte.
    expect(within(screen.getByLabelText('Así se lee en el contrato')).getByText('{Guardavidas}').tagName).toBe('MARK');
  });

  it('no deja guardar un dato con el nombre de uno del sistema', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    fireEvent.change(await screen.findByLabelText('Nombre del dato 1'), { target: { value: 'Máximo de personas' } });
    expect(screen.getByText('Ese dato ya lo pone el sistema.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('ya lo pone el sistema');
    expect(put()).toBeUndefined();
  });

  it('muestra el error del servidor', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'x'.repeat(130) } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
    expect(await screen.findByText('El título es muy largo: máximo 120 caracteres.')).toBeInTheDocument();
  });

  it('la vista previa arma el contrato con lo escrito y los datos reemplazados', async () => {
    render(<ContratoConfig establishment={ZEUS} />);
    await screen.findByDisplayValue('Horario de la pileta');
    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa en PDF' })[0]);

    const c = generarContratoPdf.mock.calls[0][0];
    expect(c.titulo).toBe('CONTRATACIÓN 2026-2027');
    expect(c.condiciones[0].texto).toBe('La pileta abre de 13.30 a 19.30 hs.');
    expect(c.nomina).toHaveLength(5);
    expect(c.titular.every(([, v]) => v === '')).toBe(true);
  });
});
