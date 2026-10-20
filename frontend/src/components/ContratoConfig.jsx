import React, { useEffect, useRef, useState } from 'react';
import { leerContrato, guardarContrato } from '../lib/contratoApi';
import {
  armarContrato,
  datosFaltantes,
  esDatoDelSistema,
  reemplazarDatos,
  valoresDelContrato,
  TITULO_POR_DEFECTO
} from '../lib/contrato';
import { generarContratoPdf } from '../utils/generateContrato';
import { DocumentoIcon } from './icons';
import DatosContrato from './contrato/DatosContrato';
import TextoContrato from './contrato/TextoContrato';

const FILA_VACIA = { nombre: '', valor: '' };

function Bloque({ numero, titulo, ayuda, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-[12px] font-bold text-white">{numero}</span>
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">{titulo}</h3>
          {ayuda && <p className="text-[12px] text-slate-500">{ayuda}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

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
  const textareaRef = useRef(null);

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

  const cambiado = () => setOk('');
  const cambiarDato = (i, campo, valor) => {
    setDatos((prev) => prev.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)));
    cambiado();
  };
  const quitarDato = (i) => {
    setDatos((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [FILA_VACIA]));
    cambiado();
  };

  // Pone {Nombre} donde esta el cursor del texto (o al final) y deja el cursor despues.
  const insertar = (nombre) => {
    const marca = `{${nombre.trim()}}`;
    const area = textareaRef.current;
    const desde = area ? area.selectionStart : condiciones.length;
    const hasta = area ? area.selectionEnd : condiciones.length;
    setCondiciones(condiciones.slice(0, desde) + marca + condiciones.slice(hasta));
    cambiado();
    requestAnimationFrame(() => {
      if (!area) return;
      area.focus();
      area.setSelectionRange(desde + marca.length, desde + marca.length);
    });
  };

  const guardar = async (e) => {
    e?.preventDefault();
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

  const acciones = (
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" disabled={guardando} className="rounded-lg bg-cyan-600 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" onClick={vistaPrevia} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400 bg-white px-4 py-2 text-[13px] hover:bg-cyan-50">
        <DocumentoIcon className="h-4 w-4" />
        Vista previa en PDF
      </button>
      {ok && <span className="text-[12px] text-emerald-700">{ok}</span>}
    </div>
  );

  return (
    <form onSubmit={guardar} className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[12px] text-slate-600">
          Lo que se carga acá sale impreso en el contrato de cada carpa y sombrilla, debajo de los datos del titular, la unidad, el período y las personas.
          El contrato se imprime desde el detalle de la reserva.
        </p>
        {acciones}
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{error}</p>}

      <Bloque numero={1} titulo="Título" ayuda="Va arriba de todo, en mayúsculas. También acepta datos, como {Temporada}.">
        <label className="block">
          <span className="sr-only">Título</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => { setTitulo(e.target.value); cambiado(); }}
            placeholder={TITULO_POR_DEFECTO}
            maxLength={120}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-cyan-500 focus:outline-none"
          />
        </label>
        {titulo.includes('{') && (
          <p className="mt-1 px-1 text-[12px] text-slate-500">
            Se imprime: <span className="font-semibold text-slate-800">{reemplazarDatos(titulo, valores)}</span>
          </p>
        )}
      </Bloque>

      <Bloque
        numero={2}
        titulo="Datos del contrato"
        ayuda="Fechas, horarios y cantidades que cambian de una temporada a otra. Se cambian acá y se actualizan solos en todo el texto."
      >
        <DatosContrato
          datos={datos}
          sistema={sistema}
          onCambiar={cambiarDato}
          onQuitar={quitarDato}
          onAgregar={() => setDatos((prev) => [...prev, FILA_VACIA])}
          onInsertar={insertar}
        />
      </Bloque>

      <Bloque
        numero={3}
        titulo="Condiciones generales"
        ayuda="El texto del contrato. Para usar un dato, escribí su nombre entre llaves o tocá el botón de insertar en la tabla de arriba."
      >
        <TextoContrato
          condiciones={condiciones}
          valores={valores}
          onCambiar={(v) => { setCondiciones(v); cambiado(); }}
          textareaRef={textareaRef}
        />
        {faltan.length > 0 && (
          <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            En el texto hay datos que no están en la tabla y saldrían tal cual: {faltan.map((f) => `{${f}}`).join(', ')}. Agregalos en la tabla o corregí el nombre.
          </p>
        )}
      </Bloque>

      <div className="flex justify-end">{acciones}</div>
    </form>
  );
}

export default ContratoConfig;
