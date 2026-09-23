import React, { useState } from 'react';
import PlanoBalneario from '../PlanoBalneario';
import { PALETA, colorSuave } from '../../lib/tarifas';

const entrada = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const PREFIJO = { carpa: 'Carpa', sombrilla: 'Sombrilla', parking: 'Plaza' };

/**
 * Sectores de unidades con precio propio (Terraza, Frente al mar).
 * Se arman tocando el plano; una unidad esta en un solo sector, asi que las
 * de otro sector se ven con su color y no se pueden tomar.
 */
function SectoresTab({ servicios, sectores, ejecutar, establishment }) {
  const [serviceType, setServiceType] = useState(servicios[0]?.id ?? 'carpa');
  const [editando, setEditando] = useState(null); // { id, nombre, color, unidades: Set }
  const [error, setError] = useState('');

  const propios = sectores.filter((s) => s.serviceType === serviceType);
  const duenoDe = new Map();
  propios.forEach((s) => {
    if (!editando || s.id !== editando.id) s.unidades.forEach((n) => duenoDe.set(n, s));
  });

  const alternar = (_tipo, numero) => {
    if (!editando || duenoDe.has(numero)) return;
    setEditando((prev) => {
      const unidades = new Set(prev.unidades);
      if (unidades.has(numero)) unidades.delete(numero);
      else unidades.add(numero);
      return { ...prev, unidades };
    });
  };

  const estadoDe = (_tipo, numero) => {
    if (editando?.unidades.has(numero)) {
      return { estado: 'libre', title: `${editando.nombre || 'Sector nuevo'} · ${numero}`, color: { fill: editando.color, stroke: '#0F172A', texto: '#FFFFFF' } };
    }
    const otro = duenoDe.get(numero);
    if (otro) return { estado: 'libre', title: `${otro.nombre} · ${numero}`, color: { fill: colorSuave(otro.color), stroke: otro.color, texto: '#0F172A' } };
    return { estado: 'libre', title: `Sin sector · ${numero}` };
  };

  const nuevo = () => {
    setError('');
    // El primer color que no use otro sector del mismo servicio.
    const libre = PALETA.find((c) => !propios.some((s) => s.color === c.fuerte)) ?? PALETA[0];
    setEditando({ id: null, nombre: '', color: libre.fuerte, unidades: new Set() });
  };

  const guardar = async () => {
    if (!editando.nombre.trim()) return setError('Poné un nombre.');
    const body = { serviceType, nombre: editando.nombre.trim(), color: editando.color, unidades: [...editando.unidades].sort((a, b) => a - b) };
    const err = editando.id
      ? await ejecutar(`tarifas/sectores/${editando.id}`, { method: 'PATCH', body })
      : await ejecutar('tarifas/sectores', { method: 'POST', body });
    setError(err);
    if (!err) setEditando(null);
  };

  const borrar = async (s) => {
    if (!window.confirm(`¿Borrar el sector "${s.nombre}"? También se borran sus precios.`)) return;
    setError(await ejecutar(`tarifas/sectores/${s.id}`, { method: 'DELETE' }));
  };

  const plazas = Array.from({ length: Number(establishment?.parkingCapacity) || 0 }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Servicio</span>
          <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); setEditando(null); }} className={entrada}>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {!editando && (
          <button type="button" onClick={nuevo} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">Nuevo sector</button>
        )}
      </div>

      <ul className="flex flex-wrap gap-2">
        {propios.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="font-semibold">{s.nombre}</span>
            <span className="text-slate-500">{s.unidades.length} unidades</span>
            <button type="button" onClick={() => { setError(''); setEditando({ ...s, unidades: new Set(s.unidades) }); }} className="text-cyan-700 hover:underline">Editar</button>
            <button type="button" onClick={() => borrar(s)} className="text-red-700 hover:underline">Borrar</button>
          </li>
        ))}
      </ul>

      {editando && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-700">Nombre del sector</span>
            <input value={editando.nombre} onChange={(e) => setEditando((p) => ({ ...p, nombre: e.target.value }))} className={entrada} placeholder="Terraza" />
          </label>
          <div className="flex gap-1" role="radiogroup" aria-label="Color">
            {PALETA.map((c) => (
              <button
                key={c.fuerte}
                type="button"
                role="radio"
                aria-checked={editando.color === c.fuerte}
                aria-label={`Color ${c.fuerte}`}
                onClick={() => setEditando((p) => ({ ...p, color: c.fuerte }))}
                className={`h-6 w-6 rounded ${editando.color === c.fuerte ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                style={{ backgroundColor: c.fuerte }}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-600">{editando.unidades.size} unidades elegidas. Tocá el plano para sumar o sacar.</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setEditando(null)} className="px-3 py-2 text-xs text-slate-600">Cancelar</button>
            <button type="button" onClick={guardar} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">Guardar sector</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      {serviceType === 'parking' ? (
        <div className="flex flex-wrap gap-1">
          {plazas.map((n) => {
            const otro = duenoDe.get(n);
            const elegida = editando?.unidades.has(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={Boolean(elegida)}
                disabled={Boolean(otro)}
                title={otro ? otro.nombre : undefined}
                onClick={() => alternar('parking', n)}
                className="h-8 w-16 rounded border text-[11px] font-semibold disabled:cursor-not-allowed"
                style={elegida ? { backgroundColor: editando.color, color: '#fff' } : otro ? { backgroundColor: colorSuave(otro.color) } : undefined}
              >
                {PREFIJO.parking} {n}
              </button>
            );
          })}
        </div>
      ) : (
        <PlanoBalneario
          vista={serviceType === 'carpa' ? 'carpas' : 'sombrillas'}
          estadoDe={estadoDe}
          onUnidadClick={alternar}
          className="h-auto w-full rounded-xl border border-slate-200"
        />
      )}
    </div>
  );
}

export default SectoresTab;
