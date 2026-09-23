import React, { useState } from 'react';
import { parseDiaMes, formatearDiaMes } from '../../lib/tarifas';
import TiraAnual from './TiraAnual';

const VACIO = { nombre: '', desde: '', hasta: '', prioridad: '1' };
const entrada = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';

function PeriodosTab({ periodos, calendario, ejecutar }) {
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState('');

  const campo = (clave) => (e) => setForm((f) => ({ ...f, [clave]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    const desde = parseDiaMes(form.desde);
    const hasta = parseDiaMes(form.hasta);
    if (!form.nombre.trim()) return setError('Poné un nombre.');
    if (!desde || !hasta) return setError('Las fechas van como día/mes, por ejemplo 15/12.');
    const body = {
      nombre: form.nombre.trim(), mesInicio: desde.mes, diaInicio: desde.dia,
      mesFin: hasta.mes, diaFin: hasta.dia, prioridad: Number(form.prioridad) || 1
    };
    const err = editando
      ? await ejecutar(`tarifas/periodos/${editando}`, { method: 'PATCH', body })
      : await ejecutar('tarifas/periodos', { method: 'POST', body });
    setError(err);
    if (!err) {
      setForm(VACIO);
      setEditando(null);
    }
  };

  const editar = (p) => {
    setEditando(p.id);
    setError('');
    setForm({ nombre: p.nombre, desde: formatearDiaMes(p.mesInicio, p.diaInicio), hasta: formatearDiaMes(p.mesFin, p.diaFin), prioridad: String(p.prioridad) });
  };

  const borrar = async (p) => {
    if (!window.confirm(`¿Borrar "${p.nombre}"? También se borran sus precios.`)) return;
    setError(await ejecutar(`tarifas/periodos/${p.id}`, { method: 'DELETE' }));
  };

  return (
    <div className="space-y-4">
      <TiraAnual periodos={periodos} calendario={calendario} />

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1">Período</th>
            <th className="py-1">Fechas</th>
            <th className="py-1">Prioridad</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={p.id} className="border-t border-slate-200">
              <td className="py-1.5 font-semibold text-slate-900">{p.nombre}</td>
              <td className="py-1.5">{formatearDiaMes(p.mesInicio, p.diaInicio)} → {formatearDiaMes(p.mesFin, p.diaFin)}</td>
              <td className="py-1.5">{p.prioridad}</td>
              <td className="py-1.5 text-right space-x-2">
                <button type="button" onClick={() => editar(p)} className="text-cyan-700 hover:underline">Editar</button>
                <button type="button" onClick={() => borrar(p)} className="text-red-700 hover:underline">Borrar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={guardar} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] font-semibold text-slate-700">Nombre del período</span>
          <input value={form.nombre} onChange={campo('nombre')} className={entrada} placeholder="Temporada alta" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Desde (día/mes)</span>
          <input value={form.desde} onChange={campo('desde')} className={entrada} placeholder="15/12" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Hasta (día/mes)</span>
          <input value={form.hasta} onChange={campo('hasta')} className={entrada} placeholder="15/03" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Prioridad</span>
          <input value={form.prioridad} onChange={campo('prioridad')} inputMode="numeric" className={entrada} />
        </label>
        <p className="col-span-2 text-[10px] text-slate-500 sm:col-span-3">
          Si dos períodos se pisan, gana el de mayor prioridad. Ej.: Navidad con prioridad 10 dentro de Temporada alta con 1.
        </p>
        <div className="col-span-2 flex justify-end gap-2">
          {editando && (
            <button type="button" onClick={() => { setEditando(null); setForm(VACIO); }} className="px-3 py-2 text-xs text-slate-600">Cancelar</button>
          )}
          <button type="submit" className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">
            {editando ? 'Guardar período' : 'Agregar período'}
          </button>
        </div>
        {error && <p role="alert" className="col-span-2 text-xs text-red-700 sm:col-span-5">{error}</p>}
      </form>
    </div>
  );
}

export default PeriodosTab;
