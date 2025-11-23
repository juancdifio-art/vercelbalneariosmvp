import React, { useMemo, useState } from 'react';
import ClientDetailsModal from './ClientDetailsModal';

function ClientsSection({
  clients,
  clientsLoading,
  clientDeletingId,
  onNewClient,
  onEditClient,
  onDeleteClient,
  onViewReservationDetails
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients;

    return clients.filter((client) => {
      const fields = [
        client.fullName,
        client.phone,
        client.email,
        client.notes,
        client.documentNumber,
        client.vehiclePlate
      ];
      return fields.some((field) => (field || '').toLowerCase().includes(normalizedQuery));
    });
  }, [clients, normalizedQuery]);

  const hasClients = clients && clients.length > 0;
  const hasFilteredClients = filteredClients && filteredClients.length > 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xl overflow-hidden">
      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onViewReservation={onViewReservationDetails}
        />
      )}

      {/* Header */}
      <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Gestión de Clientes</h2>
            <p className="text-sm text-purple-50">
              Administrá la base de datos de clientes del balneario
            </p>
          </div>
          <button
            type="button"
            onClick={onNewClient}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-purple-600 shadow-lg hover:shadow-xl hover:bg-purple-50 transition-all transform hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      {!clientsLoading && hasClients && (
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50/50 to-white">
          <div className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono, email, documento o patente..."
              className="w-full pl-12 pr-12 py-3 text-sm border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Indicador de resultados */}
          {searchQuery && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-purple-500"></div>
              <p className="text-xs text-slate-600">
                Mostrando <span className="font-bold text-purple-600">{filteredClients.length}</span> de <span className="font-semibold">{clients.length}</span> clientes
              </p>
            </div>
          )}
        </div>
      )}

      {/* Contenido */}
      <div className="px-6 py-4">
        {clientsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600 mb-3" />
              <p className="text-sm font-medium text-slate-600">Cargando clientes...</p>
            </div>
          </div>
        )}

        {!clientsLoading && !hasClients && (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-base text-slate-700 font-semibold mb-2">No hay clientes registrados</p>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Comenzá a gestionar tu base de clientes creando el primer registro
            </p>
            <button
              type="button"
              onClick={onNewClient}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-indigo-600 hover:to-purple-600 transition-all transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Primer Cliente
            </button>
          </div>
        )}

        {!clientsLoading && hasClients && !hasFilteredClients && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-600 font-medium mb-1">No se encontraron resultados</p>
            <p className="text-xs text-slate-500 mb-4">
              No hay clientes que coincidan con tu búsqueda
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              Limpiar búsqueda
            </button>
          </div>
        )}

        {!clientsLoading && hasFilteredClients && (
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto -mx-6">
            <table className="min-w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[20%] sticky top-0 z-10 bg-slate-50">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[15%] sticky top-0 z-10 bg-slate-50">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[22%] sticky top-0 z-10 bg-slate-50">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[18%] sticky top-0 z-10 bg-slate-50">
                    Datos Adicionales
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider w-[25%] sticky top-0 z-10 bg-slate-50">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col min-w-0 max-w-full">
                        <span className="font-semibold text-sm text-slate-900 truncate block" title={client.fullName}>
                          {client.fullName}
                        </span>
                        {client.documentNumber && (
                          <span className="text-xs text-slate-500 truncate">DNI {client.documentNumber}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {client.phone ? (
                        <span className="text-sm text-slate-700 whitespace-nowrap">{client.phone}</span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {client.email ? (
                        <span className="text-sm text-slate-700 truncate block" title={client.email}>{client.email}</span>
                      ) : (
                        <span className="text-sm text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-1">
                        {client.vehiclePlate && (
                          <span className="text-sm text-slate-700 font-medium">{client.vehiclePlate}</span>
                        )}
                        {client.notes && (
                          <span className="text-xs text-slate-500 line-clamp-1" title={client.notes}>
                            {client.notes}
                          </span>
                        )}
                        {!client.vehiclePlate && !client.notes && (
                          <span className="text-sm text-slate-400 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                          onClick={() => setSelectedClient(client)}
                          title="Ver detalles"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                          onClick={() => onEditClient(client)}
                          title="Editar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          onClick={() => onDeleteClient(client.id)}
                          disabled={clientDeletingId === client.id}
                          title="Eliminar"
                        >
                          {clientDeletingId === client.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                              <span className="sr-only">Eliminando...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Eliminar
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientsSection;
