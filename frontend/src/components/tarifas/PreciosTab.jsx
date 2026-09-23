import React, { useEffect, useState } from 'react';
import { aNumero, filaCoincide, formatearPesos } from '../../lib/tarifas';

const entrada = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const PREFIJO = { carpa: 'Carpa', sombrilla: 'Sombrilla', parking: 'Plaza' };
const TODAS = { carpa: 'Todas las carpas', sombrilla: 'Todas las sombrillas', parking: 'Todo el estacionamiento' };
const ESTADIA_VACIA = { nombre: '', diasMin: '', diasMax: '', modo: 'cerrado', precio: '', periodoId: '', alcance: 'tipo', unidad: '' };

function CeldaPrecio({ etiqueta, inicial, general, onGuardar }) {
  const [texto, setTexto] = useState(inicial);
  useEffect(() => setTexto(inicial), [inicial]);
  return (
    <input
      aria-label={etiqueta}
      value={texto}
      inputMode="numeric"
      placeholder={general ? '' : 'usa general'}
      onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
      onBlur={() => {
        if (texto !== inicial) onGuardar(texto);
      }}
      className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
    />
  );
}

/**
 * Precios por tipo de servicio.
 * Por fecha: una grilla alcance x periodo; cada celda se guarda al salir.
 * Una celda vacia en un sector o unidad significa "usa el precio general".
 * Por estadia: una lista aparte, porque reemplaza a la grilla entera.
 */
