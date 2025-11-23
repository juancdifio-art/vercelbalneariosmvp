import React from 'react';
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
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-sky-50 via-cyan-50 to-amber-50">
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
      <div className="flex-1 flex justify-center px-4 py-6 md:py-8 relative">
        {children}
      </div>
    </div>
  );
}

export default AuthenticatedShell;
