import React, { useId, useRef } from 'react';
import TooltipFlotante from './TooltipFlotante';
import {
  CARPAS_PLANO,
  SOMBRILLAS_PLANO,
  SOMB,
  CAMINOS,
  DUCHAS,
  ACCESOS_PLAYA,
  MARCAS_X,
  VISTAS
} from '../config/planoZeus';

/**
 * Plano del Balneario Zeus en SVG.
 *
 * `vista` elige el recorte: 'carpas', 'sombrillas' o 'completo'.
 * `estadoDe(serviceType, numero)` devuelve { estado, title, color? } para
 * pintar cada unidad; estado es 'ocupada', 'proxima' o 'libre'. `color`
 * (`{ fill, stroke, texto }`), si viene, pisa al color del estado — lo usan
 * los sectores de tarifas para pintar cada unidad con su propio color. Sin
 * `estadoDe` las unidades se dibujan neutras.
 * `fichaDe(serviceType, numero)` devuelve el contenido de la tarjeta que sale
 * al instante al pasar el mouse; sin ella queda el `title` nativo.
 */

const TINTA = '#3A3327';
const ARENA = '#F6EEDB';
const CAMINO = '#DCCFB2';
const EDIFICIO = '#FBF7EC';
const AGUA = '#CDE9F0';

const ESTILO_ESTADO = {
  ocupada: { fill: '#059669', stroke: '#047857', texto: '#FFFFFF' },
  proxima: { fill: '#FFFBEB', stroke: '#F59E0B', texto: '#0F172A' },
  libre: { fill: '#FFFFFF', stroke: '#64748B', texto: '#0F172A' }
};

function Rotulo({ x, y, children, size = 12, anchor = 'middle', weight = 600, transform, fill = TINTA }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      letterSpacing={anchor === 'middle' ? 1 : 0}
      fill={fill}
      transform={transform}
      style={{ pointerEvents: 'none' }}
    >
      {children}
    </text>
  );
}

function Fondo({ hatchId }) {
  const edificio = { fill: EDIFICIO, stroke: TINTA, strokeWidth: 1.1 };
  const escalera = { fill: `url(#${hatchId})`, stroke: TINTA, strokeWidth: 0.8 };
  return (
    <g aria-hidden="true">
      <rect x="0" y="0" width="1290" height="900" fill={ARENA} />

      <Rotulo x={200} y={58} size={30} weight={700} anchor="start">BALNEARIO ZEUS</Rotulo>
      <text x={1060} y={58} fontSize={15} fontWeight={500} textAnchor="end" fill={TINTA}>
        TEMPORADA <tspan fontSize={24} fontWeight={700}>2025-2026</tspan>
      </text>
      <Rotulo x={240} y={86}>QUIOSCO</Rotulo>
      <Rotulo x={438} y={86}>VESTUARIOS</Rotulo>

      <path d="M 200 96 H 1240 V 852 H 62 V 130" fill="none" stroke={TINTA} strokeWidth={1.2} />

      {CAMINOS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={CAMINO} />
      ))}
      <line x1={362} y1={418} x2={606} y2={418} stroke={TINTA} strokeWidth={0.8} />
      <line x1={385} y1={200} x2={385} y2={384} stroke={TINTA} strokeWidth={0.8} />

      <rect x={80} y={130} width={86} height={120} {...edificio} />
      <Rotulo x={123} y={195}>QUINCHO</Rotulo>

      <rect x={200} y={115} width={180} height={65} {...edificio} />
      <Rotulo x={275} y={170}>TERRAZA</Rotulo>
      <rect x={380} y={148} width={46} height={32} {...escalera} />
      <rect x={426} y={115} width={176} height={65} {...edificio} />
      <Rotulo x={514} y={170}>TERRAZA</Rotulo>

      <rect x={602} y={44} width={62} height={60} {...edificio} />
      <Rotulo x={633} y={78}>ADMIN</Rotulo>
      <rect x={620} y={104} width={28} height={22} {...edificio} />

      <rect x={652} y={118} width={36} height={114} {...edificio} strokeDasharray="4 3" />
      <Rotulo x={670} y={175} transform="rotate(-90 670 175)">DEPOSITO</Rotulo>

      <rect x={690} y={182} width={128} height={40} {...edificio} />
      <Rotulo x={754} y={208}>DECK</Rotulo>
      <rect x={818} y={178} width={32} height={22} {...escalera} />
      <Rotulo x={790} y={237} size={10.5} weight={500} anchor="start">duchas</Rotulo>

      <rect x={850} y={108} width={240} height={54} {...edificio} fill={AGUA} />
      <Rotulo x={970} y={140}>PISCINA</Rotulo>
      <rect x={856} y={182} width={264} height={40} {...edificio} />
      <Rotulo x={988} y={208}>RESTAURANT</Rotulo>
      <rect x={1068} y={222} width={44} height={14} {...escalera} />

      {DUCHAS.map((d) => (
        <g key={`${d.x}-${d.y}`}>
          <circle cx={d.x} cy={d.y} r={d.r} fill={EDIFICIO} stroke={TINTA} strokeWidth={0.9} />
          {d.rotulo && (
            <Rotulo x={d.x + d.r + 3} y={d.y + 4} size={10.5} weight={500} anchor="start">{d.rotulo}</Rotulo>
          )}
        </g>
      ))}

      {ACCESOS_PLAYA.map((a) => (
        <g key={a.x}>
          <rect x={a.x} y={a.y} width={18} height={36} {...edificio} />
          <Rotulo x={a.x + 24} y={a.y + 24} anchor="start">acceso playa</Rotulo>
        </g>
      ))}
      <Rotulo x={651} y={882} fill="#7A6A4C">▼  PLAYA</Rotulo>

      {MARCAS_X.map((m) => (
        <Rotulo key={`${m.x}-${m.y}`} x={m.x} y={m.y} size={11} weight={400} fill="#7A6A4C">×</Rotulo>
      ))}
    </g>
  );
}

