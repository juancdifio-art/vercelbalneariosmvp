import React from 'react';

// Los dos campos de cantidad de personas, iguales en los modales de carpa,
// sombrilla y estacionamiento. El pase de pileta tiene los suyos propios
// porque ahi la cantidad ademas define el precio.

function PersonasFields({ adultsCount, childrenCount, onChangeForm, idPrefijo }) {
  const idAdultos = `${idPrefijo}-adultos`;
  const idMenores = `${idPrefijo}-menores`;

  const cambiar = (campo, value) => {
    onChangeForm((prev) =>
      prev
        ? {
          ...prev,
          [campo]: value
        }
        : prev
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1">
        <span>👨‍👩‍👧‍👦</span>
        <span>Personas</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idAdultos} className="text-[11px] font-semibold text-slate-700">
            Adultos
          </label>
          <input
            id={idAdultos}
            type="number"
            min="0"
            placeholder="0"
            value={adultsCount ?? ''}
            onChange={(e) => cambiar('adultsCount', e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idMenores} className="text-[11px] font-semibold text-slate-700">
            Menores
          </label>
          <input
            id={idMenores}
            type="number"
            min="0"
            placeholder="0"
            value={childrenCount ?? ''}
            onChange={(e) => cambiar('childrenCount', e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

export default PersonasFields;
