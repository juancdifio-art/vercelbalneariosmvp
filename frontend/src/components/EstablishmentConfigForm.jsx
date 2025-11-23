import React from 'react';

function EstablishmentConfigForm({
  variant = 'light',
  estName,
  setEstName,
  estHasParking,
  setEstHasParking,
  estParkingCapacity,
  setEstParkingCapacity,
  estHasCarpas,
  setEstHasCarpas,
  estCarpasCapacity,
  setEstCarpasCapacity,
  estHasSombrillas,
  setEstHasSombrillas,
  estSombrillasCapacity,
  setEstSombrillasCapacity,
  estHasPileta,
  setEstHasPileta,
  estPoolMaxOccupancy,
  setEstPoolMaxOccupancy,
  onSubmit,
  estSaving,
  error,
  success
}) {
  const isDark = variant === 'dark';

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label
            className={
              isDark
                ? 'block text-xs font-semibold text-slate-200 mb-1.5'
                : 'block text-xs font-semibold text-slate-800 mb-1.5'
            }
          >
            Nombre del establecimiento
          </label>
          <input
            type="text"
            value={estName}
            onChange={(e) => setEstName(e.target.value)}
            placeholder="Ej: Balneario Costa Azul"
            className={
              isDark
                ? 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500'
                : 'mt-1 w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
            }
          />
        </div>

        <div>
          <p
            className={
              isDark
                ? 'text-xs font-semibold text-slate-200 mb-2'
                : 'text-xs font-semibold text-slate-800 mb-2'
            }
          >
            Servicios y capacidad
          </p>
          <div className="grid gap-3 text-xs">
            {/* Estacionamiento */}
            <div
              className={
                isDark
                  ? 'rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5'
                  : 'rounded-xl border border-cyan-100 bg-white px-3 py-2.5'
              }
            >
              <label className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Estacionamiento</span>
                  <p
                    className={
                      isDark
                        ? 'text-[11px] text-slate-400'
                        : 'text-[11px] text-slate-600'
                    }
                  >
                    Plazas de autos para clientes
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={estHasParking}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEstHasParking(checked);
                    if (!checked) setEstParkingCapacity('');
                  }}
                  className={
                    isDark
                      ? 'h-4 w-4 rounded border-slate-500 bg-slate-800'
                      : 'h-4 w-4 rounded border-cyan-400 bg-white'
                  }
                />
              </label>
              {estHasParking && (
                <div className="mt-2">
                  <label className="flex flex-col gap-1">
                    <span
                      className={
                        isDark
                          ? 'text-[11px] text-slate-300'
                          : 'text-[11px] text-slate-700'
                      }
                    >
                      Plazas de estacionamiento
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={estParkingCapacity}
                      onChange={(e) => setEstParkingCapacity(e.target.value)}
                      placeholder="Ej: 50"
                      className={
                        isDark
                          ? 'mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500'
                          : 'mt-0.5 w-full rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500'
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Carpas */}
            <div
              className={
                isDark
                  ? 'rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5'
                  : 'rounded-xl border border-cyan-100 bg-white px-3 py-2.5'
              }
            >
              <label className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Carpas</span>
                  <p
                    className={
                      isDark
                        ? 'text-[11px] text-slate-400'
                        : 'text-[11px] text-slate-600'
                    }
                  >
                    Cantidad total de carpas disponibles
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={estHasCarpas}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEstHasCarpas(checked);
                    if (!checked) setEstCarpasCapacity('');
                  }}
                  className={
                    isDark
                      ? 'h-4 w-4 rounded border-slate-500 bg-slate-800'
                      : 'h-4 w-4 rounded border-cyan-400 bg-white'
                  }
                />
              </label>
              {estHasCarpas && (
                <div className="mt-2">
                  <label className="flex flex-col gap-1">
                    <span
                      className={
                        isDark
                          ? 'text-[11px] text-slate-300'
                          : 'text-[11px] text-slate-700'
                      }
                    >
                      Cantidad de carpas
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={estCarpasCapacity}
                      onChange={(e) => setEstCarpasCapacity(e.target.value)}
                      placeholder="Ej: 80"
                      className={
                        isDark
                          ? 'mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500'
                          : 'mt-0.5 w-full rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500'
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Sombrillas */}
            <div
              className={
                isDark
                  ? 'rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5'
                  : 'rounded-xl border border-cyan-100 bg-white px-3 py-2.5'
              }
            >
              <label className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Sombrillas</span>
                  <p
                    className={
                      isDark
                        ? 'text-[11px] text-slate-400'
                        : 'text-[11px] text-slate-600'
                    }
                  >
                    Cantidad total de sombrillas
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={estHasSombrillas}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEstHasSombrillas(checked);
                    if (!checked) setEstSombrillasCapacity('');
                  }}
                  className={
                    isDark
                      ? 'h-4 w-4 rounded border-slate-500 bg-slate-800'
                      : 'h-4 w-4 rounded border-cyan-400 bg-white'
                  }
                />
              </label>
              {estHasSombrillas && (
                <div className="mt-2">
                  <label className="flex flex-col gap-1">
                    <span
                      className={
                        isDark
                          ? 'text-[11px] text-slate-300'
                          : 'text-[11px] text-slate-700'
                      }
                    >
                      Cantidad de sombrillas
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={estSombrillasCapacity}
                      onChange={(e) => setEstSombrillasCapacity(e.target.value)}
                      placeholder="Ej: 120"
                      className={
                        isDark
                          ? 'mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500'
                          : 'mt-0.5 w-full rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500'
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Pileta */}
            <div
              className={
                isDark
                  ? 'rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5'
                  : 'rounded-xl border border-cyan-100 bg-white px-3 py-2.5'
              }
            >
              <label className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Pileta</span>
                  <p
                    className={
                      isDark
                        ? 'text-[11px] text-slate-400'
                        : 'text-[11px] text-slate-600'
                    }
                  >
                    Ocupación máxima simultánea
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={estHasPileta}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEstHasPileta(checked);
                    if (!checked) setEstPoolMaxOccupancy('');
                  }}
                  className={
                    isDark
                      ? 'h-4 w-4 rounded border-slate-500 bg-slate-800'
                      : 'h-4 w-4 rounded border-cyan-400 bg-white'
                  }
                />
              </label>
              {estHasPileta && (
                <div className="mt-2">
                  <label className="flex flex-col gap-1">
                    <span
                      className={
                        isDark
                          ? 'text-[11px] text-slate-300'
                          : 'text-[11px] text-slate-700'
                      }
                    >
                      Ocupación máx. pileta
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={estPoolMaxOccupancy}
                      onChange={(e) => setEstPoolMaxOccupancy(e.target.value)}
                      placeholder="Ej: 60"
                      className={
                        isDark
                          ? 'mt-0.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500'
                          : 'mt-0.5 w-full rounded-lg border border-cyan-200 bg-white px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500'
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={estSaving}
          className={
            isDark
              ? 'mt-2 inline-flex w-full items-center justify-center rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/40 transition hover:bg-sky-600 disabled:opacity-70 disabled:cursor-not-allowed'
              : 'mt-2 inline-flex w-full items-center justify-center rounded-full bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-400/50 transition hover:bg-cyan-600 disabled:opacity-70 disabled:cursor-not-allowed'
          }
        >
          {estSaving ? 'Guardando...' : isDark ? 'Guardar y continuar' : 'Guardar cambios'}
        </button>
      </form>

      {error && (
        <p className="mt-4 text-center text-xs text-red-400">{error}</p>
      )}

      {!isDark && success && (
        <p className="mt-2 text-center text-xs text-emerald-400">{success}</p>
      )}
    </>
  );
}

export default EstablishmentConfigForm;