function Unidad({ serviceType, numero, estadoDe, onUnidadClick, fichaDe, tooltipRef, children }) {
  const info = estadoDe ? estadoDe(serviceType, numero) : null;
  const prefijo = serviceType === 'carpa' ? 'Carpa' : 'Sombrilla';
  const title = info?.title ?? `${prefijo} ${numero}`;
  const clickable = Boolean(onUnidadClick);
  // Quien pinta el plano puede pedir un color propio (los sectores de tarifas).
  const estilo = info?.color ?? ESTILO_ESTADO[info?.estado] ?? ESTILO_ESTADO.libre;

  const activar = () => {
    tooltipRef?.current?.ocultar();
    if (onUnidadClick) onUnidadClick(serviceType, numero);
  };
  const mostrar = fichaDe
    ? (e) => tooltipRef?.current?.mostrar(e.currentTarget, fichaDe(serviceType, numero))
    : undefined;
  const ocultar = fichaDe ? () => tooltipRef?.current?.ocultar() : undefined;

  return (
    <g
      data-unidad={`${serviceType}-${numero}`}
      data-estado={info?.estado ?? 'libre'}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={title}
      onClick={clickable ? activar : undefined}
      onMouseEnter={mostrar}
      onMouseLeave={ocultar}
      onFocus={mostrar}
      onBlur={ocultar}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activar();
              }
            }
          : undefined
      }
      className={clickable ? 'cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-cyan-500 hover:opacity-80' : undefined}
    >
      {!fichaDe && <title>{title}</title>}
      {children(estilo)}
    </g>
  );
}

function PlanoBalneario({ vista = 'completo', estadoDe, onUnidadClick, fichaDe, className = 'h-auto w-full' }) {
  const config = VISTAS[vista] ?? VISTAS.completo;
  const tooltipRef = useRef(null);
  const hatchId = `hatch-${useId().replace(/:/g, '')}`;

  return (
    <>
    <svg
      viewBox={config.viewBox}
      className={`block ${className}`}
      role="group"
      aria-label={`Plano del balneario: ${vista === 'completo' ? 'completo' : vista}`}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={TINTA} strokeWidth="1" />
        </pattern>
      </defs>

      <Fondo hatchId={hatchId} />

      {config.carpas &&
        CARPAS_PLANO.map((c) => (
          <Unidad key={`c${c.num}`} serviceType="carpa" numero={c.num} estadoDe={estadoDe} onUnidadClick={onUnidadClick} fichaDe={fichaDe} tooltipRef={tooltipRef}>
            {(estilo) => (
              <>
                <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={estilo.fill} stroke={estilo.stroke} strokeWidth={1} />
                <text
                  x={c.x + c.w / 2}
                  y={c.y + c.h / 2 + 3.5}
                  fontSize={c.w < 30 ? 8.5 : 10}
                  fontWeight={600}
                  textAnchor="middle"
                  fill={estilo.texto}
                  style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                >
                  {c.num < 10 ? `0${c.num}` : c.num}
                </text>
              </>
            )}
          </Unidad>
        ))}

      {config.sombrillas &&
        SOMBRILLAS_PLANO.map((s) => (
          <Unidad key={`s${s.num}`} serviceType="sombrilla" numero={s.num} estadoDe={estadoDe} onUnidadClick={onUnidadClick} fichaDe={fichaDe} tooltipRef={tooltipRef}>
            {(estilo) => (
              <>
                <circle
                  cx={s.cx}
                  cy={s.cy}
                  r={SOMB.r + 1.5}
                  fill={estilo.fill}
                  stroke={estilo.stroke}
                  strokeWidth={1}
                  strokeDasharray={s.dudosa ? '2.5 2' : undefined}
                />
                <text
                  x={s.cx}
                  y={s.cy + 3.5}
                  fontSize={9.5}
                  fontWeight={600}
                  textAnchor="middle"
                  fill={estilo.texto}
                  style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.num}
                </text>
              </>
            )}
          </Unidad>
        ))}
    </svg>
    {fichaDe && <TooltipFlotante ref={tooltipRef} />}
    </>
  );
}

export default PlanoBalneario;
