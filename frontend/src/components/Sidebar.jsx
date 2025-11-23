import React from 'react';

function Sidebar({
  establishment,
  userEmail,
  activeSection,
  onChangeSection,
  sidebarCollapsed,
  onToggleSidebar,
  onLogout,
  navItems
}) {
  return (
    <aside
      className={
        'hidden md:flex flex-col border-r border-cyan-100 bg-sky-900 py-4 transition-all duration-200 ' +
        (sidebarCollapsed ? 'md:w-10 px-2' : 'md:w-60 px-4')
      }
    >
      <div className="mb-4 flex items-start">
        {!sidebarCollapsed && (
          <div className="flex-1 mr-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400 mb-1">
              Balneario
            </p>
            <p className="text-sm font-semibold text-slate-100">
              {establishment?.name || 'Tu establecimiento'}
            </p>
            <p className="text-[11px] text-slate-300 mt-1">
              Bienvenido, <span className="font-medium">{userEmail}</span>
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSidebar}
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/70 bg-sky-800 text-cyan-50 hover:bg-sky-700 hover:border-amber-300 transition"
        >
          <svg
            viewBox="0 0 16 16"
            className={
              'h-3.5 w-3.5 transform transition-transform duration-150 ' +
              (sidebarCollapsed ? '' : 'rotate-180')
            }
            aria-hidden="true"
          >
            <path
              d="M6.25 3.5L10 8l-3.75 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {!sidebarCollapsed && (
        <>
          <nav className="flex-1 space-y-1 text-xs">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSection(item.id)}
                className={
                  'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition ' +
                  (activeSection === item.id
                    ? 'bg-sky-800 text-amber-200 border border-amber-300/80 shadow-sm shadow-amber-500/40'
                    : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
                }
              >
                <span>{item.label}</span>
                {activeSection === item.id && (
                  <span className="text-[10px] text-amber-300">●</span>
                )}
              </button>
            ))}
            <p className="mt-4 mb-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
              Configuración
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onChangeSection('config-establecimiento')}
                className={
                  'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition ' +
                  (activeSection === 'config-establecimiento'
                    ? 'bg-sky-800 text-amber-200 border border-amber-300/80 shadow-sm shadow-amber-500/40'
                    : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
                }
              >
                <span>Configurar establecimiento</span>
                {activeSection === 'config-establecimiento' && (
                  <span className="text-[10px] text-amber-300">●</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onChangeSection('panel-usuario')}
                className={
                  'w-full flex items-center justify-between rounded-lg px-3 py-2 text-left transition ' +
                  (activeSection === 'panel-usuario'
                    ? 'bg-sky-800 text-amber-200 border border-amber-300/80 shadow-sm shadow-amber-500/40'
                    : 'text-cyan-50 hover:bg-sky-800/70 hover:text-amber-200')
                }
              >
                <span>Panel de usuario</span>
                {activeSection === 'panel-usuario' && (
                  <span className="text-[10px] text-amber-300">●</span>
                )}
              </button>
            </div>
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-300 px-3 py-1.5 text-[11px] font-medium text-cyan-50 hover:bg-sky-800 hover:border-amber-300 transition"
          >
            Cerrar sesión
          </button>
        </>
      )}
    </aside>
  );
}

export default Sidebar;
