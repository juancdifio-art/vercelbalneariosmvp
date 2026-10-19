import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PreguntasFrecuentes from './PreguntasFrecuentes';
import SoportePanel from './SoportePanel';
import { PREGUNTAS_FRECUENTES, buscarPreguntas, imagenesDe } from '../../config/preguntasFrecuentes';

const CARPETA_AYUDA = path.resolve(__dirname, '../../../public/ayuda');

// <details> en jsdom: abrirlo dispara el toggle que arma el contenido.
function abrir(pregunta) {
  const detalle = screen.getByText(pregunta).closest('details');
  detalle.open = true;
  fireEvent(detalle, new Event('toggle'));
  return detalle;
}

const SECCIONES = ['inicio', 'vista-diaria', 'reservas', 'carpas', 'sombrillas', 'estacionamiento', 'pileta', 'clientes', 'reportes', 'tarifas', 'panel-usuario'];

describe('el contenido de las preguntas frecuentes', () => {
  it('cada pregunta tiene id unico, resumen y secciones que existen', () => {
    const ids = PREGUNTAS_FRECUENTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PREGUNTAS_FRECUENTES.forEach((p) => {
      expect(p.pregunta.trim()).not.toBe('');
      expect(p.resumen.trim()).not.toBe('');
      (p.pasos || []).forEach((paso) => expect(paso.texto.trim()).not.toBe(''));
      p.secciones.forEach((s) => expect(SECCIONES).toContain(s));
    });
  });

  it('cada imagen que se nombra esta en public/ayuda', () => {
    const faltan = [...new Set(PREGUNTAS_FRECUENTES.flatMap(imagenesDe))]
      .filter((archivo) => !fs.existsSync(path.join(CARPETA_AYUDA, archivo)));
    expect(faltan).toEqual([]);
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

  it('cerrada no carga nada; abierta muestra los pasos numerados con su captura', () => {
    render(<PreguntasFrecuentes seccion="reportes" onEscribir={() => {}} />);
    expect(document.querySelectorAll('img')).toHaveLength(0);

    const detalle = abrir('Quiero saber cuánto se cobró hoy en efectivo.');
    const pasos = within(detalle).getAllByRole('listitem');
    expect(pasos).toHaveLength(3);
    expect(pasos[0]).toHaveTextContent('1Entrá a Reportes y elegí Pagos.');
    // Los nombres de botones y campos van en negrita.
    expect(within(pasos[2]).getByText('Efectivo').tagName).toBe('STRONG');
    const img = within(pasos[2]).getByRole('img');
    expect(img.getAttribute('src')).toMatch(/ayuda\/11-reportes-pagos\.png$/);
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('una captura se agranda y Esc la cierra', () => {
    render(<PreguntasFrecuentes seccion="tarifas" onEscribir={() => {}} />);
    const detalle = abrir('¿Cómo cargo las temporadas y los precios?');
    fireEvent.click(within(detalle).getAllByRole('button', { name: /Agrandar imagen/ })[0]);

    const ampliada = screen.getByRole('dialog', { name: 'Imagen ampliada' });
    expect(within(ampliada).getByRole('img').getAttribute('src')).toMatch(/13-tarifas-periodos\.png$/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Imagen ampliada' })).toBeNull();
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

  it('Esc con una captura agrandada cierra la captura, no el panel', () => {
    const onCerrar = vi.fn();
    render(<SoportePanel abierto pantalla="Tarifas" seccion="tarifas" onCerrar={onCerrar} />);
    const detalle = abrir('¿Cómo cargo las temporadas y los precios?');
    fireEvent.click(within(detalle).getAllByRole('button', { name: /Agrandar imagen/ })[0]);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Imagen ampliada' })).toBeNull();
    expect(onCerrar).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalled();
  });

  it('con respuestas sin leer abre en Mensajes y las marca en la pestana', async () => {
    render(<SoportePanel abierto pantalla="Inicio" seccion="inicio" pestanaInicial="mensajes" noLeidos={2} onCerrar={() => {}} />);
    const mensajes = screen.getByRole('tab', { name: /Mensajes/ });
    expect(mensajes).toHaveAttribute('aria-selected', 'true');
    expect(within(mensajes).getByLabelText('2 sin leer')).toBeInTheDocument();
    expect(await screen.findByLabelText('Mensaje')).toBeInTheDocument();
  });
});
