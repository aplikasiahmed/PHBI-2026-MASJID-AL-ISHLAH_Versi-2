import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import InputSection from './InputSection';
import PreviewSection from './PreviewSection';
import ReportSection from './ReportSection';
import ResetSection from './ResetSection';
import UserManagementSection from './UserManagementSection'; // Import baru
import { LayoutDashboard, FileInput, Eye, FileText, RefreshCcw, LogOut, UserCheck, UserCog } from 'lucide-react';
import Swal from 'sweetalert2';

const AdminDashboard: React.FC = () => {
  const { logout, currentUser, accessToken, googleLogin, appsScriptUrl } = useData();
  const [activePage, setActivePage] = useState<'input' | 'preview' | 'report' | 'reset' | 'users'>('input');

  const handleLogout = () => {
    Swal.fire({
      title: 'Yakin Mau Keluar?',
      text: "",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#047857',
      confirmButtonText: 'Keluar',
      cancelButtonText: 'Batal'
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        Swal.fire({
            icon: 'success',
            title: 'Anda Berhasil Keluar',
            showConfirmButton: false,
            timer: 1000
        });
      }
    });
  };

  const navItems = [
    { id: 'input', label: 'Input Data', icon: FileInput },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'report', label: 'Laporan', icon: FileText },
    { id: 'users', label: 'Kelola Admin', icon: UserCog }, 
    { id: 'reset', label: 'Reset', icon: RefreshCcw },
  ];

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
         <div className="container mx-auto px-2 md:px-4">
             {/* Header Row */}
             <div className="flex justify-between items-center py-2 md:py-3 border-b border-gray-100">
                 <div className="flex items-center gap-2">
                     <div className="bg-primary p-1 md:p-1.5 rounded text-white">
                        <LayoutDashboard size={18} className="md:w-5 md:h-5" />
                     </div>
                     <div>
                        <h1 className="font-bold text-sm md:text-xl text-gray-800 leading-none">Dashboard Admin</h1>
                        <p className="text-[9px] md:text-[10px] text-gray-500 md:block">Masjid Jami' Al-Ishlah</p>
                     </div>
                 </div>

                 <div className="flex items-center gap-2 md:gap-4">
                     {/* Google Link Status Badge or Button */}
                     {appsScriptUrl ? (
                       <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-emerald-200 shadow-sm">
                         <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                         <span className="text-[8px] md:text-[9px] font-bold text-emerald-800 uppercase hidden md:inline">Otomatis Terhubung</span>
                         <span className="text-[8px] md:text-[9px] font-bold text-emerald-800 uppercase md:hidden">Otomatis</span>
                       </div>
                     ) : !accessToken ? (
                       <button
                         onClick={googleLogin}
                         className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[9px] md:text-xs font-bold transition shadow-sm active:scale-95 animate-pulse"
                         title="Silakan hubungkan server untuk menulis input data"
                       >
                         <span>Sambungkan Server</span>
                       </button>
                     ) : (
                       <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-emerald-100">
                         <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                         <span className="text-[8px] md:text-[9px] font-bold text-emerald-800 uppercase hidden md:inline">Server Terhubung</span>
                         <span className="text-[8px] md:text-[9px] font-bold text-emerald-800 uppercase md:hidden">Sheets</span>
                       </div>
                     )}

                     {/* Active User Badge */}
                     <div className="flex items-center gap-1 md:gap-2 bg-emerald-50 px-2 py-1 md:px-3 md:py-1.5 rounded-full border border-emerald-100 animate-fade-in-up">
                        <div className="bg-emerald-200 p-0.5 md:p-1 rounded-full">
                            <UserCheck size={12} className="text-emerald-800 md:w-3.5 md:h-3.5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold leading-none hidden md:block">Active User</span>
                            <span className="text-[10px] md:text-xs font-bold text-emerald-800 leading-none">{currentUser || 'Admin'}</span>
                        </div>
                     </div>

                     <button 
                        onClick={handleLogout} 
                        className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 md:px-3 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold transition shadow-sm active:scale-95"
                     >
                         <LogOut size={12} className="md:w-3.5 md:h-3.5 text-white" /> 
                         <span>KELUAR</span>
                     </button>
                 </div>
             </div>

             {/* Navigation Tabs (Mobile Optimized: No Scroll, Flex Equal Width) */}
             <div className="flex w-full justify-between items-stretch gap-1 py-1.5 md:py-3 md:justify-start md:gap-2 md:overflow-x-auto">
                 {navItems.map((item) => {
                     const Icon = item.icon;
                     const isActive = activePage === item.id;
                     return (
                         <button
                            key={item.id}
                            onClick={() => setActivePage(item.id as any)}
                            className={`
                                flex-1 md:flex-none 
                                flex flex-col md:flex-row items-center justify-center 
                                gap-0.5 md:gap-2 
                                px-0.5 py-1.5 md:px-4 md:py-2 
                                rounded-lg md:rounded-full 
                                transition
                                ${
                                isActive 
                                ? 'bg-primary text-white shadow-md' 
                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 md:bg-gray-100 md:text-gray-600 md:hover:bg-gray-200'
                            }`}
                         >
                             <Icon size={14} className="md:w-4 md:h-4" />
                             <span className="text-[9px] md:text-sm font-medium leading-none text-center whitespace-nowrap">
                                 {/* Singkatkan label di mobile jika perlu, tapi flex-col biasanya cukup */}
                                 {item.id === 'users' ? <span className="md:hidden">Admin</span> : null}
                                 {item.id === 'users' ? <span className="hidden md:inline">Kelola Admin</span> : null}
                                 
                                 {item.id !== 'users' && item.label}
                             </span>
                         </button>
                     );
                 })}
             </div>
         </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto p-2 md:p-6 pb-20">
          {!appsScriptUrl && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4 text-gray-800 text-xs md:text-sm shadow-xs flex gap-3 items-start animate-fade-in">
                  <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700 font-bold shrink-0">
                      ⚠️
                  </div>
                  <div className="flex-1 space-y-1">
                      <p className="font-bold text-amber-900 leading-tight">Bypass Multi Device Belum Aktif di Perangkat ini!</p>
                      <p className="text-gray-600 leading-relaxed text-[11px] md:text-xs">
                          mari hubungkan kembali URL Apps Script Anda.
                      </p>
                      <button 
                         onClick={() => setActivePage('users')}
                         className="mt-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] md:text-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                         <span>🔧 Hubungkan Lagi Apps Script</span>
                      </button>
                  </div>
              </div>
          )}

         <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-8 min-h-[500px]">
             {activePage === 'input' && <InputSection />}
             {activePage === 'preview' && <PreviewSection />}
             {activePage === 'report' && <ReportSection />}
             {activePage === 'users' && <UserManagementSection />}
             {activePage === 'reset' && <ResetSection />}
         </div>
      </main>

    </div>
  );
};

export default AdminDashboard;