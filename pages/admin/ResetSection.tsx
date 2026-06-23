import React from 'react';
import { useData } from '../../context/DataContext';
import Swal from 'sweetalert2';
import { Trash, AlertTriangle, ShieldAlert } from 'lucide-react';

const ResetSection: React.FC = () => {
  const { resetData } = useData();

  // TEMPAT GANTI KODE ID SERVER HARDCODED
  const AUTH_CODE = "ALISHLAH2026";

  const handleReset = async (type: 'all' | 'previous' | 'weekly' | 'donor' | 'expense', label: string) => {
    // 1. Tampilkan Popup Konfirmasi dengan Input Password
    const { value: inputCode } = await Swal.fire({
        title: 'Verifikasi Keamanan',
        html: `
            <p class="text-[13px] text-gray-500 mb-3 text-center">Reset Data ${label}: Tindakan ini <b>TIDAK BISA DIBATALKAN</b>. Data akan hilang permanen dari database.</p>
            <p class="mb-2 text-sm font-semibold text-gray-750 text-center">Masukkan Kode Token ID Server:</p>
            <div class="relative w-full max-w-xs mx-auto" style="display: block;">
                <input 
                    type="password" 
                    id="swal-custom-password" 
                    class="swal2-input !m-0 !w-full" 
                    placeholder="Kode Token ID Server..." 
                    style="display: block; width: 100%; box-sizing: border-box; padding-right: 42px; height: 44px; font-size: 15px;"
                />
                <button 
                    type="button" 
                    id="swal-toggle-password" 
                    style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); border: none; background: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; z-index: 10; color: #9ca3af;"
                    title="Intip Password"
                >
                    <svg id="eye-open-icon" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg id="eye-closed-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                </button>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            const toggleBtn = document.getElementById('swal-toggle-password');
            const passwordInput = document.getElementById('swal-custom-password') as HTMLInputElement;
            const eyeOpen = document.getElementById('eye-open-icon');
            const eyeClosed = document.getElementById('eye-closed-icon');
            
            if (toggleBtn && passwordInput && eyeOpen && eyeClosed) {
                toggleBtn.addEventListener('click', () => {
                    const isPassword = passwordInput.getAttribute('type') === 'password';
                    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
                    if (isPassword) {
                        eyeOpen.style.display = 'block';
                        eyeClosed.style.display = 'none';
                    } else {
                        eyeOpen.style.display = 'none';
                        eyeClosed.style.display = 'block';
                    }
                });
            }
        },
        preConfirm: () => {
            const password = (document.getElementById('swal-custom-password') as HTMLInputElement).value;
            if (!password) {
                Swal.showValidationMessage('Kode Token ID Server wajib diisi!');
                return false;
            }
            return password;
        }
    });

    // 2. Cek Kode ID Server
    if (inputCode) {
        if (inputCode === AUTH_CODE) {
            // JIKA KODE BENAR -> EKSEKUSI RESET
            resetData(type);
            Swal.fire({
                title: 'Berhasil Direset!',
                text: `Data ${label} berhasil dibersihkan dari database.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // JIKA KODE SALAH
            Swal.fire({
                title: 'Kode ID Server Gagal!',
                text: 'Kode ID Server yang Anda masukkan SALAH. Data tidak dihapus.',
                icon: 'error',
                confirmButtonColor: '#d33'
            });
        }
    }
  };

  return (
    <div className="space-y-3 md:space-y-6">
       <h2 className="text-xs md:text-2xl font-bold text-red-800 border-b pb-1 md:pb-2 flex items-center gap-1.5 md:gap-2">
           <AlertTriangle size={16} className="md:w-6 md:h-6" /> Reset Data (Database)
       </h2>
       
       <div className="bg-red-50 border border-red-200 p-2 md:p-4 rounded-lg flex gap-2 md:gap-3 items-start">
           <ShieldAlert className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
           <div className="text-red-800 text-[9px] md:text-sm leading-relaxed">
               <strong>PERINGATAN KEAMANAN:</strong><br/>
               Fitur ini menghapus data langsung dari Server Database. Tindakan ini tidak dapat dibatalkan. 
               Diperlukan <b>Kode ID Server</b> untuk melanjutkan proses reset.
           </div>
       </div>

       <div className="space-y-1.5 md:space-y-4">
           {[
               { id: 'previous', label: 'Data Panitia Sebelumnya' },
               { id: 'weekly', label: 'Data Mingguan (Per RT)' },
               { id: 'donor', label: 'Data Donatur / Amplop' },
               { id: 'expense', label: 'Data Pengeluaran' },
               { id: 'all', label: 'SEMUA DATA (SELURUHNYA)', danger: true }
           ].map((item) => (
               <div key={item.id} className={`flex items-center justify-between p-1.5 md:p-4 shadow-sm rounded border ${item.danger ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                   <span className={`font-bold text-[9px] md:text-base ${item.danger ? 'text-red-700' : 'text-gray-700'}`}>
                       {item.label}
                   </span>
                   <button 
                    onClick={() => handleReset(item.id as any, item.label)}
                    className={`px-2 py-1 md:px-4 md:py-2 rounded text-white text-[9px] md:text-sm font-bold flex items-center gap-1 md:gap-2 active:scale-95 transition shadow-sm ${item.danger ? 'bg-red-700 hover:bg-red-900' : 'bg-orange-500 hover:bg-orange-600'}`}
                   >
                       <Trash size={10} className="md:w-4 md:h-4" /> Reset
                   </button>
               </div>
           ))}
       </div>
    </div>
  );
};

export default ResetSection;