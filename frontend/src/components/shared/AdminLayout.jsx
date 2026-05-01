import React from 'react';
import AdminSidebar from './AdminSidebar';
import '../../pages/admin/adminStyles.css';

const AdminLayout = ({ children, activePage, onNavigate, theme, toggleTheme, userRole, onLogout }) => {
  return (
    <div className="admin-layout">
      <AdminSidebar 
        activePage={activePage} 
        onNavigate={onNavigate} 
        theme={theme} 
        toggleTheme={toggleTheme}
        userRole={userRole}
        onLogout={onLogout}
      />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
