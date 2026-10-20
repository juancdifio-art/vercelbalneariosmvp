import React, { useEffect, useState } from 'react';
import { leerContrato, guardarContrato } from '../lib/contratoApi';
import { armarContrato, TITULO_POR_DEFECTO } from '../lib/contrato';
import { generarContratoPdf } from '../utils/generateContrato';

/**
 * Panel de usuario > Contrato: el titulo y las condiciones generales que salen
 * impresos en el contrato de cada carpa o sombrilla. La vista previa descarga
 * un contrato de ejemplo, con los datos del cliente en blanco.
 */
function ContratoConfig({ establishment }) {
  const [titulo, setTitulo] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let vigente = true;
    leerContrato()
      .then((c) => {
        if (!vigente) return;
        setTitulo(c.titulo);
        setCondiciones(c.condiciones);
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setGuardando(true);
    try {
      const c = await guardarContrato({ titulo, condiciones });
      setTitulo(c.titulo);
      setCondiciones(c.condiciones);
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
      contrato: { titulo, condiciones },
      reserva: { serviceType: 'carpa', resourceNumber: '...', startDate: '', endDate: '' },
      maxPersonas: Number(establishment?.maxPersonasPorUnidad) || 6
    }));
  };

  if (cargando) return <p className="text-xs text-slate-500">Cargando…</p>;

  return (
    <form onSubmit={guardar} className="space-y-3 max-w-3xl">
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
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-[12px] text-slate-700">
        Condiciones generales
        <textarea
          value={condiciones}
          onChange={(e) => setCondiciones(e.target.value)}
          rows={22}
          placeholder={'1 - La cantidad máxima de personas por unidad es de seis (6).\n2 - ...'}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] leading-relaxed"
        />
      </label>
      <p className="text-[11px] text-slate-500">
        Cada renglón sale como está. Para que uno salga en negrita, escribilo entre dos asteriscos de cada lado: **OBLIGATORIO**. Un renglón vacío separa párrafos.
      </p>
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
