import React, { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';
import EstablishmentConfigForm from './EstablishmentConfigForm';

const API_BASE_URL = getApiBaseUrl();

const ETIQUETA_ROL = {
  admin: 'Administrador',
  operador: 'Operador'
};

/**
 * Panel de usuario: perfil y configuracion del establecimiento.
 *
 * Son dos solapas y no una pagina apilada porque mas adelante entran Precios y
 * Usuarios; con solapas, sumar una es agregar un item a SOLAPAS.
 *
 * El establecimiento llega como un unico objeto `establecimiento` en vez de 25
 * props sueltas: asi App.jsx —que ya tiene 2781 lineas— no suma 25 lineas de
 * cableado, y la firma de EstablishmentConfigForm queda intacta para que el
 * onboarding la siga usando igual.
 */
const SOLAPAS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'establecimiento', label: 'Establecimiento' }
];

function PanelUsuarioSection({ authToken, userEmail, onEmailChanged, establecimiento }) {
  const [solapa, setSolapa] = useState('perfil');
  const [perfil, setPerfil] = useState(null);

  const [editandoEmail, setEditandoEmail] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailOk, setEmailOk] = useState('');
  const [emailGuardando, setEmailGuardando] = useState(false);

  const [editandoPassword, setEditandoPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordOk, setPasswordOk] = useState('');
  const [passwordGuardando, setPasswordGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function traerPerfil() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado) setPerfil(data);
      } catch (err) {
        // Sin perfil solo se pierde el badge de nivel de acceso; el resto del
        // panel sigue usable, asi que no se muestra error.
      }
    }

    if (authToken) traerPerfil();
    return () => {
      cancelado = true;
    };
  }, [authToken]);

  const emailMostrado = (perfil && perfil.email) || userEmail;

  async function guardarEmail(e) {
    e.preventDefault();
    setEmailError('');
    setEmailOk('');

    if (!nuevoEmail || !emailPassword) {
      setEmailError('Completá el email nuevo y tu contraseña.');
      return;
    }

    setEmailGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/email`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ newEmail: nuevoEmail, currentPassword: emailPassword })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const mensajes = {
          invalid_email: 'Ese email no tiene un formato válido.',
          email_taken: 'Ese email ya está en uso.',
          invalid_password: 'La contraseña no es correcta.',
          missing_fields: 'Faltan datos.'
        };
        setEmailError((data && mensajes[data.error]) || 'No se pudo cambiar el email.');
        return;
      }

      setPerfil(data);
      setEmailOk('Email actualizado.');
      setEditandoEmail(false);
      setNuevoEmail('');
      setEmailPassword('');
      if (typeof onEmailChanged === 'function') onEmailChanged(data.email);
    } catch (err) {
      setEmailError('No se pudo conectar con el servidor.');
    } finally {
      setEmailGuardando(false);
    }
  }

  async function guardarPassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordOk('');

    if (!passwordActual || !passwordNueva) {
      setPasswordError('Completá las dos contraseñas.');
      return;
    }

    // Se valida acá antes de salir a la red: el error es el mismo y el usuario
    // lo ve al instante.
    if (passwordNueva.length < 8) {
      setPasswordError('La contraseña nueva necesita al menos 8 caracteres.');
      return;
    }

    setPasswordGuardando(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ currentPassword: passwordActual, newPassword: passwordNueva })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const mensajes = {
          invalid_password: 'La contraseña actual no es correcta.',
          password_too_short: 'La contraseña nueva necesita al menos 8 caracteres.',
          missing_fields: 'Faltan datos.'
        };
        setPasswordError((data && mensajes[data.error]) || 'No se pudo cambiar la contraseña.');
        return;
      }

      setPasswordOk('Contraseña actualizada.');
      setEditandoPassword(false);
      setPasswordActual('');
      setPasswordNueva('');
    } catch (err) {
      setPasswordError('No se pudo conectar con el servidor.');
    } finally {
      setPasswordGuardando(false);
    }
  }

  return (
    <div className="rounded-xl bg-sky-50 border border-cyan-100 px-4 py-4 text-sm">
      <div className="flex gap-1 border-b border-cyan-200 mb-4">
        {SOLAPAS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSolapa(s.id)}
            className={
              'px-4 py-2 text-[13px] font-medium rounded-t-lg transition ' +
              (solapa === s.id
                ? 'bg-white text-cyan-900 border border-cyan-200 border-b-white -mb-px'
                : 'text-slate-600 hover:text-cyan-800')
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {solapa === 'perfil' && (
        <div className="space-y-5 max-w-lg">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-900 font-medium">{emailMostrado}</span>
              <button
                type="button"
                onClick={() => setEditandoEmail((v) => !v)}
                className="text-[12px] px-3 py-1 rounded-full border border-cyan-400 bg-white hover:bg-cyan-50"
              >
                Cambiar email
              </button>
            </div>
            {emailOk && <p className="text-[12px] text-emerald-700 mt-1">{emailOk}</p>}

            {editandoEmail && (
              <form onSubmit={guardarEmail} className="mt-3 space-y-2">
                <label className="block text-[12px] text-slate-700">
                  Email nuevo
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-[12px] text-slate-700">
                  Tu contraseña
                  <input
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                {emailError && <p className="text-[12px] text-rose-700">{emailError}</p>}
                <button
                  type="submit"
                  disabled={emailGuardando}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-[13px] disabled:opacity-60"
                >
                  {emailGuardando ? 'Guardando…' : 'Guardar email'}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-cyan-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Contraseña</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">••••••••</span>
              <button
                type="button"
                onClick={() => setEditandoPassword((v) => !v)}
                className="text-[12px] px-3 py-1 rounded-full border border-cyan-400 bg-white hover:bg-cyan-50"
              >
                Cambiar contraseña
              </button>
            </div>
            {passwordOk && <p className="text-[12px] text-emerald-700 mt-1">{passwordOk}</p>}

            {editandoPassword && (
              <form onSubmit={guardarPassword} className="mt-3 space-y-2">
                <label className="block text-[12px] text-slate-700">
                  Contraseña actual
                  <input
                    type="password"
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-[12px] text-slate-700">
                  Contraseña nueva
                  <input
                    type="password"
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                {passwordError && <p className="text-[12px] text-rose-700">{passwordError}</p>}
                <button
                  type="submit"
                  disabled={passwordGuardando}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-[13px] disabled:opacity-60"
                >
                  {passwordGuardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-cyan-100 pt-4">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Nivel de acceso</p>
            <span className="inline-block px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 text-[12px] font-medium">
              {(perfil && ETIQUETA_ROL[perfil.role]) || '—'}
            </span>
          </div>
        </div>
      )}

      {solapa === 'establecimiento' && (
        <div>
          <p className="text-[11px] text-slate-600 mb-4">
            Actualizá el nombre y los servicios del establecimiento. Los cambios impactan en todas las secciones.
          </p>
          <EstablishmentConfigForm variant="light" {...establecimiento} />
        </div>
      )}
    </div>
  );
}

export default PanelUsuarioSection;
