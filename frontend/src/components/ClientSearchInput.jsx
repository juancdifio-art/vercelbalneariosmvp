import React, { useState, useRef, useEffect } from 'react';

function ClientSearchInput({ clients, selectedClientId, onSelect, disabled }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

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
                                    onClick={() => handleSelect(client)}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-50 transition flex items-center justify-between border-b border-slate-100 last:border-b-0"
                                >
                                    <div>
                                        <span className="font-medium text-slate-800">{client.fullName}</span>
                                        {client.phone && (
                                            <span className="text-slate-500 ml-2">• {client.phone}</span>
                                        )}
                                    </div>
                                    {client.email && (
                                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                            {client.email}
                                        </span>
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
