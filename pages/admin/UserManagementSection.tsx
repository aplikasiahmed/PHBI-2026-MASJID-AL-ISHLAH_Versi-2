import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import Swal from 'sweetalert2';
import { UserPlus, ShieldAlert, Users, Trash2, Lock, Unlock } from 'lucide-react';
import { SPREADSHEET_ID, testAppsScriptConnection } from '../../lib/googleSheetsClient';

const UserManagementSection: React.FC = () => {
  const { addAdminUser, getAdminUsers, deleteAdminUser, appsScriptUrl, setAppsScriptUrl } = useData();
  const [users, setUsers] = useState<any[]>([]);
  const [scriptUrlInput, setScriptUrlInput] = useState(appsScriptUrl || '');
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockKey, setUnlockKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
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
          title: 'Hapus Admin?',
          text: `Hapus user: ${username}`,
          input: 'password',
          inputPlaceholder: 'Masukkan Kode ID Server',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          confirmButtonText: 'Hapus',
          cancelButtonText: 'Batal',
          customClass: {
            title: 'text-lg',
            input: 'text-sm'
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
                     🔗 Google Apps Script Integration (Terkunci)
                </h3>
            </div>
            <p className="text-[10px] md:text-sm text-gray-600 mb-4 leading-relaxed">
                Kartu konfigurasi ini dilindungi oleh otorisasi keamanan sistem. Hanya <strong>Admin Utama / Pemilik Spreadsheet</strong> yang memiliki Kode Keamanan Server yang dapat membuka, melihat instruksi, serta merubah integrasi Google Sheets ini.
            </p>
            <div className="bg-white border border-amber-200 p-3 rounded-lg max-w-md">
                <label className="block text-[10px] md:text-xs font-bold text-amber-700 mb-1.5">
                     Masukkan Kode Keamanan Server
                </label>
                <div className="flex gap-2">
                    <input 
                      type="password"
                      value={unlockKey}
                      onChange={e => setUnlockKey(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                      className={`${inputClass} border-amber-200 focus:ring-amber-500`}
                      placeholder="Masukkan Token ID Server..."
                    />
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
                     🔗 Google Apps Script Integration (Multi-Device Bypass)
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
                        *Belum terhubung. Silakan masukkan URL jika ingin menggunakan mode bypass tanpa Otorisasi Google.
                    </div>
                )}
            </div>
        </div>
      )}

    </div>
  );
};

export default UserManagementSection;