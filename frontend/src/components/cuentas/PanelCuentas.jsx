import React, { useCallback, useEffect, useState } from 'react';
import { SalirIcon } from '../icons';
import { fechaCorta } from '../../lib/formato';
import { pedirCuentas } from '../../hooks/useCuentas';

const SIN_MODELO = '';

/**
 * Cuentas de toda la app, para el administrador general: lista, alta (con la
 * configuracion de un balneario existente o sin balneario) y clave nueva.
 * Sola ocupa la pantalla (administrador sin balneario, con su cerrar sesion);
 * `embebida` va como una seccion mas en la app de un balneario.
 */
function PanelCuentas({ userEmail, onLogout, embebida = false }) {
  const [cuentas, setCuentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState('');

  const [email, setEmail] = useState('');
  const [modelo, setModelo] = useState(SIN_MODELO);
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');

  // La clave recien generada: se muestra una sola vez.
  const [entregada, setEntregada] = useState(null);
  const [copiada, setCopiada] = useState(false);
  const [errorClave, setErrorClave] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await pedirCuentas();
      setCuentas(d.cuentas || []);
      setErrorLista('');
    } catch (e) {
      setErrorLista(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const modelos = cuentas.filter((c) => c.balneario);
  const miEmail = String(userEmail || '').toLowerCase();

  const crear = async (e) => {
    e.preventDefault();
    setErrorAlta('');
    setCreando(true);
    try {
      const body = { email };
      if (modelo !== SIN_MODELO) {
        body.copiarDe = Number(modelo);
        body.nombre = nombre;
      }
      const d = await pedirCuentas('', { method: 'POST', body });
      setEntregada({ titulo: 'Cuenta creada', email: d.cuenta.email, clave: d.clave, balneario: d.cuenta.balneario?.nombre || null });
      setCopiada(false);
      setEmail('');
      setNombre('');
      setModelo(SIN_MODELO);
      cargar();
    } catch (err) {
      setErrorAlta(err.message);
    } finally {
      setCreando(false);
    }
  };

  const nuevaClave = async (cuenta) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`¿Generar una clave nueva para ${cuenta.email}? La que tiene ahora deja de funcionar.`)) return;
    setErrorClave('');
    try {
      const d = await pedirCuentas(`${cuenta.id}/clave`, { method: 'POST' });
      setEntregada({ titulo: 'Clave nueva', email: d.cuenta.email, clave: d.clave, balneario: null });
      setCopiada(false);
    } catch (err) {
      setErrorClave(err.message);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Usuario: ${entregada.email}\nClave: ${entregada.clave}`);
      setCopiada(true);
    } catch {
      // Sin permiso de portapapeles queda a la vista para copiarla a mano.
    }
  };

  const contenido = (
    <div className="space-y-5">
      <form onSubmit={crear} className="rounded-xl border border-cyan-100 bg-sky-50 px-4 py-4 text-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Nueva cuenta</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="block text-[12px] text-slate-700">
            Configuración
            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value={SIN_MODELO}>Ninguna: el cliente la carga al entrar</option>
              {modelos.map((c) => (
                <option key={c.balneario.id} value={c.balneario.id}>Copiar de {c.balneario.nombre}</option>
              ))}
            </select>
          </label>
          {modelo !== SIN_MODELO && (
            <label className="block text-[12px] text-slate-700 sm:col-span-2">
              Nombre del balneario
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={255}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          )}
        </div>
        {modelo !== SIN_MODELO && (
          <p className="text-[12px] text-slate-500">
            Se copian los servicios, las capacidades, los períodos, los sectores y las tarifas. No se copian clientes ni reservas.
          </p>
        )}
        {errorAlta && <p role="alert" className="text-[12px] text-rose-700">{errorAlta}</p>}
        <button
          type="submit"
          disabled={creando}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-[13px] text-white disabled:opacity-60"
        >
          {creando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      {entregada && (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm space-y-2">
          <p className="font-semibold text-emerald-900">{entregada.titulo}</p>
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-slate-600">Usuario</dt>
            <dd className="font-medium text-slate-900 break-all">{entregada.email}</dd>
            <dt className="text-slate-600">Clave</dt>
            <dd className="font-mono text-base font-semibold tracking-wide text-slate-900">{entregada.clave}</dd>
            {entregada.balneario && (
              <>
                <dt className="text-slate-600">Balneario</dt>
                <dd className="text-slate-900">{entregada.balneario}</dd>
              </>
            )}
          </dl>
          <p className="text-[12px] text-emerald-900">
            Anotala ahora: no se vuelve a mostrar. El cliente la puede cambiar desde el Panel de usuario.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={copiar} className="rounded-full border border-emerald-400 bg-white px-3 py-1 text-[12px] hover:bg-emerald-100">
              {copiada ? 'Copiada' : 'Copiar usuario y clave'}
            </button>
            <button type="button" onClick={() => setEntregada(null)} className="rounded-full px-3 py-1 text-[12px] text-slate-600 hover:bg-emerald-100">
              Listo
            </button>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white text-sm">
        <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          Cuentas {!cargando && <span className="font-normal text-slate-500">({cuentas.length})</span>}
        </h2>
        {errorLista && <p role="alert" className="px-4 py-3 text-[12px] text-rose-700">{errorLista}</p>}
        {errorClave && <p role="alert" className="px-4 py-3 text-[12px] text-rose-700">{errorClave}</p>}
        {cargando ? (
          <p className="px-4 py-3 text-xs text-slate-500">Cargando…</p>
        ) : (
          <ul aria-label="Cuentas" className="divide-y divide-slate-100">
            {cuentas.map((c) => {
              const propia = c.email.toLowerCase() === miEmail;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <span className="break-all">{c.email}</span>
                      {c.administra && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">Administrador</span>}
                      {c.rol === 'soporte' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">Soporte</span>}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {c.balneario ? c.balneario.nombre : 'Sin balneario'}
                      {c.balneario && ` · ${c.reservas} ${c.reservas === 1 ? 'reserva' : 'reservas'}`}
                      {c.creada && ` · desde ${fechaCorta(c.creada)}`}
                    </p>
                  </div>
                  {!propia && !c.administra && (
                    <button
                      type="button"
                      onClick={() => nuevaClave(c)}
                      aria-label={`Clave nueva para ${c.email}`}
                      className="rounded-full border border-cyan-400 bg-white px-3 py-1 text-[12px] hover:bg-cyan-50"
                    >
                      Clave nueva
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );

  if (embebida) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cuentas</h2>
          <p className="text-xs text-slate-600">Todas las cuentas de la aplicación. Desde acá se crea la de cada balneario.</p>
        </div>
        {contenido}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between gap-3 bg-sky-900 px-4 py-3 text-white">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Cuentas</h1>
          <p className="truncate text-xs text-sky-200">{userEmail}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sky-100 hover:bg-sky-800"
        >
          <SalirIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{contenido}</main>
    </div>
  );
}

export default PanelCuentas;
