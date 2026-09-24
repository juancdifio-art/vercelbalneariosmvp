import React, { useCallback, useEffect, useState } from 'react';
import { pedirTarifas, mensajeError } from '../../lib/tarifasApi';
import PeriodosTab from './PeriodosTab';
import SectoresTab from './SectoresTab';
import PreciosTab from './PreciosTab';

const PESTANAS = [
  { id: 'periodos', label: 'Períodos' },
  { id: 'sectores', label: 'Sectores' },
  { id: 'precios', label: 'Precios' }
];

function serviciosDe(establishment) {
  const servicios = [];
  if (establishment?.hasCarpas) servicios.push({ id: 'carpa', label: 'Carpas' });
  if (establishment?.hasSombrillas) servicios.push({ id: 'sombrilla', label: 'Sombrillas' });
  if (establishment?.hasParking) servicios.push({ id: 'parking', label: 'Estacionamiento' });
  return servicios;
}

/**
 * Configuracion de tarifas: periodos del anio, sectores de unidades y precios.
 * Cada cambio se guarda al momento y recarga todo: son pocas filas y asi la
 * pantalla nunca muestra algo distinto a lo que quedo en la base.
 */
function TarifasSection({ establishment }) {
  const [pestana, setPestana] = useState('periodos');
  const [datos, setDatos] = useState({ periodos: [], calendario: [], sectores: [], tarifas: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    try {
      const [p, s, t] = await Promise.all([pedirTarifas('tarifas/periodos'), pedirTarifas('tarifas/sectores'), pedirTarifas('tarifas')]);
      setDatos({ periodos: p.periodos, calendario: p.calendario, sectores: s.sectores, tarifas: t.tarifas });
      setError('');
    } catch (e) {
      console.error('Error cargando tarifas', e);
      setError('No se pudieron cargar las tarifas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const ejecutar = useCallback(async (ruta, opciones) => {
    try {
      await pedirTarifas(ruta, opciones);
      await recargar();
      return '';
    } catch (e) {
      return mensajeError(e);
    }
  }, [recargar]);

  const servicios = serviciosDe(establishment);
  const props = { ...datos, servicios, establishment, ejecutar };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-bold text-slate-900">Tarifas</h2>
        <p className="text-xs text-slate-600">
          Los precios por fecha se repiten todos los años. Una tarifa por estadía, si aplica, reemplaza a las de fecha.
        </p>
      </header>

      <div role="tablist" aria-label="Tarifas" className="flex gap-1 border-b border-slate-200">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${pestana === p.id ? 'border-cyan-600 text-cyan-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      {cargando ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : (
        <div role="tabpanel">
          {pestana === 'periodos' && <PeriodosTab {...props} />}
          {pestana === 'sectores' && <SectoresTab {...props} />}
          {pestana === 'precios' && <PreciosTab {...props} />}
        </div>
      )}
    </section>
  );
}

export default TarifasSection;
