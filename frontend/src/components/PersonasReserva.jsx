import React, { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '../apiConfig';
import { edadDe, avisoCantidad } from '../lib/personas';

const API_BASE_URL = getApiBaseUrl();

const FORM_VACIO = { fullName: '', documentNumber: '', age: '', birthDate: '' };

// La lista de personas de una reserva, con alta, edicion y borrado.
// Solo el nombre es obligatorio: si el operador tiene el nombre y nada mas, lo
// carga igual.

function PersonasReserva({ reservationGroupId, adultsCount, childrenCount }) {
  const [personas, setPersonas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // null = no hay formulario abierto. 'nuevo' = alta. Un numero = editando esa persona.
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);

  const token = () => sessionStorage.getItem('authToken');

  const cargar = useCallback(async () => {
    if (!reservationGroupId) return;
    const t = token();
    if (!t) return;

    setCargando(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/reservation-groups/${reservationGroupId}/guests`,
        { headers: { Authorization: `Bearer ${t}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setPersonas(data.guests || []);
        setError('');
      } else {
        setError('No se pudieron cargar las personas.');
      }
    } catch (err) {
      console.error('Error cargando personas', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, [reservationGroupId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNueva = () => {
    setForm(FORM_VACIO);
    setEditando('nuevo');
    setError('');
  };

  const abrirEdicion = (persona) => {
    setForm({
      fullName: persona.fullName || '',
      documentNumber: persona.documentNumber || '',
      age: persona.age ?? '',
      birthDate: persona.birthDate ? String(persona.birthDate).slice(0, 10) : ''
    });
    setEditando(persona.id);
    setError('');
  };

  const cerrarForm = () => {
    setEditando(null);
    setForm(FORM_VACIO);
  };

  const guardar = async () => {
    if (!form.fullName || form.fullName.trim() === '') {
      setError('El nombre es obligatorio.');
      return;
    }

    const t = token();
    if (!t) return;

    const esNueva = editando === 'nuevo';
    const url = esNueva
      ? `${API_BASE_URL}/api/reservation-groups/${reservationGroupId}/guests`
      : `${API_BASE_URL}/api/reservation-guests/${editando}`;

    setGuardando(true);
    try {
      const response = await fetch(url, {
        method: esNueva ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          documentNumber: form.documentNumber || null,
          age: form.age === '' ? null : form.age,
          birthDate: form.birthDate || null
        })
      });

      if (!response.ok) {
        setError('No se pudo guardar la persona.');
        return;
      }

      cerrarForm();
      await cargar();
    } catch (err) {
      console.error('Error guardando persona', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (persona) => {
    const t = token();
    if (!t) return;

    setGuardando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reservation-guests/${persona.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${t}` }
      });

      if (!response.ok) {
        setError('No se pudo borrar la persona.');
        return;
      }

      await cargar();
    } catch (err) {
      console.error('Error borrando persona', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  const aviso = avisoCantidad(adultsCount, childrenCount, personas);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1">
          <span>👨‍👩‍👧‍👦</span>
          <span>Personas</span>
        </h3>
        {editando === null && (
          <button
            type="button"
            onClick={abrirNueva}
            className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-colors"
          >
            <span>+</span>
            <span>Agregar persona</span>
          </button>
        )}
      </div>

      {aviso && (
        <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
          {aviso}
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
          {error}
        </p>
      )}

      {cargando && <p className="text-[11px] text-slate-500">Cargando personas…</p>}

      {!cargando && personas.length === 0 && editando === null && (
        <p className="text-[11px] text-slate-500">Todavía no hay personas cargadas en esta reserva.</p>
      )}

      {personas.length > 0 && (
        <ul className="flex flex-col gap-2 mb-3">
          {personas.map((persona) => {
            const edad = edadDe(persona);
            return (
              <li
                key={persona.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{persona.fullName}</p>
                  <p className="text-[10px] text-slate-500">
                    {[
                      edad !== null ? `${edad} años` : null,
                      persona.documentNumber ? `DNI ${persona.documentNumber}` : null
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sin más datos'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Editar ${persona.fullName}`}
                    onClick={() => abrirEdicion(persona)}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar ${persona.fullName}`}
                    disabled={guardando}
                    onClick={() => borrar(persona)}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    ❌
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editando !== null && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold text-slate-700">Nombre y apellido</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">DNI</span>
              <input
                type="text"
                value={form.documentNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-700">Edad</span>
              <input
                type="number"
                min="0"
                value={form.age}
                onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold text-slate-700">
                Fecha de nacimiento (opcional)
              </span>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={guardar}
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {editando === 'nuevo' ? 'Agregar' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonasReserva;