function PreciosTab({ servicios, periodos, sectores, tarifas, ejecutar }) {
  const [serviceType, setServiceType] = useState(servicios[0]?.id ?? 'carpa');
  const [extras, setExtras] = useState([]);
  const [nuevaUnidad, setNuevaUnidad] = useState('');
  const [estadia, setEstadia] = useState(ESTADIA_VACIA);
  const [error, setError] = useState('');

  const propias = tarifas.filter((t) => t.serviceType === serviceType);
  const porFecha = propias.filter((t) => t.clase === 'fecha');
  const porEstadia = propias.filter((t) => t.clase === 'estadia');
  const sectoresPropios = sectores.filter((s) => s.serviceType === serviceType);
  const unidades = [...new Set([...porFecha.filter((t) => t.alcance === 'unidad').map((t) => t.resourceNumber), ...extras])].sort((a, b) => a - b);

  const filas = [
    { clave: 'tipo', etiqueta: TODAS[serviceType], alcance: 'tipo' },
    ...sectoresPropios.map((s) => ({ clave: `s${s.id}`, etiqueta: s.nombre, alcance: 'sector', sectorId: s.id })),
    ...unidades.map((n) => ({ clave: `u${n}`, etiqueta: `${PREFIJO[serviceType]} ${n}`, alcance: 'unidad', resourceNumber: n }))
  ];

  const guardarCelda = async (fila, periodo, texto) => {
    const existente = porFecha.find((t) => t.periodoId === periodo.id && filaCoincide(t, fila));
    const precio = aNumero(texto);
    let err = '';
    if (precio === null && existente) {
      err = await ejecutar(`tarifas/${existente.id}`, { method: 'DELETE' });
    } else if (precio !== null && existente) {
      err = await ejecutar(`tarifas/${existente.id}`, { method: 'PATCH', body: { precio } });
    } else if (precio !== null) {
      err = await ejecutar('tarifas', {
        method: 'POST',
        body: { serviceType, alcance: fila.alcance, sectorId: fila.sectorId ?? null, resourceNumber: fila.resourceNumber ?? null, clase: 'fecha', periodoId: periodo.id, precio }
      });
    }
    setError(err);
  };

  const agregarUnidad = () => {
    const n = Number(nuevaUnidad);
    if (Number.isInteger(n) && n > 0) setExtras((prev) => [...prev, n]);
    setNuevaUnidad('');
  };

  const campoEstadia = (clave) => (e) => setEstadia((f) => ({ ...f, [clave]: e.target.value }));

  const alcanceEstadia = () => {
    if (estadia.alcance === 'tipo') return { alcance: 'tipo', sectorId: null, resourceNumber: null };
    if (estadia.alcance === 'unidad') return { alcance: 'unidad', sectorId: null, resourceNumber: aNumero(estadia.unidad) };
    return { alcance: 'sector', sectorId: Number(estadia.alcance.slice(1)), resourceNumber: null };
  };

  const agregarEstadia = async (e) => {
    e.preventDefault();
    const err = await ejecutar('tarifas', {
      method: 'POST',
      body: {
        serviceType, ...alcanceEstadia(), clase: 'estadia', nombre: estadia.nombre.trim() || null,
        diasMin: aNumero(estadia.diasMin), diasMax: aNumero(estadia.diasMax), modo: estadia.modo,
        precio: aNumero(estadia.precio), periodoId: aNumero(estadia.periodoId)
      }
    });
    setError(err);
    if (!err) setEstadia(ESTADIA_VACIA);
  };

  const describirAlcance = (t) => {
    if (t.alcance === 'tipo') return TODAS[serviceType];
    if (t.alcance === 'sector') return sectores.find((s) => s.id === t.sectorId)?.nombre ?? 'Sector';
    return `${PREFIJO[serviceType]} ${t.resourceNumber}`;
  };

  const nombrePeriodo = (id) => periodos.find((p) => p.id === id)?.nombre;

  return (
    <div className="space-y-5">
      <label className="flex w-48 flex-col gap-1">
        <span className="text-[11px] font-semibold text-slate-700">Servicio</span>
        <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); setExtras([]); }} className={entrada}>
          {servicios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>

      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Por fecha (precio por día)</h3>
        {periodos.length === 0 ? (
          <p className="text-xs text-slate-500">Primero cargá los períodos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-slate-500" />
                  {periodos.map((p) => <th key={p.id} className="px-2 py-1 text-right text-slate-500">{p.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.clave} className="border-t border-slate-200">
                    <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-semibold text-slate-800">{fila.etiqueta}</th>
                    {periodos.map((p) => {
                      const t = porFecha.find((x) => x.periodoId === p.id && filaCoincide(x, fila));
                      return (
                        <td key={p.id} className="px-2 py-1 text-right">
                          <CeldaPrecio
                            etiqueta={`${fila.etiqueta} · ${p.nombre}`}
                            inicial={t ? String(t.precio) : ''}
                            general={fila.alcance === 'tipo'}
                            onGuardar={(texto) => guardarCelda(fila, p, texto)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Número de unidad</span>
            <input value={nuevaUnidad} onChange={(e) => setNuevaUnidad(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={`${entrada} w-28`} />
          </label>
          <button type="button" onClick={agregarUnidad} className="rounded-lg border border-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50">Agregar unidad</button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Por estadía</h3>
        <p className="text-[11px] text-slate-600">Si la estadía entra en el rango de días, se cobra esta tarifa y no las de fecha.</p>
        <ul className="space-y-1">
          {porEstadia.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
              <span className="font-semibold">{t.nombre || 'Estadía'}</span>
              <span>{t.diasMax ? `${t.diasMin} a ${t.diasMax} días` : `desde ${t.diasMin} días`}</span>
              <span>{t.modo === 'cerrado' ? `${formatearPesos(t.precio)} cerrado` : `${formatearPesos(t.precio)} por día`}</span>
              <span className="text-slate-500">{describirAlcance(t)}{t.periodoId ? ` · entrando en ${nombrePeriodo(t.periodoId)}` : ''}</span>
              <button type="button" onClick={async () => setError(await ejecutar(`tarifas/${t.id}`, { method: 'DELETE' }))} className="ml-auto text-red-700 hover:underline">Borrar</button>
            </li>
          ))}
        </ul>

        <form onSubmit={agregarEstadia} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-slate-700">Nombre de la tarifa</span>
            <input value={estadia.nombre} onChange={campoEstadia('nombre')} placeholder="Temporada completa" className={entrada} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Desde (días)</span>
            <input value={estadia.diasMin} onChange={campoEstadia('diasMin')} inputMode="numeric" className={entrada} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Hasta (días, vacío = sin tope)</span>
            <input value={estadia.diasMax} onChange={campoEstadia('diasMax')} inputMode="numeric" className={entrada} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Cómo se cobra</span>
            <select value={estadia.modo} onChange={campoEstadia('modo')} className={entrada}>
              <option value="cerrado">Precio cerrado</option>
              <option value="por_dia">Por día</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Precio (ARS)</span>
            <input value={estadia.precio} onChange={campoEstadia('precio')} inputMode="numeric" className={entrada} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Solo si entra en</span>
            <select value={estadia.periodoId} onChange={campoEstadia('periodoId')} className={entrada}>
              <option value="">Cualquier fecha</option>
              {periodos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Aplica a</span>
            <select value={estadia.alcance} onChange={campoEstadia('alcance')} className={entrada}>
              <option value="tipo">{TODAS[serviceType]}</option>
              {sectoresPropios.map((s) => <option key={s.id} value={`s${s.id}`}>{s.nombre}</option>)}
              <option value="unidad">Una unidad</option>
            </select>
          </label>
          {estadia.alcance === 'unidad' && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">Unidad</span>
              <input value={estadia.unidad} onChange={campoEstadia('unidad')} inputMode="numeric" className={entrada} />
            </label>
          )}
          <div className="col-span-2 flex justify-end sm:col-span-4">
            <button type="submit" className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">Agregar tarifa por estadía</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default PreciosTab;
