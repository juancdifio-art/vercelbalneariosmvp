import React from 'react';
import { NavIcon, SalirIcon } from './icons';
import { groupNavItems } from '../config/sections';

/**
 * Menu lateral de escritorio.
 *
 * Colapsado se convierte en una barra de iconos usable, no en una franja
 * vacia: la navegacion se sigue renderizando y cada item queda con su
 * tooltip.
 */
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
  const grupos = groupNavItems(navItems);
  const inicial = (userEmail || '?').trim().charAt(0).toUpperCase();

  const itemClasses = (activo) =>
    'group relative flex w-full items-center rounded-lg py-2 text-left transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950 ' +
    (sidebarCollapsed ? 'justify-center px-0 ' : 'gap-3 px-3 ') +
    (activo
      ? 'bg-sky-900 text-white'
      : 'text-sky-100/75 hover:bg-sky-900/60 hover:text-white');

  return (
    <aside
      className={
        'hidden md:flex md:sticky md:top-0 md:h-screen md:self-start flex-col bg-sky-950 py-4 transition-all duration-200 ' +
        (sidebarCollapsed ? 'md:w-16 px-2' : 'md:w-60 px-3')
      }
    >
      {/* Cabecera */}
      <div className={'mb-5 flex items-center ' + (sidebarCollapsed ? 'justify-center' : 'gap-2')}>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
              Balneario
            </p>
            <p className="truncate text-sm font-semibold text-white">
              {establishment?.name || 'Tu establecimiento'}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sky-300 transition hover:bg-sky-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <svg viewBox="0 0 16 16" className={'h-4 w-4 transition-transform duration-200 ' + (sidebarCollapsed ? '' : 'rotate-180')} aria-hidden="true">
            <path d="M6.25 3.5L10 8l-3.75 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-4 overflow-y-auto">
        {grupos.map((grupo) => (
          <div key={grupo.id} className="space-y-0.5">
            {grupo.label && !sidebarCollapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/90">
                {grupo.label}
              </p>
            )}
            {grupo.label && sidebarCollapsed && <div className="mx-2 mb-1 border-t border-white/10" />}

            {grupo.items.map((item) => {
              const activo = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSection(item.id)}
                  aria-current={activo ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={itemClasses(activo)}
                >
                  {activo && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-cyan-400" aria-hidden="true" />
                  )}
                  <NavIcon sectionId={item.id} className="h-[18px] w-[18px] shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate text-[13px]">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Cuenta */}
      <div className="mt-4 border-t border-white/10 pt-3">
        {!sidebarCollapsed && (
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[11px] font-semibold text-cyan-200">
              {inicial}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-sky-200/80" title={userEmail}>
              {userEmail}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
          className={
            'flex w-full items-center rounded-lg py-2 text-[13px] text-sky-100/75 transition hover:bg-sky-900 hover:text-white ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-950 ' +
            (sidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3')
          }
        >
          <SalirIcon className="h-[18px] w-[18px] shrink-0" />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
