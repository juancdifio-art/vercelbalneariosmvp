import React, { useState } from 'react';
import Sidebar from './Sidebar';

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

  const handleSectionChange = (sectionId) => {
    onChangeSection(sectionId);
    setMobileMenuOpen(false);
  };

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
            className="p-2 rounded-lg text-white hover:bg-sky-800 transition"
            aria-label="Abrir menú"
          >
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
          <nav className="bg-sky-800 border-t border-sky-700 px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSectionChange(item.id)}
                className={
                  'w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                  (activeSection === item.id
                    ? 'bg-sky-700 text-amber-200 border border-amber-300/80'
                    : 'text-cyan-50 hover:bg-sky-700 hover:text-amber-200')
                }
              >
                <span>{item.label}</span>
                {activeSection === item.id && <span className="text-amber-300">●</span>}
              </button>
            ))}

            <div className="border-t border-sky-600 mt-3 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300 mb-2 px-1">
                Configuración
              </p>
              <button
                type="button"
                onClick={() => handleSectionChange('config-establecimiento')}
                className={
                  'w-full flex items-center rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                  (activeSection === 'config-establecimiento'
                    ? 'bg-sky-700 text-amber-200'
                    : 'text-cyan-50 hover:bg-sky-700')
                }
              >
                Configurar establecimiento
              </button>
              <button
                type="button"
                onClick={() => handleSectionChange('panel-usuario')}
                className={
                  'w-full flex items-center rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                  (activeSection === 'panel-usuario'
                    ? 'bg-sky-700 text-amber-200'
                    : 'text-cyan-50 hover:bg-sky-700')
                }
              >
                Panel de usuario
              </button>
            </div>

            <div className="border-t border-sky-600 mt-3 pt-3">
              <p className="text-[11px] text-slate-300 mb-2 px-1">
                {userEmail}
              </p>
              <button
                type="button"
                onClick={onLogout}
                className="w-full rounded-lg border border-cyan-400 px-3 py-2 text-sm font-medium text-cyan-50 hover:bg-sky-700 transition"
              >
                Cerrar sesión
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
      />

      {/* Main content */}
      <main className="flex-1 flex justify-center px-4 py-6 md:py-8 mt-14 md:mt-0 overflow-x-hidden">
        <div className="w-full max-w-4xl">
          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthenticatedShell;
