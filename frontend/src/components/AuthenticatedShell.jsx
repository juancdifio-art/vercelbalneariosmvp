import React, { useCallback, useState } from 'react';
import Sidebar from './Sidebar';
import SoportePanel from './soporte/SoportePanel';
import { isWideSection, DEFAULT_MAX_WIDTH, groupNavItems } from '../config/sections';
import { NavIcon, SalirIcon, SoporteIcon } from './icons';
import { useNoLeidosSoporte } from '../hooks/useSoporte';

function AuthenticatedShell({
  establishment,
  userEmail,
  activeSection,
  onChangeSection,
  sidebarCollapsed,
  onToggleSidebar,
  onLogout,
  navItems,
  children
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Las grillas operativas usan todo el monitor; el resto mantiene linea corta.
  const contentWidthClass = isWideSection(activeSection) ? 'max-w-none' : DEFAULT_MAX_WIDTH;

  // Misma fuente que el menu de escritorio: antes este menu repetia a mano
  // los items de configuracion y habia que tocar dos archivos por seccion.
  const grupos = groupNavItems(navItems);

  const handleSectionChange = (sectionId) => {
    onChangeSection(sectionId);
    setMobileMenuOpen(false);
  };

  // Chat de soporte: se abre encima de la pantalla actual, que viaja con cada
  // mensaje para saber desde donde escribieron.
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const { noLeidos: soporteNoLeidos, refrescar: refrescarSoporte } = useNoLeidosSoporte(true);
  const pantallaActual = (navItems || []).find((item) => item.id === activeSection)?.label || activeSection;
  const abrirSoporte = () => {
    setSoporteAbierto(true);
    setMobileMenuOpen(false);
  };
  const cerrarSoporte = useCallback(() => setSoporteAbierto(false), []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-sky-50 via-cyan-50 to-amber-50">
      {/* Mobile Header - Fixed at top */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sky-900 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏖️</span>
            <span className="text-sm font-semibold text-white truncate max-w-[200px]">
              {establishment?.name || 'Mi Balneario'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative p-2 rounded-lg text-white hover:bg-sky-800 transition"
            aria-label="Abrir menú"
          >
            {soporteNoLeidos > 0 && !mobileMenuOpen && (
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-cyan-400" aria-hidden="true" />
            )}
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <nav className="max-h-[70vh] space-y-4 overflow-y-auto border-t border-sky-800 bg-sky-950 px-4 py-3">
            {grupos.map((grupo) => (
              <div key={grupo.id} className="space-y-1">
                {grupo.label && (
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/90">
                    {grupo.label}
                  </p>
                )}
                {grupo.items.map((item) => {
                  const activo = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSectionChange(item.id)}
                      aria-current={activo ? 'page' : undefined}
                      className={
                        'relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                        (activo
                          ? 'bg-sky-900 text-white'
                          : 'text-sky-100/75 hover:bg-sky-900/60 hover:text-white')
                      }
                    >
                      {activo && (
                        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-cyan-400" aria-hidden="true" />
                      )}
                      <NavIcon sectionId={item.id} className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={abrirSoporte}
                className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sky-100/75 transition hover:bg-sky-900 hover:text-white"
              >
                <SoporteIcon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 text-left">Soporte</span>
                {soporteNoLeidos > 0 && (
                  <span className="rounded-full bg-cyan-400 px-1.5 text-[10px] font-bold leading-4 text-sky-950">{soporteNoLeidos}</span>
                )}
              </button>
              <p className="mb-2 truncate px-1 text-[11px] text-sky-200/80">{userEmail}</p>
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sky-100/75 transition hover:bg-sky-900 hover:text-white"
              >
                <SalirIcon className="h-[18px] w-[18px] shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          style={{ top: '56px' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <Sidebar
        establishment={establishment}
        userEmail={userEmail}
        activeSection={activeSection}
        onChangeSection={onChangeSection}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
        onLogout={onLogout}
        navItems={navItems}
        onAbrirSoporte={abrirSoporte}
        soporteNoLeidos={soporteNoLeidos}
      />

      {/* Main content */}
      <main className="flex-1 flex justify-center px-4 lg:px-6 py-6 md:py-8 mt-14 md:mt-0 overflow-x-hidden">
        <div className={`w-full ${contentWidthClass}`}>
          {children}
        </div>
      </main>

      <SoportePanel
        abierto={soporteAbierto}
        onCerrar={cerrarSoporte}
        pantalla={pantallaActual}
        onLeido={refrescarSoporte}
      />
    </div>
  );
}

export default AuthenticatedShell;
