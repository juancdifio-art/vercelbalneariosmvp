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
    <div className="min-h-screen flex bg-gradient-to-br from-sky-50 via-cyan-50 to-amber-50">
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sky-900 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏖️</span>
          <span className="text-sm font-semibold text-white">
            {establishment?.name || 'Mi Balneario'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center justify-center p-2 rounded-lg text-cyan-50 hover:bg-sky-800 transition"
          aria-label="Toggle menu"
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`md:hidden fixed top-14 left-0 right-0 z-40 bg-sky-900 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        style={{ maxHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}
      >
        <nav className="px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSectionChange(item.id)}
              className={
                'w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                (activeSection === item.id
                  ? 'bg-sky-800 text-amber-200 border border-amber-300/80'
                  : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
              }
            >
              <span>{item.label}</span>
              {activeSection === item.id && (
                <span className="text-amber-300">●</span>
              )}
            </button>
          ))}

          <div className="border-t border-sky-700 mt-3 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200 mb-2 px-3">
              Configuración
            </p>
            <button
              type="button"
              onClick={() => handleSectionChange('config-establecimiento')}
              className={
                'w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                (activeSection === 'config-establecimiento'
                  ? 'bg-sky-800 text-amber-200 border border-amber-300/80'
                  : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
              }
            >
              <span>Configurar establecimiento</span>
            </button>
            <button
              type="button"
              onClick={() => handleSectionChange('panel-usuario')}
              className={
                'w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ' +
                (activeSection === 'panel-usuario'
                  ? 'bg-sky-800 text-amber-200 border border-amber-300/80'
                  : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
              }
            >
              <span>Panel de usuario</span>
            </button>
          </div>

          <div className="border-t border-sky-700 mt-3 pt-3 px-3 pb-2">
            <p className="text-[11px] text-slate-300 mb-2">
              Sesión: <span className="font-medium">{userEmail}</span>
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="w-full inline-flex items-center justify-center rounded-lg border border-cyan-300 px-3 py-2 text-sm font-medium text-cyan-50 hover:bg-sky-800 hover:border-amber-300 transition"
            >
              Cerrar sesión
            </button>
          </div>
        </nav>
      </div>

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

      {/* Main content - add top padding on mobile for fixed header */}
      <div className="flex-1 flex justify-center px-4 py-6 md:py-8 relative pt-20 md:pt-8">
        {children}
      </div>
    </div>
  );
}

export default AuthenticatedShell;
