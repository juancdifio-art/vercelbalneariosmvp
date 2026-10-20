import React, { useEffect, useState } from 'react';
import { leerContrato, guardarContrato } from '../lib/contratoApi';
import {
  armarContrato,
  datosDelSistema,
  datosFaltantes,
  esDatoDelSistema,
  valoresDelContrato,
  TITULO_POR_DEFECTO
} from '../lib/contrato';
import { generarContratoPdf } from '../utils/generateContrato';

const FILA_VACIA = { nombre: '', valor: '' };

/**
 * Panel de usuario > Contrato: el titulo, los datos (fechas, horarios,
 * cantidades) y las condiciones generales que salen impresos en el contrato de
 * cada carpa o sombrilla. En las condiciones, {Nombre} se cambia por el valor
 * del dato, asi un horario se corrige en la tabla y no en el texto. La vista
 * previa descarga un contrato de ejemplo, con los datos del cliente en blanco.
 */
function ContratoConfig({ establishment }) {
  const [titulo, setTitulo] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const cargar = (c) => {
    setTitulo(c.titulo || '');
    setCondiciones(c.condiciones || '');
    setDatos(c.datos?.length ? c.datos : [FILA_VACIA]);
  };

  useEffect(() => {
    let vigente = true;
    leerContrato()
      .then((c) => vigente && cargar(c))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  const sistema = { nombreBalneario: establishment?.name, maxPersonas: establishment?.maxPersonasPorUnidad };
  const valores = valoresDelContrato(datos, sistema);
  const faltan = datosFaltantes(`${titulo}\n${condiciones}`, valores);
  const reservados = datos.filter((d) => esDatoDelSistema(d.nombre));

  const cambiarDato = (i, campo) => (e) => {
    const valor = e.target.value;
    setDatos((prev) => prev.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)));
    setOk('');
  };
  const quitarDato = (i) => setDatos((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [FILA_VACIA]));

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (reservados.length > 0) {
      setError(`"${reservados[0].nombre}" ya lo pone el sistema: cambiale el nombre a ese dato.`);
      return;
    }
    setGuardando(true);
    try {
      cargar(await guardarContrato({ titulo, condiciones, datos }));
      setOk('Contrato guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const vistaPrevia = () => {
    generarContratoPdf(armarContrato({
      establecimiento: establishment,
      contrato: { titulo, condiciones, datos },
      reserva: { serviceType: 'carpa', resourceNumber: '......', startDate: '', endDate: '' },
      maxPersonas: Number(establishment?.maxPersonasPorUnidad) || 6
    }));
  };

  if (cargando) return <p className="text-xs text-slate-500">Cargando…</p>;

  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

  return (
    <form onSubmit={guardar} className="space-y-5 max-w-3xl">
      <p className="text-[11px] text-slate-600">
        Esto sale impreso en el contrato de cada carpa y sombrilla, debajo de los datos del titular, la unidad, el período y las personas.
        El contrato se imprime desde el detalle de la reserva.
      </p>

      <label className="block text-[12px] text-slate-700">
        Título
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={TITULO_POR_DEFECTO}
          maxLength={120}
          className={`mt-1 ${input}`}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-[12px] font-semibold text-slate-800">Datos del contrato</legend>
        <p className="text-[11px] text-slate-500">
          Fechas, horarios y cantidades que cambian de una temporada a otra. En el texto se escriben entre llaves, por ejemplo {'{Horario de la pileta}'}, y en el contrato sale el valor.
        </p>
        <ul className="space-y-1 text-[12px]">
          {datosDelSistema(sistema).map((d) => (
            <li key={d.nombre} className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-white/60 px-3 py-1.5">
              <code className="text-cyan-800">{`{${d.nombre}}`}</code>
              <span className="font-medium text-slate-900">{d.valor || '—'}</span>
              <span className="text-[11px] text-slate-500">sale de {d.origen}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2" role="list" aria-label="Datos del contrato">
          {datos.map((d, i) => (
            <div key={i} role="listitem" className="grid gap-2 sm:grid-cols-[1fr,1fr,auto] sm:items-start">
              <label className="block text-[11px] text-slate-600">
                <span className="sr-only">Nombre del dato {i + 1}</span>
                <input type="text" value={d.nombre} onChange={cambiarDato(i, 'nombre')} placeholder="Nombre (ej.: Horario de la pileta)" maxLength={60} className={input} />
                {esDatoDelSistema(d.nombre) && <span className="mt-0.5 block text-rose-700">Ese dato ya lo pone el sistema.</span>}
              </label>
              <label className="block text-[11px] text-slate-600">
                <span className="sr-only">Valor del dato {i + 1}</span>
                <input type="text" value={d.valor} onChange={cambiarDato(i, 'valor')} placeholder="Valor (ej.: 13.30 a 19.30 hs)" maxLength={200} className={input} />
              </label>
              <button type="button" onClick={() => quitarDato(i)} aria-label={`Quitar el dato ${d.nombre || i + 1}`} className="rounded-lg px-3 py-2 text-[12px] text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setDatos((prev) => [...prev, FILA_VACIA])} className="rounded-full border border-cyan-400 bg-white px-3 py-1 text-[12px] hover:bg-cyan-50">
          + Agregar dato
        </button>
      </fieldset>

      <label className="block text-[12px] text-slate-700">
        Condiciones generales
        <textarea
          value={condiciones}
          onChange={(e) => setCondiciones(e.target.value)}
          rows={22}
          placeholder={'1 - La cantidad máxima de personas por unidad es de {Máximo de personas}.\n2 - ...'}
          className={`mt-1 ${input} font-mono text-[12px] leading-relaxed`}
        />
      </label>
      <p className="text-[11px] text-slate-500">
        Cada renglón sale como está. Para que uno salga en negrita, escribilo entre dos asteriscos de cada lado: **OBLIGATORIO**. Un renglón vacío separa párrafos.
      </p>
      {faltan.length > 0 && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          En el texto hay datos que no están en la tabla y saldrían tal cual: {faltan.map((f) => `{${f}}`).join(', ')}.
        </p>
      )}
      {error && <p role="alert" className="text-[12px] text-rose-700">{error}</p>}
      {ok && <p className="text-[12px] text-emerald-700">{ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className="rounded-lg bg-cyan-600 px-4 py-2 text-[13px] text-white disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={vistaPrevia} className="rounded-lg border border-cyan-400 bg-white px-4 py-2 text-[13px] hover:bg-cyan-50">
          Vista previa
        </button>
      </div>
    </form>
  );
}

export default ContratoConfig;
