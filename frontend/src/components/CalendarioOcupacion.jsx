import React, { useEffect, useRef, useState } from 'react';
import { addDays, isSameDay } from 'date-fns';
import { format, weekdayInitial } from '../lib/dates';
import { diasInclusivos, estacionamientoVinculado, hoyISO } from '../lib/reservas';
import ReservaEtiqueta from './ReservaEtiqueta';
import TooltipFlotante from './TooltipFlotante';
import FichaUnidad from './FichaUnidad';

/**
 * Grilla de ocupacion de 30 dias: una fila por unidad, una columna por dia.
 * La usan las secciones de Carpas y de Sombrillas.
 *
 * - Clic en una celda ocupada: abre la reserva.
 * - Clic en una celda libre: nueva reserva desde ese dia.
 * - Arrastrar sobre una fila: nueva reserva con entrada y salida ya cargadas.
 *   Si el tramo pisa un dia ocupado se pinta en rojo y al soltar no abre nada.
 * - Esc durante el arrastre lo cancela.
 * - Pasar el mouse por una reserva: la misma tarjeta que en la Vista rapida.
 */
function CalendarioOcupacion({
  serviceType,
  prefijo,
  numeros,
  reservations,
  reservationGroups,
  dayOffset,
  hoveredReservationGroupId,
  setHoveredReservationGroupId,
  onViewReservationDetails,
  onNuevaReserva,
  colores,
  anchoTh = 'w-16',
  anchoTd = 'w-16'
}) {
  // { numero, desde, hasta } con desde/hasta como indices de columna.
  const [arrastre, setArrastre] = useState(null);
  const [aviso, setAviso] = useState('');
  const arrastreRef = useRef(null);
  const tooltipRef = useRef(null);

  const today = new Date();
  const hoy = hoyISO(today);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, dayOffset + i));
  const fechas = days.map((d) => format(d, 'yyyy-MM-dd'));

  const ocupada = (numero, idx) => Boolean(reservations[`${fechas[idx]}-${numero}`]);

  const tramo = (a) => {
    if (!a) return null;
    const desde = Math.min(a.desde, a.hasta);
    const hasta = Math.max(a.desde, a.hasta);
    let choca = false;
    for (let i = desde; i <= hasta; i += 1) if (ocupada(a.numero, i)) choca = true;
    return { numero: a.numero, desde, hasta, choca };
  };

  const resumenTramo = (t) => {
    const dias = diasInclusivos(fechas[t.desde], fechas[t.hasta]);
    return (
      <div>
        <p className="text-[15px] font-semibold text-slate-900">
          {prefijo} {t.numero}
        </p>
        <p className="mt-0.5">
          Del {format(fechas[t.desde], 'dd/MM')} al {format(fechas[t.hasta], 'dd/MM')} ·{' '}
          {dias} {dias === 1 ? 'día' : 'días'}
        </p>
        <p className={`mt-1.5 font-medium ${t.choca ? 'text-red-700' : 'text-cyan-800'}`}>
          {t.choca ? 'Hay días ocupados en ese tramo' : 'Soltá para cargar la reserva'}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">Esc para cancelar
        </p>
      </div>
    );
  };

  // El soltar se escucha en toda la ventana: el mouse puede terminar fuera de la grilla.
  useEffect(() => {
    const soltar = () => {
      const a = arrastreRef.current;
      if (!a) return;
      arrastreRef.current = null;
      setArrastre(null);
      tooltipRef.current?.ocultar();

      const t = tramo(a);
      if (t.choca) {
        setAviso(`No se puede: ${prefijo.toLowerCase()} ${t.numero} tiene días ocupados entre el ${format(fechas[t.desde], 'dd/MM')} y el ${format(fechas[t.hasta], 'dd/MM')}.`);
        return;
      }
      // Un clic sin arrastrar deja la salida vacia, como siempre.
      const salida = t.desde === t.hasta ? '' : fechas[t.hasta];
      onNuevaReserva(t.numero, days[t.desde], fechas[t.desde], salida);
    };
    // Esc cancela el arrastre: al soltar despues no abre nada.
    const cancelar = (e) => {
      if (e.key !== 'Escape' || !arrastreRef.current) return;
      arrastreRef.current = null;
      setArrastre(null);
      tooltipRef.current?.ocultar();
    };
    window.addEventListener('pointerup', soltar);
    window.addEventListener('keydown', cancelar);
    return () => {
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('keydown', cancelar);
    };
  });

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(id);
  }, [aviso]);

  const actual = tramo(arrastre);

  const grupoEn = (numero, dateStr) =>
    reservationGroups.find(
      (g) =>
        g.serviceType === serviceType &&
        g.resourceNumber === numero &&
        g.status === 'active' &&
        g.startDate <= dateStr &&
        g.endDate >= dateStr
    );

  const colorDe = (groupId) => {
    const paleta = colores.length || 1;
    if (!groupId) return 0;
    const str = `${serviceType}:${groupId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(hash) % paleta;
  };

  const fichaDe = (numero, group) => {
    let estado = 'ocupada';
    if (group.startDate > hoy) estado = 'reservada';
    else if (group.endDate < hoy) estado = 'finalizada';
    return (
      <FichaUnidad
        prefijo={prefijo}
        numero={numero}
        estado={estado}
        fecha={hoy}
        reserva={group}
        estacionamiento={estacionamientoVinculado(reservationGroups, group)}
      />
    );
  };

  return (
    <>
      {aviso && (
        <div role="alert" className="sticky left-0 top-0 z-20 border-b border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800">
          {aviso}
        </div>
      )}
      <table className="w-full table-fixed select-none text-[10px]">
        <thead>
          <tr>
            {/* Con table-fixed el ancho lo define esta celda, no las del cuerpo. */}
            <th className={`bg-cyan-50 px-1 py-1 text-left font-semibold text-cyan-900 border-b border-slate-400 ${anchoTh} sticky top-0 z-10`}>
              {prefijo}
            </th>
            {days.map((day, idx) => {
              const isToday = isSameDay(day, today);
              // Mientras se arrastra, los dias del tramo se marcan tambien arriba:
              // asi se lee la fecha exacta sin tener que contar celdas.
              const enTramo = actual && idx >= actual.desde && idx <= actual.hasta;
              let clases = isToday ? 'text-cyan-900 bg-cyan-200' : 'text-slate-700 bg-white';
              if (enTramo) clases = actual.choca ? 'text-white bg-red-500' : 'text-white bg-cyan-600';
              return (
                <th
                  key={idx}
                  data-dia={fechas[idx]}
                  data-en-tramo={enTramo ? 'si' : undefined}
                  className={'px-0.5 py-1 text-center font-medium border-b border-slate-200 sticky top-0 z-10 ' + clases}
                >
                  <div className={enTramo ? 'font-bold' : ''}>{format(day, 'dd')}</div>
                  <div className={`text-[9px] ${enTramo ? 'text-white/90' : 'text-slate-500'}`}>{weekdayInitial(day)}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {numeros.map((numero) => (
            <tr key={numero} className="border-t border-slate-200">
              <td
                data-fila={numero}
                className={`px-1 py-1 border-r border-slate-300 ${anchoTd} whitespace-nowrap ${
                  actual && actual.numero === numero
                    ? `${actual.choca ? 'bg-red-500' : 'bg-cyan-600'} font-bold text-white`
                    : 'bg-cyan-50 text-cyan-900'
                }`}
              >
                {prefijo} {numero}
              </td>
              {days.map((day, idx) => {
                const isToday = isSameDay(day, today);
                const dateStr = fechas[idx];
                const isReserved = ocupada(numero, idx);
                const group = isReserved ? grupoEn(numero, dateStr) : null;
                const enTramo = actual && actual.numero === numero && idx >= actual.desde && idx <= actual.hasta;

                // Sin transicion en el tramo: tiene que pintarse al instante mientras se arrastra.
                let cellClasses = `relative h-5 border-l border-slate-300 cursor-pointer ${enTramo ? '' : 'transition-colors '}`;

                if (enTramo) {
                  cellClasses += actual.choca ? 'bg-red-500' : 'bg-cyan-600';
                } else if (isReserved) {
                  const colorDef = colores[colorDe(group?.id ?? null)];
                  cellClasses += colorDef
                    ? (isToday ? colorDef.today : colorDef.normal)
                    : (isToday ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-300 hover:bg-amber-400');
                  if (group && hoveredReservationGroupId === group.id) cellClasses += ' border-2 border-slate-900';
                } else {
                  cellClasses += isToday ? 'bg-cyan-400 hover:bg-cyan-500' : 'bg-white hover:bg-slate-200';
                }

                return (
                  <td
                    key={idx}
                    data-celda={`${numero}-${dateStr}`}
                    className={cellClasses}
                    onPointerDown={(e) => {
                      if (isReserved || e.button !== 0) return;
                      e.preventDefault();
                      const a = { numero, desde: idx, hasta: idx };
                      arrastreRef.current = a;
                      setArrastre(a);
                      tooltipRef.current?.mostrar(e.currentTarget, resumenTramo(tramo(a)));
                    }}
                    onPointerEnter={(e) => {
                      const a = arrastreRef.current;
                      if (a) {
                        // Arrastrando: solo cuenta la fila donde empezo.
                        if (a.numero !== numero) return;
                        const nuevo = { ...a, hasta: idx };
                        arrastreRef.current = nuevo;
                        setArrastre(nuevo);
                        tooltipRef.current?.mostrar(e.currentTarget, resumenTramo(tramo(nuevo)));
                        return;
                      }
                      setHoveredReservationGroupId(group ? group.id : null);
                      if (group) tooltipRef.current?.mostrar(e.currentTarget, fichaDe(numero, group));
                      else tooltipRef.current?.ocultar();
                    }}
                    onPointerLeave={() => {
                      if (arrastreRef.current) return;
                      setHoveredReservationGroupId(null);
                      tooltipRef.current?.ocultar();
                    }}
                    onClick={() => {
                      if (!isReserved) return; // las libres se manejan al soltar
                      tooltipRef.current?.ocultar();
                      if (group) onViewReservationDetails(group);
                    }}
                  >
                    <ReservaEtiqueta
                      group={group}
                      dateStr={dateStr}
                      esPrimeraColumna={idx === 0}
                      ultimoDiaVentana={fechas[fechas.length - 1]}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <TooltipFlotante ref={tooltipRef} />
    </>
  );
}

export default CalendarioOcupacion;
