import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import Swal from 'sweetalert2';
import { UserPlus, ShieldAlert, Users, Trash2, Lock, Unlock, Eye, EyeOff, Clock, Laptop, Smartphone, Tablet, Globe, RefreshCw, BarChart3 } from 'lucide-react';
import { SPREADSHEET_ID, testAppsScriptConnection } from '../../lib/googleSheetsClient';
import { getAnalyticsData, AnalyticsData } from '../../utils/analytics';

const UserManagementSection: React.FC = () => {
  const { addAdminUser, getAdminUsers, deleteAdminUser, appsScriptUrl, setAppsScriptUrl } = useData();
  const [users, setUsers] = useState<any[]>([]);
  const [scriptUrlInput, setScriptUrlInput] = useState(appsScriptUrl || '');
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockKey, setUnlockKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [showUnlockKey, setShowUnlockKey] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    masterPassword: ''
  });

  const loadUsers = async () => {
      const data = await getAdminUsers();
      setUsers(data);
  };

  useEffect(() => {
    loadUsers();
    setAnalytics(getAnalyticsData());
  }, []);

  const handleCopyScript = () => {
    const scriptCode = `function doPost(e) {
  var response = { success: false, error: "" };
  try {
    var SPREADSHEET_ID = "${SPREADSHEET_ID || '1xLyxq0mi2ak0IE-0KsQxKg2Zocg2Vi6w8wCC-_Sz8yQ'}";
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetName = data.sheet;
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (action === 'write') {
      var values = data.values;
      sheet.clear();
      if (values && values.length > 0) {
        var numRows = values.length;
        var numCols = values[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(values);
      }
      response.success = true;
    } else if (action === 'clear') {
      sheet.clear();
      response.success = true;
    } else {
      throw new Error("Action " + action + " tidak didukung.");
    }
  } catch (error) {
    response.success = false;
    response.error = error.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Koneksi ke Apps Script PHBI Maulid Berhasil!" }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password || !formData.masterPassword) {
        Swal.fire('Peringatan', 'Semua kolom wajib diisi!', 'warning');
        return;
    }

    if (formData.password !== formData.confirmPassword) {
        Swal.fire('Peringatan', 'Konfirmasi password tidak cocok!', 'warning');
        return;
    }

    // Call Context Function
    const success = await addAdminUser(formData.username, formData.password, formData.masterPassword);
    
    // REVISI 1: Hapus isi konten form baik berhasil maupun gagal
    setFormData({ username: '', password: '', confirmPassword: '', masterPassword: '' });

    if (success) {
        Swal.fire({
            title: 'Berhasil',
            text: `Admin user baru berhasil ditambahkan.`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
        loadUsers(); // Reload list
    }
  };

  const handleDelete = async (id: string, username: string) => {
      const { value: masterPass } = await Swal.fire({
          title: 'Verifikasi Keamanan',
          html: `
              <p class="mb-3 text-[13px] text-gray-500 leading-relaxed text-center">Hapus user: <strong>${username}</strong></p>
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

      if (masterPass) {
          const success = await deleteAdminUser(id, masterPass);
          if (success) {
              Swal.fire({
                  title: 'Terhapus',
                  text: 'User dihapus.',
                  icon: 'success',
                  timer: 1000,
                  showConfirmButton: false
              });
              loadUsers();
          }
      }
  };

  const handleUnlock = () => {
    if (unlockKey.trim() === 'ALISHLAH2026') {
      setIsUnlocked(true);
      setUnlockKey('');
      Swal.fire({
        icon: 'success',
        title: 'Akses Diberikan',
        text: 'Konfigurasi Google Apps Script berhasil dibuka!',
        showConfirmButton: false,
        timer: 1500
      });
    } else {
      Swal.fire('Akses Ditolak', 'Kode Keamanan Server tidak cocok / salah.', 'error');
    }
  };

  const handleSaveScriptUrl = async () => {
    const trimmedUrl = scriptUrlInput.trim();
    if (!trimmedUrl) {
      Swal.fire('Info', 'Masukkan Google Apps Script Web App URL yang valid.', 'info');
      return;
    }
    if (!trimmedUrl.includes('/exec')) {
      Swal.fire({
        icon: 'error',
        title: 'Format URL Salah 🛑',
        html: `
          <div class="text-left text-xs leading-relaxed space-y-2 text-gray-700">
            <p>URL Google Apps Script harus mengandung <strong>/exec</strong> di dalamnya.</p>
            <p>Contoh format yang benar:</p>
            <code class="block p-1.5 bg-gray-100 rounded text-[11px] font-mono break-all selection:all">https://script.google.com/macros/s/AKfycb.../exec</code>
            <p class="font-bold text-amber-700 mt-2">💡 Tips:</p>
            <p>Harap pastikan Anda telah menekan tombol "Terapkan" (Deploy) &rarr; "Penerapan baru" sebagai "Aplikasi Web" di editor Apps Script Anda terlebih dahulu.</p>
          </div>
        `
      });
      return;
    }

    setIsTesting(true);
    Swal.fire({
      title: 'Menguji Koneksi...',
      text: 'Sedang memvalidasi setelan Apps Script Anda...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    const testResult = await testAppsScriptConnection(trimmedUrl);
    setIsTesting(false);

    if (testResult.success) {
      setAppsScriptUrl(trimmedUrl);
      Swal.fire({
        icon: 'success',
        title: 'Koneksi Berhasil! 🟢',
        text: 'Google Apps Script terhubung dengan lancar! Sekarang Anda bebas menginput & merubah data tanpa perlu login akun Google di HP.',
        confirmButtonColor: '#10b981',
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Koneksi Gagal 🛑',
        html: `
          <div class="text-left text-xs space-y-2 leading-relaxed text-gray-700 max-h-[300px] overflow-y-auto">
            <p class="font-bold text-red-650 bg-red-50 p-2 rounded border border-red-100">${testResult.message}</p>
            
            <p class="font-bold border-t pt-2 mt-3 text-gray-800">📋 CARA PALING AMPUH MEMPERBAIKI INI:</p>
            <ol class="list-decimal list-inside space-y-1 text-gray-600 pl-1">
              <li>Di halaman editor Google Apps Script Anda, klik tombol <strong>Terapkan (Deploy)</strong> di kanan atas.</li>
              <li>Pilih <strong>Terapkan Baru (New Deployment)</strong>.</li>
              <li>Pastikan jenis penerapan adalah <strong>Aplikasi Web</strong> (Web App).</li>
              <li>Atur <strong>Jalankan sebagai (Execute as)</strong> ke: <strong class="text-gray-900">Saya (email uploader)</strong>.</li>
              <li>Atur <strong>Siapa yang memiliki akses (Who has access)</strong> ke: <strong class="text-emerald-700 underline font-bold">Siapa saja (Anyone)</strong>.</li>
              <li>Klik tombol biru <strong>Terapkan (Deploy)</strong>.</li>
              <li>Salin **URL Aplikasi Web** baru yang diberikan (yang berakhiran <code>/exec</code>) dan masukkan kembali di sini.</li>
            </ol>
          </div>
        `,
        confirmButtonText: 'Tetap Gunakan URL Ini',
        showCancelButton: true,
        cancelButtonText: 'Perbaiki Dulu',
        confirmButtonColor: '#9ca3af',
        cancelButtonColor: '#10b981',
      }).then((sweetResult) => {
        if (sweetResult.isConfirmed) {
          setAppsScriptUrl(trimmedUrl);
          Swal.fire('Disimpan', 'URL disimpan dengan peringatan. Silakan lakukan Deploy Ulang jika input data masih mengalami error.', 'warning');
        }
      });
    }
  };

  const handleDisconnectScriptUrl = () => {
    setAppsScriptUrl(null);
    setScriptUrlInput('');
    Swal.fire('Berhasil', 'Integrasi Google Apps Script diputuskan.', 'success');
  };

  const inputClass = "w-full bg-white border rounded-lg px-2 py-1.5 md:px-3 md:py-2 text-[10px] md:text-sm focus:ring-1 focus:ring-primary outline-none shadow-sm placeholder:text-gray-300";
  const labelClass = "block text-[9px] md:text-xs font-bold text-gray-600 mb-0.5 md:mb-1";

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Header Kecil */}
      <div className="border-b pb-2 md:pb-4">
        <h2 className="text-sm md:text-2xl font-bold text-gray-800 flex items-center gap-1.5 md:gap-2">
            <UserPlus className="text-primary w-4 h-4 md:w-6 md:h-6" /> 
            <span>Kelola Admin</span>
        </h2>
        <p className="text-[9px] md:text-sm text-gray-500 mt-0.5 leading-tight">
            Tambahkan akun pantia untuk sebagai admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
          
          {/* FORM INPUT COMPACT */}
          <div className="bg-gray-50 p-3 md:p-6 rounded-lg border border-gray-200 shadow-sm h-fit">
              <h3 className="font-bold text-xs md:text-lg mb-2 md:mb-3 text-gray-700 border-b border-gray-200 pb-1.5 md:pb-2">Tambah Admin Baru</h3>
              <form onSubmit={handleSubmit} className="space-y-2 md:space-y-4">
                  <div>
                      <label className={labelClass}>Username</label>
                      <input 
                        type="text" 
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        className={inputClass}
                        placeholder="Contoh: bendahara2"
                      />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <div>
                        <label className={labelClass}>Password</label>
                        <input 
                            type="text" 
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            className={inputClass}
                            placeholder="******"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Ulangi Password</label>
                        <input 
                            type="text" 
                            value={formData.confirmPassword}
                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                            className={inputClass}
                            placeholder="******"
                        />
                    </div>
                  </div>

                  <hr className="border-gray-200 my-1 md:my-2" />

                  <div className="bg-red-50 p-2 md:p-3 rounded border border-red-100">
                      <label className="block text-[9px] md:text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                          <ShieldAlert size={10} className="md:w-3.5 md:h-3.5" /> Masukkan Kode ID Server
                      </label>
                      <input 
                        type="password" 
                        value={formData.masterPassword}
                        onChange={e => setFormData({...formData, masterPassword: e.target.value})}
                        className={`${inputClass} border-red-200 focus:ring-red-500`}
                        placeholder="Kode ID Server..."
                      />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-primary hover:bg-emerald-800 text-white font-bold py-1.5 md:py-2.5 rounded-lg shadow-sm text-[10px] md:text-sm transition active:scale-95 flex justify-center items-center gap-2 mt-2"
                  >
                      <UserPlus size={12} className="md:w-[18px] md:h-[18px]" /> TAMBAH ADMIN
                  </button>
              </form>
          </div>

          {/* LIST ADMIN COMPACT */}
          <div>
              <h3 className="font-bold text-xs md:text-lg mb-2 md:mb-4 text-gray-700 flex items-center gap-1.5 md:gap-2">
                  <Users size={14} className="md:w-5 md:h-5" /> Daftar Admin
              </h3>
              <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                  {users.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-[10px] md:text-xs">Belum ada user tambahan.</div>
                  ) : (
                      <ul className="divide-y divide-gray-100">
                          {users.map((user, idx) => (
                              <li key={user.id} className="p-2 md:p-4 flex justify-between items-center hover:bg-gray-50 transition">
                                  <div className="flex items-center gap-2 md:gap-3">
                                      <div className="bg-gray-100 w-5 h-5 md:w-8 md:h-8 flex items-center justify-center rounded-full text-gray-600 font-bold text-[9px] md:text-xs">
                                          {idx + 1}
                                      </div>
                                      <div>
                                          <p className="font-bold text-gray-800 text-[10px] md:text-sm leading-tight">{user.username}</p>
                                          <p className="text-[8px] md:text-[10px] text-gray-400 leading-tight mt-0.5">
                                            {new Date(user.created_at).toLocaleDateString('id-ID')}
                                          </p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDelete(user.id, user.username)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 md:p-2 rounded transition"
                                    title="Hapus"
                                  >
                                      <Trash2 size={12} className="md:w-4 md:h-4" />
                                  </button>
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
          </div>

      </div>

      {/* CONFIGURATION APPS SCRIPT BYPASS */}
      {!isUnlocked ? (
        <div className="bg-white border text-gray-800 p-4 md:p-6 rounded-lg shadow-sm border-amber-100 bg-amber-50/10">
            <div className="flex items-center gap-2 mb-3">
                <Lock className="text-amber-600 w-5 h-5 md:w-6 md:h-6 animate-pulse" />
                <h3 className="font-bold text-xs md:text-lg text-amber-850">
                     🔗 Integration Apps Server (Terkunci)
                </h3>
            </div>
            <p className="text-[10px] md:text-sm text-gray-600 mb-4 leading-relaxed">
                Hanya <strong>Pemilik Server</strong> yang dapat membuka.
            </p>
            <div className="bg-white border border-amber-200 p-3 rounded-lg max-w-md">
                <label className="block text-[10px] md:text-xs font-bold text-amber-700 mb-1.5">
                     Masukkan Kode Keamanan Server
                </label>
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <input 
                          type={showUnlockKey ? "text" : "password"}
                          value={unlockKey}
                          onChange={e => setUnlockKey(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                          className={`${inputClass} border-amber-200 focus:ring-amber-500 pr-10 w-full`}
                          placeholder="Masukkan Token ID Server..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnlockKey(!showUnlockKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                          title="Peep Token"
                        >
                          {showUnlockKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <button
                      onClick={handleUnlock}
                      className="bg-amber-600 hover:bg-amber-750 text-white font-bold px-4 py-1.5 md:px-5 md:py-2 rounded-lg text-xs md:text-sm transition shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      Buka Kunci
                    </button>
                </div>
            </div>
        </div>
      ) : (
        <div className="bg-white border text-gray-800 p-3 md:p-6 rounded-lg shadow-sm border-emerald-100 bg-emerald-50/10 transition-all duration-300">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                <h3 className="font-bold text-xs md:text-lg text-emerald-800 flex items-center gap-1.5 md:gap-2">
                     🔗 Integration Apps Server (Terkunci)
                </h3>
                <button
                  onClick={() => setIsUnlocked(false)}
                  className="text-xs text-gray-500 hover:text-amber-700 font-bold flex items-center gap-1 bg-gray-100 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition border border-gray-200 cursor-pointer shadow-xs whitespace-nowrap"
                  title="Kunci Kembali"
                >
                  <Lock size={12} />
                  <span className="text-[9px] md:text-xs">Kunci Kembali</span>
                </button>
            </div>
            <p className="text-[10px] md:text-sm text-gray-600 mb-2 md:mb-4 leading-relaxed">
                Konfigurasikan Apps Script Web App URL agar multi-admin di beda perangkat dapat otomatis menyimpan dan merubah data ke Google Sheets <strong>TANPA</strong> perlu autentikasi / login Google pribadi masing-masing.
            </p>

            {/* Toggleable Panduan */}
            <div className="mb-4">
                <button 
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-[10px] md:text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{showGuide ? "▲ Sembunyikan Panduan Pembuatan" : "📖 Lihat Cara Membuat URL Google Apps Script"}</span>
                </button>

                {showGuide && (
                  <div className="mt-3 bg-white border border-emerald-200 rounded-lg p-3 md:p-5 space-y-4 shadow-sm animate-fade-in text-[10px] md:text-sm text-gray-700">
                      <h4 className="font-bold text-emerald-800 border-b border-emerald-100 pb-2">📋 Langkah-Langkah Membuat Google Apps Script Web App:</h4>
                      <ol className="list-decimal list-inside space-y-2.5 leading-relaxed">
                          <li>Buka Google Sheet Laporan Keuangan Mauld Anda.</li>
                          <li>Di bar menu atas, klik menu <strong>Ekstensi</strong> (Extensions) &rarr; pilih <strong>Apps Script</strong>.</li>
                          <li>Hapus semua kode bawaan yang ada di halaman editor tersebut (biasanya <code>function myFunction() &#123; ... &#125;</code>).</li>
                          <li>
                              <div className="inline">Salin kode di bawah ini lalu tempel (paste) ke editor Apps Script:</div>
                              <div className="mt-2 bg-gray-905 text-gray-100 rounded-lg overflow-hidden border border-gray-850 font-mono text-[9px] md:text-xs">
                                  <div className="bg-gray-800 px-3 py-1.5 flex justify-between items-center text-gray-300">
                                      <span>Code Google Apps Script</span>
                                      <button 
                                        type="button"
                                        onClick={handleCopyScript}
                                        className={`px-2.5 py-1 rounded text-[8px] md:text-xs font-bold transition duration-200 ${copied ? 'bg-emerald-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-100'}`}
                                      >
                                        {copied ? 'Tersalin!' : 'Salin Kode'}
                                      </button>
                                  </div>
                                  <pre className="p-3 overflow-x-auto max-h-[160px] md:max-h-[200px] text-left leading-normal whitespace-pre">
{`function doPost(e) {
  var response = { success: false, error: "" };
  try {
    var SPREADSHEET_ID = "${SPREADSHEET_ID || '1xLyxq0mi2ak0IE-0KsQxKg2Zocg2Vi6w8wCC-_Sz8yQ'}";
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetName = data.sheet;
    
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (action === 'write') {
      var values = data.values;
      sheet.clear();
      if (values && values.length > 0) {
        var numRows = values.length;
        var numCols = values[0].length;
        sheet.getRange(1, 1, numRows, numCols).setValues(values);
      }
      response.success = true;
    } else if (action === 'clear') {
      sheet.clear();
      response.success = true;
    } else {
      throw new Error("Action " + action + " tidak didukung.");
    }
  } catch (error) {
    response.success = false;
    response.error = error.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Koneksi ke Apps Script PHBI Maulid Berhasil!" }))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                                  </pre>
                              </div>
                          </li>
                          <li>Klik ikon <strong>Simpan Projek</strong> (ikon disket 💾) di bagian atas editor.</li>
                          <li>Klik tombol <strong>Terapkan</strong> (Deploy) di bagian kanan atas &rarr; Pilih <strong>Penerapan baru</strong> (New deployment).</li>
                          <li>Klik ikon gerigi di sebelah kiri "Pilih Jenis" &rarr; pilih <strong>Aplikasi web</strong> (Web app).</li>
                          <li>
                              Konfigurasikan setelan berikut dengan hati-hati (Sangat Penting):
                              <ul className="list-disc list-inside ml-5 mt-1 space-y-1 text-gray-600">
                                  <li>Deskripsi: <span className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[9px] md:text-xs">Bypass Multi Admin Maulid</span></li>
                                  <li>Jalankan sebagai (Execute as): <strong>Saya (email uploader/pemilik spreadsheet)</strong></li>
                                  <li>Siapa yang memiliki akses (Who has access): <strong>Siapa saja (Anyone)</strong></li>
                              </ul>
                          </li>
                          <li>Klik tombol biru <strong>Terapkan</strong> (Deploy).</li>
                          <li>Jika muncul jendela otorisasi, berikan akses &rarr; klik <em>Lanjutan/Advanced</em> &rarr; klik <em>Buka PHBI (tidak aman) / Go to ... (unsafe)</em> &rarr; lalu klik <strong>Izinkan (Allow)</strong>.</li>
                          <li>Salin **URL Aplikasi Web** yang diakhiri dengan <code>/exec</code>, tempel/paste di kolom di bawah ini, lalu klik tombol **Hubungkan Script**!</li>
                      </ol>
                  </div>
                )}
            </div>

            <div className="space-y-2">
                <label className={labelClass}>Apps Script Web App URL</label>
                <div className="flex flex-col md:flex-row gap-2">
                    <input 
                      type="text" 
                      value={scriptUrlInput}
                      onChange={e => setScriptUrlInput(e.target.value)}
                      className={`${inputClass} flex-1`}
                      placeholder="https://script.google.com/macros/s/.../exec"
                    />
                    <button
                       onClick={handleSaveScriptUrl}
                       className="bg-primary hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-lg text-xs md:text-sm transition shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                       Hubungkan Script
                    </button>
                </div>
                {appsScriptUrl ? (
                    <div className="text-[10px] md:text-xs text-emerald-700 font-semibold flex items-center gap-1.5 mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded">
                         <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                         <span>Terhubung: Penulisan draf & item terbit dialihkan otomatis ke Web App!</span>
                         <button className="text-red-600 hover:text-red-800 font-bold underline ml-auto bg-transparent border-0 cursor-pointer text-[10px]" onClick={handleDisconnectScriptUrl}>PUTUSKAN</button>
                    </div>
                ) : (
                    <div className="text-[10px] md:text-xs text-gray-400">
                        *Belum terhubung. Silakan hubungkan Apps Server.
                    </div>
                )}
            </div>
        </div>
      )}

      {/* KARTU STATISTIK KUNJUNGAN WEBSITE */}
      {analytics && (
        <div className="bg-white border border-gray-200 p-4 md:p-6 rounded-lg shadow-sm mt-4 md:mt-6 transition-all duration-300">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary w-5 h-5 md:w-6 md:h-6" />
              <div>
                <h3 className="font-bold text-xs md:text-lg text-gray-800 leading-none">
                  Statistik Kunjungan Website PHBI
                </h3>
                <p className="text-[9px] md:text-xs text-gray-400 mt-1">
                  Menampilkan aktivitas kunjungan jamaah/donatur secara real-time
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setAnalytics(getAnalyticsData());
                Swal.fire({
                  icon: 'success',
                  title: 'Sinkronisasi Berhasil',
                  text: 'Data statistik kunjungan telah disegarkan!',
                  timer: 1000,
                  showConfirmButton: false
                });
              }}
              className="text-gray-500 hover:text-primary transition p-1.5 hover:bg-gray-50 rounded-full border border-gray-200 shadow-xs"
              title="Segarkan Data"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Grid Overview (3 Kartu Kecil) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Pageviews */}
            <div className="bg-emerald-50/45 border border-emerald-100/70 p-3 rounded-xl flex items-center gap-3">
              <div className="bg-emerald-100/60 p-2 rounded-lg text-emerald-800">
                <Eye size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">Total Kunjungan</p>
                <p className="text-sm md:text-xl font-extrabold text-emerald-950 mt-1">
                  {analytics.totalPageViews.toLocaleString('id-ID')}
                </p>
                <span className="text-[8px] text-emerald-700 font-medium">Kali halaman diakses</span>
              </div>
            </div>

            {/* Unique Visitors */}
            <div className="bg-blue-50/45 border border-blue-100/70 p-3 rounded-xl flex items-center gap-3">
              <div className="bg-blue-100/60 p-2 rounded-lg text-blue-800">
                <Users size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">Pengunjung Unik</p>
                <p className="text-sm md:text-xl font-extrabold text-blue-950 mt-1">
                  {analytics.uniqueVisitors.toLocaleString('id-ID')}
                </p>
                <span className="text-[8px] text-blue-700 font-medium">Berdasarkan sidik perangkat</span>
              </div>
            </div>

            {/* Average Duration */}
            <div className="bg-amber-50/45 border border-amber-100/70 p-3 rounded-xl flex items-center gap-3">
              <div className="bg-amber-100/60 p-2 rounded-lg text-amber-800">
                <Clock size={18} className="md:w-5 md:h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">Rata-rata Sesi</p>
                <p className="text-sm md:text-xl font-extrabold text-amber-950 mt-1">
                  {analytics.avgDurationMin.toFixed(1)} <span className="text-[10px] md:text-xs font-semibold">Min</span>
                </p>
                <span className="text-[8px] text-amber-750 font-medium">Durasi membaca laporan</span>
              </div>
            </div>
          </div>

          {/* Histogram Tren Kunjungan 7 Hari Terakhir */}
          <div className="mt-4 md:mt-6 bg-slate-50/60 border border-slate-100 p-3 md:p-4 rounded-xl">
            <h4 className="font-bold text-[11px] md:text-xs text-slate-700 mb-1 flex items-center gap-1">
              <span>📅 Tren Kunjungan Harian</span>
              <span className="text-[9px] font-normal text-slate-400">(7 Hari Terakhir)</span>
            </h4>
            
            {/* Bars container */}
            <div className="flex items-end justify-between gap-1.5 md:gap-3 h-28 pt-4 pb-1">
              {analytics.dailyViews.map((day, idx) => {
                const maxViews = Math.max(...analytics.dailyViews.map(d => d.views), 1);
                // Ensure percentage is at least 15% for visual feedback
                const percent = Math.max(15, Math.floor((day.views / maxViews) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 bg-slate-900 border border-slate-800 text-white text-[8px] font-mono rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-30 pointer-events-none shadow-md shadow-slate-950/20" style={{ fontSize: '9px' }}>
                      {day.views} Views • {day.unique} Unik
                    </div>
                    {/* Bar visual */}
                    <div className="w-full bg-slate-100/80 rounded-sm overflow-hidden h-20 flex items-end animate-fade-in-up">
                      <div 
                        style={{ height: `${percent}%` }}
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-emerald-700 hover:to-emerald-500 transition-all duration-300 rounded-sm cursor-pointer"
                      ></div>
                    </div>
                    {/* Label */}
                    <span className="text-[8px] md:text-[9px] text-slate-400 font-semibold truncate max-w-[48px] md:max-w-full text-center">
                      {day.date.split(',')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rincian Segmentasi (Perangkat & Browser) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t pt-4 border-gray-105">
            {/* Segmentasi Perangkat */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-[11px] md:text-xs text-gray-700 flex items-center gap-1">
                <Smartphone size={12} className="text-gray-500" />
                <span>📱 Segmentasi Perangkat</span>
              </h4>
              <div className="space-y-2">
                {(() => {
                  const total = analytics.devices.mobile + analytics.devices.desktop + analytics.devices.tablet || 1;
                  const mobPct = Math.round((analytics.devices.mobile / total) * 100);
                  const dskPct = Math.round((analytics.devices.desktop / total) * 100);
                  const tabPct = 100 - mobPct - dskPct; // ensure perfectly sums up to 100%
                  
                  return (
                    <>
                      {/* Mobile */}
                      <div className="text-[10px] md:text-xs space-y-1">
                        <div className="flex justify-between text-gray-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Smartphone size={10} className="text-slate-400" /> Smartphone / HP
                          </span>
                          <span>{mobPct}% ({analytics.devices.mobile})</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${mobPct}%` }}></div>
                        </div>
                      </div>

                      {/* Desktop */}
                      <div className="text-[10px] md:text-xs space-y-1">
                        <div className="flex justify-between text-gray-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Laptop size={10} className="text-slate-400" /> Komputer / Laptop
                          </span>
                          <span>{dskPct}% ({analytics.devices.desktop})</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${dskPct}%` }}></div>
                        </div>
                      </div>

                      {/* Tablet */}
                      <div className="text-[10px] md:text-xs space-y-1">
                        <div className="flex justify-between text-gray-600 font-medium">
                          <span className="flex items-center gap-1">
                            <Tablet size={10} className="text-slate-400" /> Tablet (iPad/Android)
                          </span>
                          <span>{Math.max(0, tabPct)}% ({analytics.devices.tablet})</span>
                        </div>
                        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.max(0, tabPct)}%` }}></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Segmentasi Browser */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-[11px] md:text-xs text-gray-700 flex items-center gap-1">
                <Globe size={12} className="text-gray-500" />
                <span>🌐 Browser Utama Pengakses</span>
              </h4>
              <div className="space-y-2">
                {(() => {
                  const total = analytics.browsers.chrome + analytics.browsers.safari + analytics.browsers.firefox + analytics.browsers.edge + analytics.browsers.other || 1;
                  const chromePct = Math.round((analytics.browsers.chrome / total) * 100);
                  const safariPct = Math.round((analytics.browsers.safari / total) * 100);
                  const firefoxPct = Math.round((analytics.browsers.firefox / total) * 100);
                  const edgePct = Math.round((analytics.browsers.edge / total) * 100);
                  const otherPct = 100 - chromePct - safariPct - firefoxPct - edgePct;

                  const browserList = [
                    { name: 'Google Chrome', pct: chromePct, count: analytics.browsers.chrome, color: 'bg-emerald-500' },
                    { name: 'Safari / iOS Safari', pct: safariPct, count: analytics.browsers.safari, color: 'bg-blue-500' },
                    { name: 'Mozilla Firefox', pct: firefoxPct, count: analytics.browsers.firefox, color: 'bg-orange-500' },
                    { name: 'Microsoft Edge', pct: edgePct, count: analytics.browsers.edge, color: 'bg-indigo-500' },
                    { name: 'Lainnya (In-App)', pct: Math.max(0, otherPct), count: analytics.browsers.other, color: 'bg-slate-400' },
                  ].sort((a, b) => b.pct - a.pct); // sort by highest percentage first for professional look

                  return browserList.map((browser, idx) => (
                    <div key={idx} className="text-[10px] md:text-xs">
                      <div className="flex justify-between text-gray-600 font-medium mb-0.5">
                        <span className="flex items-center gap-1">{browser.name}</span>
                        <span>{browser.pct}% ({browser.count})</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div className={`${browser.color} h-full rounded-full`} style={{ width: `${browser.pct}%` }}></div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagementSection;