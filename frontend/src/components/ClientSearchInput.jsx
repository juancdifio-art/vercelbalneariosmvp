import React, { useState, useRef, useEffect } from 'react';
import useDeudasClientes from '../hooks/useDeudasClientes';
import { formatPesos } from '../lib/money';
import { saldoDe } from '../lib/reservas';
import { format } from '../lib/dates';
import { AvisoIcon } from './icons';

const ETIQUETA_SERVICIO = {
    carpa: 'Carpa',
    sombrilla: 'Sombrilla',
    parking: 'Estacionamiento',
    pileta: 'Pileta'
};

function ClientSearchInput({ clients, selectedClientId, onSelect, disabled }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Deuda de reservas ya terminadas, para avisar antes de tomarle otra
    // reserva al mismo cliente. Solo avisa: la reserva se puede cargar igual.
    const deudas = useDeudasClientes();

    // Filtrar clientes basado en el término de búsqueda
    const filteredClients = searchTerm.trim()
        ? clients.filter((c) => {
            const term = searchTerm.toLowerCase();
            return (
                c.fullName?.toLowerCase().includes(term) ||
                c.phone?.toLowerCase().includes(term) ||
                c.email?.toLowerCase().includes(term)
            );
        })
        : clients;

    // Obtener el cliente seleccionado para mostrar su nombre
    const selectedClient = clients.find((c) => c.id === selectedClientId);
    const deudaSeleccionado = selectedClient ? deudas.get(Number(selectedClient.id)) : null;

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (client) => {
        onSelect(client);
        setSearchTerm('');
        setIsOpen(false);
    };

    const handleClear = () => {
        onSelect(null);
        setSearchTerm('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Campo de búsqueda o cliente seleccionado */}
            {selectedClient ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-cyan-50 px-3 py-2 text-xs text-slate-900">
                    <div className="flex-1">
                        <span className="font-medium">{selectedClient.fullName}</span>
                        {selectedClient.phone && (
                            <span className="text-slate-500 ml-2">• {selectedClient.phone}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-slate-400 hover:text-red-500 transition"
                        title="Quitar cliente"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="🔍 Buscar por nombre, teléfono o email..."
                        disabled={disabled}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {deudaSeleccionado && (
                <div
                    role="alert"
                    className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800"
                >
                    <p className="flex items-center gap-1.5 font-semibold">
                        <AvisoIcon className="h-4 w-4 shrink-0" />
                        Debe {formatPesos(deudaSeleccionado.monto, 0)} de{' '}
                        {deudaSeleccionado.reservas.length === 1
                            ? '1 reserva ya terminada'
                            : `${deudaSeleccionado.reservas.length} reservas ya terminadas`}
                    </p>
                    <ul className="mt-1 space-y-0.5 pl-5 text-rose-700">
                        {deudaSeleccionado.reservas.slice(0, 3).map((g) => (
                            <li key={g.id}>
                                {ETIQUETA_SERVICIO[g.serviceType] || g.serviceType}
                                {g.serviceType !== 'pileta' && g.resourceNumber ? ` ${g.resourceNumber}` : ''}
                                {' · terminó el '}
                                {format(g.endDate, 'dd/MM/yyyy')}
                                {' · debe '}
                                {formatPesos(saldoDe(g), 0)}
                            </li>
                        ))}
                        {deudaSeleccionado.reservas.length > 3 && (
                            <li>y {deudaSeleccionado.reservas.length - 3} más</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Dropdown de resultados */}
            {isOpen && !selectedClient && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredClients.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500 text-center">
                            {searchTerm ? 'No se encontraron clientes' : 'Escribí para buscar clientes'}
                        </div>
                    ) : (
                        <>
                            {!searchTerm && (
                                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-400 bg-slate-50 border-b">
                                    Clientes recientes ({clients.length})
                                </div>
                            )}
                            {filteredClients.slice(0, 20).map((client) => (
                                <button
                                    key={client.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleSelect(client);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-50 transition flex items-center justify-between border-b border-slate-100 last:border-b-0"
                                >
                                    <div>
                                        <span className="font-medium text-slate-800">{client.fullName}</span>
                                        {client.phone && (
                                            <span className="text-slate-500 ml-2">• {client.phone}</span>
                                        )}
                                    </div>
                                    {deudas.has(Number(client.id)) ? (
                                        <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                            Debe {formatPesos(deudas.get(Number(client.id)).monto, 0)}
                                        </span>
                                    ) : (
                                        client.email && (
                                            <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                                {client.email}
                                            </span>
                                        )
                                    )}
                                </button>
                            ))}
                            {filteredClients.length > 20 && (
                                <div className="px-3 py-1.5 text-[10px] text-center text-slate-400 bg-slate-50">
                                    +{filteredClients.length - 20} más. Refina la búsqueda.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default ClientSearchInput;
