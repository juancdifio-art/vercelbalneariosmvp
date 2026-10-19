import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PreguntasFrecuentes from './PreguntasFrecuentes';
import SoportePanel from './SoportePanel';
import { PREGUNTAS_FRECUENTES, buscarPreguntas } from '../../config/preguntasFrecuentes';

const SECCIONES = ['inicio', 'vista-diaria', 'reservas', 'carpas', 'sombrillas', 'estacionamiento', 'pileta', 'clientes', 'reportes', 'tarifas', 'panel-usuario'];

describe('el contenido de las preguntas frecuentes', () => {
  it('cada pregunta tiene id unico, texto y secciones que existen', () => {
    const ids = PREGUNTAS_FRECUENTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PREGUNTAS_FRECUENTES.forEach((p) => {
      expect(p.pregunta.trim()).not.toBe('');
      expect(p.respuesta.trim()).not.toBe('');
      p.secciones.forEach((s) => expect(SECCIONES).toContain(s));
    });
  });

  it('la busqueda no distingue tildes ni mayusculas y exige todas las palabras', () => {
    expect(buscarPreguntas('SESION').map((p) => p.id)).toContain('sesion-vencio');
    expect(buscarPreguntas('efectivo hoy').map((p) => p.id)).toEqual(['caja-efectivo']);
    expect(buscarPreguntas('zzz nada')).toEqual([]);
    expect(buscarPreguntas('   ')).toHaveLength(PREGUNTAS_FRECUENTES.length);
  });
});

describe('preguntas frecuentes en pantalla', () => {
  it('primero muestra las de la pantalla actual', () => {
    render(<PreguntasFrecuentes seccion="tarifas" onEscribir={() => {}} />);
    const deEsta = screen.getByRole('heading', { name: 'Sobre esta pantalla' }).parentElement;
    expect(within(deEsta).getByText('¿Cómo cargo las temporadas y los precios?')).toBeInTheDocument();
    expect(within(deEsta).queryByText('¿Cómo registro un pago?')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Otras preguntas' })).toBeInTheDocument();
  });

  it('al tocar una pregunta se ve la respuesta', () => {
    render(<PreguntasFrecuentes seccion="reportes" onEscribir={() => {}} />);
    const pregunta = screen.getByText('Quiero saber cuánto se cobró hoy en efectivo.');
    const detalle = pregunta.closest('details');
    expect(detalle.open).toBe(false);
    fireEvent.click(pregunta);
    expect(detalle.open).toBe(true);
    expect(within(detalle).getByText(/Reportes → Pagos, con la fecha de hoy y el método Efectivo/)).toBeInTheDocument();
  });

  it('busca, y si no encuentra nada ofrece escribir', () => {
    const onEscribir = vi.fn();
    render(<PreguntasFrecuentes seccion="inicio" onEscribir={onEscribir} />);
    const buscador = screen.getByLabelText('Buscar en las preguntas frecuentes');

    fireEvent.change(buscador, { target: { value: 'patente' } });
    expect(screen.getByText(/resultado/)).toBeInTheDocument();
    expect(screen.getByText('Un cliente viene con otro auto.')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'helicoptero' } });
    expect(screen.getByText('No encontramos nada con “helicoptero”.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Escribinos' }));
    expect(onEscribir).toHaveBeenCalled();
  });
});

describe('las pestanas del panel de soporte', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ mensajes: [] }) }));
  });

  it('abre en preguntas frecuentes sin pedir el hilo; Escribinos pasa al chat', async () => {
    render(<SoportePanel abierto pantalla="Tarifas" seccion="tarifas" onCerrar={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Preguntas frecuentes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('¿Cómo cargo las temporadas y los precios?')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Escribinos' }));
    expect(screen.getByRole('tab', { name: 'Mensajes' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByLabelText('Mensaje')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/soporte\/mensajes$/);
  });

  it('con respuestas sin leer abre en Mensajes y las marca en la pestana', async () => {
    render(<SoportePanel abierto pantalla="Inicio" seccion="inicio" pestanaInicial="mensajes" noLeidos={2} onCerrar={() => {}} />);
    const mensajes = screen.getByRole('tab', { name: /Mensajes/ });
    expect(mensajes).toHaveAttribute('aria-selected', 'true');
    expect(within(mensajes).getByLabelText('2 sin leer')).toBeInTheDocument();
    expect(await screen.findByLabelText('Mensaje')).toBeInTheDocument();
  });
});
