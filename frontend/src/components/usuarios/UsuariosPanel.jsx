import React, { useCallback, useEffect, useState } from 'react';
import { fechaCorta } from '../../lib/formato';
import { pedirUsuarios, ETIQUETA_ROL, AYUDA_ROL } from '../../lib/usuariosApi';
import { QuitarIcon } from '../icons';

const ROLES = ['operador', 'pileta'];

/**
 * Panel de usuario > Usuarios: el encargado suma a su personal (empleados y
 * pileta), le cambia el rol, le genera una clave nueva o lo quita. La clave
 * se ve una sola vez, al crearla.
 */
function UsuariosPanel() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('operador');
  const [creando, setCreando] = useState(false);
  const [entregada, setEntregada] = useState(null);
  const [copiada, setCopiada] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setUsuarios((await pedirUsuarios()).usuarios || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const entregar = (titulo, d) => {
    setEntregada({ titulo, email: d.usuario.email, clave: d.clave });
    setCopiada(false);
  };

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    setCreando(true);
    try {
      entregar('Usuario creado', await pedirUsuarios('', { method: 'POST', body: { email, rol } }));
      setEmail('');
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const accion = async (fn) => {
    setError('');
    try {
      await fn();
      cargar();
    } catch (err) {
      setError(err.message);
    }
  };

  const cambiarRol = (u, nuevo) => accion(() => pedirUsuarios(String(u.id), { method: 'PATCH', body: { rol: nuevo } }));
  const claveNueva = (u) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Generar una clave nueva para ${u.email}? La que tiene ahora deja de funcionar.`)) return;
    accion(async () => entregar('Clave nueva', await pedirUsuarios(`${u.id}/clave`, { method: 'POST' })));
  };
  const quitar = (u) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Quitar a ${u.email}? Ya no va a poder entrar.`)) return;
    accion(() => pedirUsuarios(String(u.id), { method: 'DELETE' }));
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Usuario: ${entregada.email}\nClave: ${entregada.clave}`);
      setCopiada(true);
    } catch {
      // Sin permiso de portapapeles queda a la vista para copiarla a mano.
    }
  };

  if (cargando) return <p className="text-xs text-slate-500">Cargando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-[12px] text-slate-600">
        Cada persona del balneario entra con su propio usuario y ve lo que su rol le permite. El dueño administra todo.
      </p>

      <form onSubmit={crear} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-[14px] font-semibold text-slate-900">Nuevo usuario</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="block text-[12px] text-slate-700">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label className="block text-[12px] text-slate-700">
            Rol
            <select value={rol} onChange={(e) => setRol(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[12px] text-slate-500">{AYUDA_ROL[rol]}</p>
        <button type="submit" disabled={creando} className="rounded-lg bg-cyan-600 px-4 py-2 text-[13px] text-white disabled:opacity-60">
          {creando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</p>}

      {entregada && (
        <div role="status" className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm">
          <p className="font-semibold text-emerald-900">{entregada.titulo}</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-slate-600">Usuario</dt>
            <dd className="break-all font-medium text-slate-900">{entregada.email}</dd>
            <dt className="text-slate-600">Clave</dt>
            <dd className="font-mono text-base font-semibold tracking-wide text-slate-900">{entregada.clave}</dd>
          </dl>
          <p className="text-[12px] text-emerald-900">Anotala ahora: no se vuelve a mostrar. La puede cambiar desde su Panel de usuario.</p>
          <div className="flex gap-2">
            <button type="button" onClick={copiar} className="rounded-full border border-emerald-400 bg-white px-3 py-1 text-[12px] hover:bg-emerald-100">
              {copiada ? 'Copiada' : 'Copiar usuario y clave'}
            </button>
            <button type="button" onClick={() => setEntregada(null)} className="rounded-full px-3 py-1 text-[12px] text-slate-600 hover:bg-emerald-100">Listo</button>
          </div>
        </div>
      )}

      <ul aria-label="Usuarios del balneario" className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {usuarios.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="break-all font-medium text-slate-900">{u.email}</p>
              <p className="text-[12px] text-slate-500">{u.creado ? `desde ${fechaCorta(u.creado)}` : ''}</p>
            </div>
            {u.encargado ? (
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">{ETIQUETA_ROL.admin}</span>
            ) : (
              <div className="flex items-center gap-2">
                <label>
                  <span className="sr-only">Rol de {u.email}</span>
                  <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[12px]">
                    {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => claveNueva(u)} aria-label={`Clave nueva para ${u.email}`} className="rounded-full border border-cyan-400 bg-white px-3 py-1 text-[12px] hover:bg-cyan-50">
                  Clave nueva
                </button>
                <button type="button" onClick={() => quitar(u)} aria-label={`Quitar a ${u.email}`} title="Quitar" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                  <QuitarIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UsuariosPanel;
