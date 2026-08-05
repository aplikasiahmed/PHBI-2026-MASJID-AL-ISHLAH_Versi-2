import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppData, PreviousFund, WeeklyData, DonorData, ExpenseData } from '../types';
import Swal from 'sweetalert2';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import {
  fetchSheetCSV,
  fetchSheetAPI,
  writeSheetAPI,
  clearSheetAPI,
  writeSheetAppsScript,
  clearSheetAppsScript,
  initializeSpreadsheet,
  SPREADSHEET_ID,
  HEADERS_MAP
} from '../lib/googleSheetsClient';

interface DataContextType {
  publishedData: AppData;
  stagedData: AppData; // Admin working copy
  isLoggedIn: boolean;
  currentUser: string | null;
  accessToken: string | null;
  appsScriptUrl: string | null;
  setAppsScriptUrl: (url: string | null) => void;
  login: (username: string) => void;
  logout: () => void;
  verifyUser: (username: string, password: string) => Promise<boolean>; 
  addAdminUser: (newUsername: string, newPassword: string, masterPass: string) => Promise<boolean>;
  getAdminUsers: () => Promise<any[]>;
  deleteAdminUser: (id: string, masterPass: string) => Promise<boolean>;
  
  // Google Auth Direct
  googleLogin: () => Promise<boolean>;
  
  // CRUD Actions (Effect Staged Data)
  addPreviousFund: (data: Omit<PreviousFund, 'id'>) => void;
  updatePreviousFund: (id: string, data: Partial<PreviousFund>) => void; 
  deletePreviousFund: (id: string) => void;
  
  addWeeklyData: (data: Omit<WeeklyData, 'id'>) => void;
  updateWeeklyData: (id: string, data: Partial<WeeklyData>) => void; 
  deleteWeeklyData: (id: string) => void;
  
  addDonor: (data: Omit<DonorData, 'id'>) => void;
  updateDonor: (id: string, data: Partial<DonorData>) => void; 
  deleteDonor: (id: string) => void;
  
  addExpense: (data: Omit<ExpenseData, 'id'>) => void;
  updateExpense: (id: string, data: Partial<ExpenseData>) => void; 
  deleteExpense: (id: string) => void;
  
  // DIRECT DB ACTIONS (Untuk Edit/Hapus data yang sudah terpublish)
  addPublishedItem: (table: string, item: any) => Promise<boolean>;
  updatePublishedItem: (table: string, id: string, data: any) => Promise<boolean>;
  deletePublishedItem: (table: string, id: string) => Promise<boolean>;

  // System Actions
  publishData: (updateDate: string) => void;
  resetData: (type: 'all' | 'previous' | 'weekly' | 'donor' | 'expense') => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const initialData: AppData = {
  lastUpdated: new Date().toISOString(),
  previousFunds: [],
  weeklyData: [],
  donors: [],
  expenses: [],
};

// --- PASSWORD ADMIN PUSAT (KUNCI UTAMA) ---
const MASTER_ADMIN_PASSWORD = "ALISHLAH2026"; 
const SESSION_KEY = 'phbi_admin_session'; // Key untuk localStorage
const MANUAL_USER_KEY = 'phbi_manual_username'; // Key untuk nama asli login
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 Menit Auto Logout

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [publishedData, setPublishedData] = useState<AppData>(() => {
    try {
      const stored = localStorage.getItem('phbi_published_data');
      return stored ? JSON.parse(stored) : initialData;
    } catch (e) {
      return initialData;
    }
  });

  const [stagedData, setStagedData] = useState<AppData>(() => {
    try {
      const storedStaged = localStorage.getItem('phbi_staged_data');
      return storedStaged ? JSON.parse(storedStaged) : initialData;
    } catch (e) {
      return initialData;
    }
  });
  
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const session = localStorage.getItem(SESSION_KEY);
    return !!session; 
  });

  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    const manualUser = localStorage.getItem(MANUAL_USER_KEY);
    if (manualUser) return manualUser;
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session).username : null;
  });

  // Cached Access Token in-memory
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const googleToken = localStorage.getItem('phbi_google_token');
    if (googleToken) return googleToken;
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session).accessToken || null : null;
  });

  // Apps Script Web App URL state
  const [appsScriptUrl, setAppsScriptUrlState] = useState<string | null>(() => {
    return localStorage.getItem('phbi_apps_script_url') || null;
  });

  const setAppsScriptUrl = (url: string | null) => {
    if (url) {
      localStorage.setItem('phbi_apps_script_url', url.trim());
    } else {
      localStorage.removeItem('phbi_apps_script_url');
    }
    setAppsScriptUrlState(url ? url.trim() : null);
  };

  const fetchSpreadsheetData = async (notifyError = false) => {
    // Cek ketersediaan cache lokal untuk menghindari blocking loading screen di Publik/Home
    const hasCache = publishedData.previousFunds.length > 0 || 
                     publishedData.weeklyData.length > 0 || 
                     publishedData.donors.length > 0 || 
                     publishedData.expenses.length > 0;

    if (!notifyError && !isLoggedIn && !hasCache) {
        Swal.fire({
            title: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
            text: 'Sedang proses ambil data base....',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    try {
      let prevFundsRows: string[][];
      let weeklyRows: string[][];
      let donorsRows: string[][];
      let expensesRows: string[][];
      let metaRows: string[][];

      if (accessToken) {
        try {
          // Fetch real-time live data with API v4
          prevFundsRows = await fetchSheetAPI('DanaSebelumnya', accessToken);
          weeklyRows = await fetchSheetAPI('Mingguan', accessToken);
          donorsRows = await fetchSheetAPI('Donatur', accessToken);
          expensesRows = await fetchSheetAPI('Pengeluaran', accessToken);
          metaRows = await fetchSheetAPI('Meta', accessToken);
        } catch (apiErr: any) {
          console.warn("fetchSheetAPI in loadData failed with token, falling back to fetchSheetCSV:", apiErr);
          // Clear invalid/expired token so that future queries do not keep repeating the error
          localStorage.removeItem('phbi_google_token');
          setAccessToken(null);

          prevFundsRows = await fetchSheetCSV('DanaSebelumnya');
          weeklyRows = await fetchSheetCSV('Mingguan');
          donorsRows = await fetchSheetCSV('Donatur');
          expensesRows = await fetchSheetCSV('Pengeluaran');
          metaRows = await fetchSheetCSV('Meta');
        }
      } else {
        // Fetch via public link CSV (Fast and doesn't require keys)
        prevFundsRows = await fetchSheetCSV('DanaSebelumnya');
        weeklyRows = await fetchSheetCSV('Mingguan');
        donorsRows = await fetchSheetCSV('Donatur');
        expensesRows = await fetchSheetCSV('Pengeluaran');
        metaRows = await fetchSheetCSV('Meta');
      }

      // Map DanaSebelumnya
      const mappedPrev = prevFundsRows.slice(1).map((row: any) => ({
        id: row[0] || '',
        date: row[1] || '',
        nominal: parseFloat(row[2]) || 0,
        createdBy: row[3] || 'Admin',
        editedBy: row[4] || ''
      })).filter(item => item.id && item.id !== 'id');

      // Map Mingguan
      const mappedWeekly = weeklyRows.slice(1).map((row: any) => ({
        id: row[0] || '',
        date: row[1] || '',
        week: row[2] || '',
        rt: row[3] || '',
        grossAmount: parseFloat(row[4]) || 0,
        consumptionCut: parseFloat(row[5]) || 0,
        commissionCut: parseFloat(row[6]) || 0,
        netAmount: parseFloat(row[7]) || 0,
        createdBy: row[8] || 'Admin',
        editedBy: row[9] || ''
      })).filter(item => item.id && item.id !== 'id');

      // Map Donatur
      const mappedDonors = donorsRows.slice(1).map((row: any) => ({
        id: row[0] || '',
        date: row[1] || '',
        name: row[2] || '',
        nominal: parseFloat(row[3]) || 0,
        createdBy: row[4] || 'Admin',
        editedBy: row[5] || ''
      })).filter(item => item.id && item.id !== 'id');

      // Map Pengeluaran
      const mappedExpenses = expensesRows.slice(1).map((row: any) => ({
        id: row[0] || '',
        date: row[1] || '',
        purpose: row[2] || '',
        nominal: parseFloat(row[3]) || 0,
        createdBy: row[4] || 'Admin',
        editedBy: row[5] || ''
      })).filter(item => item.id && item.id !== 'id');

      // Map Meta
      const metaUpdatedRow = metaRows.find(r => r[0] === 'lastUpdated');
      const lastUpdated = metaUpdatedRow ? metaUpdatedRow[1] : new Date().toISOString();

      setPublishedData({
        lastUpdated,
        previousFunds: mappedPrev,
        weeklyData: mappedWeekly,
        donors: mappedDonors,
        expenses: mappedExpenses
      });

      // Bersihkan data draft (stagedData) lokal secara otomatis agar tidak membingungkan pengguna
      setStagedData(initialData);

      // Data draft (stagedData) hanya menyimpan perubahan/inputan baru buatan admin secara lokal sebelum diterbitkan.
      // Dihapus auto-populate yang menyalin seluruh database agar tidak terjadi duplikasi data saat dipublikasikan.

      if (!notifyError) { 
        Swal.close(); 
        
        // Memunculkan popup gambar pengumuman melayang di tengah layar hanya untuk pengguna publik (bukan di dashboard admin)
        if (!isLoggedIn) {
          setTimeout(() => {
            Swal.fire({
              html: `
                <div style="position: relative; display: flex; justify-content: center; align-items: center; max-width: 90vw; max-height: 85vh; margin: 0 auto;">
                  <img 
                    src="https://lh3.googleusercontent.com/d/17_2skb6-G8jzT2Po4lQynG0qtWxi3RfF" 
                    alt="Poster Pengumuman PHBI" 
                    style="max-width: 90vw; max-height: 82vh; width: auto; height: auto; object-fit: contain; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: block;"
                    referrerpolicy="no-referrer"
                  />
                </div>
              `,
              showConfirmButton: false,
              showCloseButton: true,
              background: 'transparent',
              backdrop: 'rgba(0, 0, 0, 0.75)',
              customClass: {
                popup: 'swal-image-popup'
              },
              allowOutsideClick: true
            });
          }, 150);
        }
      }
    } catch (error: any) {
      console.warn("Gagal menyinkronkan data terbaru pencatatan:", error);
      if (error?.message === "PRIVATE_SPREADSHEET") {
          Swal.fire({
            icon: 'error',
            title: 'Setelan Spreadsheet Masih Privat 🔒',
            html: `
              <div class="text-left text-xs space-y-3 leading-relaxed text-gray-700">
                <p class="font-semibold text-red-600">Sistem tidak dapat mengambil data secara otomatis karena dokumen Google Sheets Anda saat ini disetel Privat / Terkunci.</p>
                <div class="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded text-emerald-950 font-sans">
                  <p class="font-bold text-emerald-800 text-sm mb-1">Cara Membuka Akses (Sangat Mudah & Aman):</p>
                  <ol class="list-decimal pl-4 space-y-1.5 mt-1">
                    <li>Buka dokumen Google Spreadsheet Anda.</li>
                    <li>Klik tombol <strong class="bg-emerald-600 text-white px-2 py-0.5 rounded text-xs">Bagikan (Share)</strong> di sudut kanan atas.</li>
                    <li>Ubah <em>"Akses Umum" (General Access)</em> dari <strong>Dibatasi (Restricted)</strong> menjadi <strong class="underline">"Siapa saja yang memiliki link" (Anyone with the link)</strong>.</li>
                    <li>Pastikan peran aksesnya terpilih sebagai <strong class="underline">"Pelihat" (Viewer)</strong>.</li>
                  </ol>
                </div>
                <p class="text-[11px] text-gray-500">Setelah merubah pengaturan tersebut di Google Sheets Anda, silakan klik tombol di bawah untuk menyegarkan halaman & memuat data otomatis secara real-time.</p>
              </div>
            `,
            confirmButtonText: 'Saya Sudah Ubah, Muat Ulang Halaman ✓',
            confirmButtonColor: '#059669',
            allowOutsideClick: false
          }).then(() => {
            window.location.reload();
          });
      } else if ((notifyError || isLoggedIn) && !hasCache) {
          Swal.fire({
            icon: 'warning',
            title: 'Koneksi Spreadsheet Lambat',
            text: 'Terjadi kendala saat Spreadsheet terbaru secara langsung. Tapi tenang, data offline sebelumnya dapat diakses.'
          });
      } else { 
        if (!hasCache) {
          Swal.close(); 
        }
      }
    }
  };

  const login = (username: string) => {
    setIsLoggedIn(true);
    setCurrentUser(username);
    localStorage.setItem(MANUAL_USER_KEY, username);
    
    // Preservasikan accessToken Google agar tidak hilang ketika admin login manual dengan user & pass
    let existingToken = accessToken;
    if (!existingToken) {
      existingToken = localStorage.getItem('phbi_google_token') || null;
    }
    if (!existingToken) {
      const session = localStorage.getItem(SESSION_KEY);
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed.accessToken) existingToken = parsed.accessToken;
        } catch (e) {}
      }
    }
    
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, accessToken: existingToken }));
    if (existingToken) {
      setAccessToken(existingToken);
    }
    setTimeout(() => fetchSpreadsheetData(true), 500);
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setAccessToken(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(MANUAL_USER_KEY);
    signOut(auth);
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  // Google Sign-In Direct Logic - returns token on success, undefined on failure
  const googleLogin = async (): Promise<string | undefined> => {
    Swal.fire({
      title: 'Menghubungkan Akun Google...',
      text: 'Membuka pop-up autentikasi...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (!token) {
        throw new Error("Gagal memperoleh token akses dari Google.");
      }

      setAccessToken(token);

      // Initialize missing sheets automatically
      await initializeSpreadsheet(token);

      // Preserve original username if already logged in manually
      let targetUser = localStorage.getItem(MANUAL_USER_KEY) || currentUser;
      if (!targetUser) {
        targetUser = result.user.displayName || result.user.email || "Admin Google";
      }
      setIsLoggedIn(true);
      setCurrentUser(targetUser);
      
      localStorage.setItem(SESSION_KEY, JSON.stringify({ username: targetUser, accessToken: token }));
      
      Swal.fire({
        icon: 'success',
        title: 'Koneksi Berhasil!',
        text: 'Koneksi ke Google Sheets siap digunakan oleh ' + targetUser,
        showConfirmButton: false,
        timer: 1500
      });

      await fetchSpreadsheetData(true);
      return token;
    } catch (err: any) {
      console.error("Gagal Login Google:", err);
      
      // Handle Popup Blocked specifically
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked') || err.message?.includes('popup')) {
        const choice = await Swal.fire({
          icon: 'warning',
          title: 'Pop-up Google Diblokir',
          html: `
            <div class="text-left text-xs space-y-2 leading-relaxed">
              <p>Browser atau panel iframe memblokir pop-up Google Login Anda.</p>
              <p class="font-bold text-emerald-700">Solusi Terbaik:</p>
              <ul class="list-disc pl-4 space-y-1">
                <li>Klik tombol <strong>Masuk dengan Redirect</strong> di bawah, ATAU</li>
                <li>Klik ikon <strong>Buka di Tab Baru</strong> pada pojok kanan atas browser untuk membuka versi penuh aplikasi tanpa pembatasan iframe.</li>
              </ul>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Masuk dengan Redirect',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#059669',
          cancelButtonColor: '#d33'
        });

        if (choice.isConfirmed) {
          Swal.fire({
            title: 'Mengalihkan Halaman...',
            text: 'Membuka Google Login secara langsung. Mohon tunggu...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
          });
          try {
            await signInWithRedirect(auth, googleProvider);
          } catch (redirectErr: any) {
            console.error("Gagal signInWithRedirect:", redirectErr);
            Swal.fire('Redirect Gagal', redirectErr.message || 'Silakan coba buka aplikasi di tab baru.', 'error');
          }
        }
        return undefined;
      }

      let errorMsg = err.message || "Pastikan Anda memilih akun Google yang sah.";
      if (err.message?.includes('403') || err.message?.includes('permission')) {
        errorMsg = "Anda tidak memiliki hak terhubung ke server. Mohon periksa kembali!.";
      }
      Swal.fire({
        icon: 'error',
        title: 'Gagal Terhubung Ke Server',
        text: errorMsg
      });
      return undefined;
    }
  };

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken;
          if (token) {
            Swal.fire({
              title: 'Menyinkronkan Akun...',
              text: 'Menginisialisasi setelan Google Sheets...',
              allowOutsideClick: false,
              didOpen: () => { Swal.showLoading(); }
            });

            try {
              setAccessToken(token);
              await initializeSpreadsheet(token);

              // Preserve manual login if it exists
              let targetUser = localStorage.getItem(MANUAL_USER_KEY) || currentUser;
              if (!targetUser) {
                const session = localStorage.getItem(SESSION_KEY);
                if (session) {
                  try {
                    const parsed = JSON.parse(session);
                    if (parsed.username) targetUser = parsed.username;
                  } catch (e) {}
                }
              }
              if (!targetUser) {
                targetUser = result.user.displayName || result.user.email || "Admin Google";
              }

              setIsLoggedIn(true);
              setCurrentUser(targetUser);
              localStorage.setItem(SESSION_KEY, JSON.stringify({ username: targetUser, accessToken: token }));

              Swal.fire({
                icon: 'success',
                title: 'Koneksi Berhasil!',
                text: `Koneksi ke Google Sheets siap digunakan oleh ${targetUser}.`,
                timer: 2000,
                showConfirmButton: false
              });

              fetchSpreadsheetData(true);
            } catch (err: any) {
              console.error("Gagal inisialisasi setelah redirect:", err);
              Swal.fire('Error Sinkronisasi', err.message || 'Gagal memuat spreadsheet setelah redirect.', 'error');
            }
          }
        }
      })
      .catch((err) => {
        console.error("Gagal mendapatkan hasil redirect auth:", err);
      });
  }, []);

  useEffect(() => {
    // 1. Ambil data awal dari spreadsheet (akan berjalan di background krn ada cache)
    fetchSpreadsheetData(false);

    // 2. Memulihkan draf jika ada di lokal penyimpanan
    const storedStaged = localStorage.getItem('phbi_staged_data');
    if (storedStaged) {
      try {
        setStagedData(JSON.parse(storedStaged));
      } catch (e) {}
    }

    // 3. Sinkronkan status autentikasi google
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) {
          try {
            const parsed = JSON.parse(session);
            if (parsed.accessToken) {
              setAccessToken(parsed.accessToken);
            }
          } catch (e) {}
        }
      }
    });

    return () => unsubscribe();
  }, []); // Run ONCE on mount to avoid infinite loop triggers!

  useEffect(() => {
    localStorage.setItem('phbi_staged_data', JSON.stringify(stagedData));
  }, [stagedData]);

  useEffect(() => {
    localStorage.setItem('phbi_published_data', JSON.stringify(publishedData));
  }, [publishedData]);

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('phbi_google_token', accessToken);
    }
  }, [accessToken]);

  // AUTO-LOGOUT ON IDLE
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const handleIdleLogout = () => {
      if (isLoggedIn) {
        logout();
        Swal.fire({ 
          icon: 'warning', 
          title: 'Sesi Berakhir', 
          text: 'Anda telah keluar otomatis untuk keamanan data.', 
          timer: 2500, 
          timerProgressBar: true, 
          showConfirmButton: false,
          allowOutsideClick: false 
        });
      }
    };

    const resetTimer = () => {
      if (!isLoggedIn) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(handleIdleLogout, IDLE_TIMEOUT_MS);
    };

    if (isLoggedIn) {
      resetTimer();

      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown', 'wheel'];
      events.forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
      });

      return () => {
        if (idleTimer) clearTimeout(idleTimer);
        events.forEach(event => {
          document.removeEventListener(event, resetTimer);
        });
      };
    }
  }, [isLoggedIn]);

  // Custom User/Pass verify against Sheet AdminUsers values
  const verifyUser = async (u: string, p: string): Promise<boolean> => {
    try {
        const rows = await fetchSheetCSV('AdminUsers');
        if (rows.length <= 1) {
            // fallback default admin if sheet is empty of users
            return (u === 'admin' || u === 'nawasyiahmed@gmail.com' || u === 'ahmed') && p === 'ahmed123';
        }
        
        // rows format: header, col0: email, col1: name, col2: role, col3: password
        const matched = rows.slice(1).find(r => 
          (r[0]?.trim().toLowerCase() === u.trim().toLowerCase() || r[1]?.trim().toLowerCase() === u.trim().toLowerCase()) && 
          r[3]?.trim() === p.trim()
        );
        return !!matched;
    } catch (err) {
        console.error("Gagal memverifikasi user:", err);
        return (u === 'admin' || u === 'nawasyiahmed@gmail.com' || u === 'ahmed') && p === 'ahmed123';
    }
  };

  const getAdminUsers = async (): Promise<any[]> => {
    try {
      let rows: string[][];
      if (accessToken) {
        try {
          rows = await fetchSheetAPI('AdminUsers', accessToken);
        } catch (apiErr) {
          console.warn("fetchSheetAPI for AdminUsers failed. Falling back to fetchSheetCSV:", apiErr);
          rows = await fetchSheetCSV('AdminUsers');
        }
      } else {
        rows = await fetchSheetCSV('AdminUsers');
      }
      
      if (rows.length <= 1) return [];
      return rows.slice(1).map(row => ({
        id: row[0] || '', // email as unique identifier
        username: row[1] || row[0] || 'Admin', // name/username
        password: row[3] || '', // password
        role: row[2] || '', // role
        created_at: new Date().toISOString()
      }));
    } catch (err) {
      console.error("Gagal mendapatkan daftar admin:", err);
      // Fail gracefully and try reading CSV as last resort if not tried
      try {
        const rows = await fetchSheetCSV('AdminUsers');
        if (rows.length > 1) {
          return rows.slice(1).map(row => ({
            id: row[0] || '',
            username: row[1] || row[0] || 'Admin',
            password: row[3] || '',
            role: row[2] || '',
            created_at: new Date().toISOString()
          }));
        }
      } catch (innerErr) {
        console.error("Fallback fetchSheetCSV also failed:", innerErr);
      }
      return [];
    }
  };

  const ensureGoogleConnected = async (actionDesc: string): Promise<string | undefined> => {
    if (appsScriptUrl) return 'BYPASS_OAUTH';
    if (accessToken) return accessToken;
    
    const result = await Swal.fire({
      icon: 'info',
      title: 'Anda Belum terhubung ke server',
      html: `
        <div class="text-center text-xs space-y-2 leading-relaxed">
          <p>Data yang anda input belum tersimpan ke server untuk <strong>${actionDesc}</strong>.</p>
          <p class="font-semibold text-red-400">✓ Hubungi pemilik server.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'SAMBUNGKAN SERVER',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#d33'
    });
    
    if (result.isConfirmed) {
      return await googleLogin();
    }
    return undefined;
  };

  const addAdminUser = async (newUsername: string, newPassword: string, masterPass: string): Promise<boolean> => {
      if (masterPass !== MASTER_ADMIN_PASSWORD) {
          Swal.fire('Kode ID Server Gagal', 'Kode ID Server tidak valid!', 'error');
          return false;
      }
      const tokenToUse = accessToken || (await ensureGoogleConnected("Menambah Admin Baru"));
      if (!tokenToUse) return false;

      try {
          const currentAdmins = await getAdminUsers();
          const email = newUsername.includes('@') ? newUsername : `${newUsername}@gmail.com`;
          const name = newUsername.split('@')[0];
          
          const existing = currentAdmins.find(admin => admin.id === email || admin.username === name);
          if (existing) { 
            Swal.fire('Gagal', 'Username/Email tersebut sudah digunakan.', 'warning'); 
            return false; 
          }
 
          let rawRows: string[][];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              rawRows = await fetchSheetCSV('AdminUsers');
          } else {
              rawRows = await fetchSheetAPI('AdminUsers', tokenToUse);
          }

          const newRow = [
            email,
            name,
            'editor', // default role
            newPassword
          ];
          
          const finalRows = [...rawRows, newRow];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await writeSheetAppsScript(appsScriptUrl, 'AdminUsers', finalRows);
          } else {
              await writeSheetAPI('AdminUsers', finalRows, tokenToUse);
          }
          return true;
      } catch (error: any) { 
        Swal.fire('Error', error.message, 'error'); 
        return false; 
      }
  };

  const deleteAdminUser = async (id: string, masterPass: string): Promise<boolean> => {
      if (masterPass !== MASTER_ADMIN_PASSWORD) {
          Swal.fire('Kode ID Server Gagal', 'Kode ID Server tidak valid!', 'error');
          return false;
      }
      const tokenToUse = accessToken || (await ensureGoogleConnected("Menghapus Admin"));
      if (!tokenToUse) return false;

      try {
          let rawRows: string[][];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              rawRows = await fetchSheetCSV('AdminUsers');
          } else {
              rawRows = await fetchSheetAPI('AdminUsers', tokenToUse);
          }

          const headers = rawRows[0] || HEADERS_MAP.AdminUsers;
          const filtered = rawRows.slice(1).filter(r => r[0] !== id);
          const finalRows = [headers, ...filtered];

          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await clearSheetAppsScript(appsScriptUrl, 'AdminUsers');
              await writeSheetAppsScript(appsScriptUrl, 'AdminUsers', finalRows);
          } else {
              await clearSheetAPI('AdminUsers', tokenToUse);
              await writeSheetAPI('AdminUsers', finalRows, tokenToUse);
          }
          return true;
      } catch (error: any) { 
        Swal.fire('Error', error.message, 'error'); 
        return false; 
      }
  };

  // --- LOCAL STAGED DATA CRUD ---
  const addPreviousFund = (item: Omit<PreviousFund, 'id'>) => {
    const newItem = { 
        ...item, 
        id: crypto.randomUUID(),
        createdBy: currentUser || 'Admin', 
        editedBy: undefined
    };
    setStagedData(prev => ({ ...prev, previousFunds: [...prev.previousFunds, newItem] }));
  };
  
  const updatePreviousFund = (id: string, data: Partial<PreviousFund>) => {
    setStagedData(prev => ({
        ...prev,
        previousFunds: prev.previousFunds.map(item => 
          item.id === id ? { ...item, ...data, editedBy: currentUser || 'Admin' } : item
        )
    }));
  };
  
  const deletePreviousFund = (id: string) => {
    setStagedData(prev => ({ ...prev, previousFunds: prev.previousFunds.filter(i => i.id !== id) }));
  };

  const addWeeklyData = (item: Omit<WeeklyData, 'id'>) => {
    const newItem = { 
        ...item, 
        id: crypto.randomUUID(),
        createdBy: currentUser || 'Admin',
        editedBy: undefined
    };
    setStagedData(prev => ({ ...prev, weeklyData: [...prev.weeklyData, newItem] }));
  };
  
  const updateWeeklyData = (id: string, data: Partial<WeeklyData>) => {
    setStagedData(prev => ({
        ...prev,
        weeklyData: prev.weeklyData.map(item => 
          item.id === id ? { ...item, ...data, editedBy: currentUser || 'Admin' } : item
        )
    }));
  };
  
  const deleteWeeklyData = (id: string) => {
    setStagedData(prev => ({ ...prev, weeklyData: prev.weeklyData.filter(i => i.id !== id) }));
  };

  const addDonor = (item: Omit<DonorData, 'id'>) => {
    const newItem = { 
        ...item, 
        id: crypto.randomUUID(),
        createdBy: currentUser || 'Admin',
        editedBy: null as any
    };
    setStagedData(prev => ({ ...prev, donors: [...prev.donors, newItem] }));
  };
  
  const updateDonor = (id: string, data: Partial<DonorData>) => {
    setStagedData(prev => ({
        ...prev,
        donors: prev.donors.map(item => 
          item.id === id ? { ...item, ...data, editedBy: currentUser || 'Admin' } : item
        )
    }));
  };
  
  const deleteDonor = (id: string) => {
    setStagedData(prev => ({ ...prev, donors: prev.donors.filter(i => i.id !== id) }));
  };

  const addExpense = (item: Omit<ExpenseData, 'id'>) => {
    const newItem = { 
        ...item, 
        id: crypto.randomUUID(),
        createdBy: currentUser || 'Admin',
        editedBy: null as any
    };
    setStagedData(prev => ({ ...prev, expenses: [...prev.expenses, newItem] }));
  };
  
  const updateExpense = (id: string, data: Partial<ExpenseData>) => {
    setStagedData(prev => ({
        ...prev,
        expenses: prev.expenses.map(item => 
          item.id === id ? { ...item, ...data, editedBy: currentUser || 'Admin' } : item
        )
    }));
  };
  
  const deleteExpense = (id: string) => {
    setStagedData(prev => ({ ...prev, expenses: prev.expenses.filter(i => i.id !== id) }));
  };

  // --- PUBLISHED ITEM LIVE DIRECT MUTATE ---
  const addPublishedItem = async (table: string, item: any): Promise<boolean> => {
      const tokenToUse = accessToken || (await ensureGoogleConnected("Menambah Laporan"));
      if (!tokenToUse) return false;

      Swal.fire({
        title: 'Menyimpan Data...',
        text: 'Mengirim laporan. Mohon Tunggu...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      try {
          const sheetMap: Record<string, string> = {
            'DanaSebelumnya_data': 'DanaSebelumnya',
            'Mingguan_data': 'Mingguan',
            'Donatur_data': 'Donatur',
            'Pengeluaran_data': 'Pengeluaran'
          };
          const sheetName = sheetMap[table] || table;
          
          let rows: string[][] = [];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              try {
                rows = await fetchSheetCSV(sheetName);
              } catch (e) {
                throw new Error("Gagal mengambil data sebelum menulis. Pastikan spreadsheet diatur 'Siapa saja yang memiliki link dapat melihat' atau gunakan akun Google.");
              }
          } else {
              rows = await fetchSheetAPI(sheetName, tokenToUse);
          }
          
          const headers = rows.length > 0 ? rows[0] : HEADERS_MAP[sheetName];
          const body = rows.length > 0 ? rows.slice(1) : [];
          
          let newRow: any[] = [];
          const id = crypto.randomUUID();
          
          if (sheetName === 'DanaSebelumnya') {
            newRow = [id, item.date, item.nominal.toString(), currentUser || 'Admin', ''];
          } else if (sheetName === 'Mingguan') {
            newRow = [id, item.date, item.week, item.rt, item.grossAmount.toString(), item.consumptionCut.toString(), item.commissionCut.toString(), item.netAmount.toString(), currentUser || 'Admin', ''];
          } else if (sheetName === 'Donatur') {
            newRow = [id, item.date, item.name, item.nominal.toString(), currentUser || 'Admin', ''];
          } else if (sheetName === 'Pengeluaran') {
             newRow = [id, item.date, item.purpose, item.nominal.toString(), currentUser || 'Admin', ''];
          }
          
          const finalData = [headers, ...body, newRow];
          
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await writeSheetAppsScript(appsScriptUrl, sheetName, finalData);
          } else {
              await writeSheetAPI(sheetName, finalData, tokenToUse);
          }
          
          await fetchSpreadsheetData(true);
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data disimpan langsung ke Google-Sheets', showConfirmButton: false, timer: 1500 });
          return true;
      } catch (error: any) {
          console.error("Gagal menambah data:", error);
          Swal.fire('Gagal Menambah Data', error?.message || 'Terjadi gangguan saat menyimpan ke spreadsheet.', 'error');
          return false;
      }
  };

  const updatePublishedItem = async (table: string, id: string, data: any): Promise<boolean> => {
      const tokenToUse = accessToken || (await ensureGoogleConnected("Mengubah Laporan Terbit"));
      if (!tokenToUse) return false;
      
      try {
          const sheetMap: Record<string, string> = {
            'DanaSebelumnya_data': 'DanaSebelumnya',
            'Mingguan_data': 'Mingguan',
            'Donatur_data': 'Donatur',
            'Pengeluaran_data': 'Pengeluaran'
          };
          const sheetName = sheetMap[table] || table;
          
          let rows: string[][] = [];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              try {
                rows = await fetchSheetCSV(sheetName);
              } catch (e) {
                throw new Error("Gagal mengambil data sebelum menulis. Pastikan spreadsheet diatur 'Siapa saja yang memiliki link dapat melihat' atau gunakan akun Google.");
              }
          } else {
              rows = await fetchSheetAPI(sheetName, tokenToUse);
          }

          if (rows.length <= 1) return false;
          
          const rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === id);
          if (rowIndex === -1) {
            Swal.fire('Gagal', 'Item tidak ditemukan di Spreadsheet.', 'error');
            return false;
          }
          
          // Map properties safely based on columns
          if (sheetName === 'DanaSebelumnya') {
            rows[rowIndex] = [
              id,
              data.date !== undefined ? data.date : rows[rowIndex][1],
              data.nominal !== undefined ? data.nominal.toString() : rows[rowIndex][2],
              rows[rowIndex][3] || 'Admin',
              currentUser || 'Admin'
            ];
          } else if (sheetName === 'Mingguan') {
            rows[rowIndex] = [
              id,
              data.date !== undefined ? data.date : rows[rowIndex][1],
              data.week !== undefined ? data.week : rows[rowIndex][2],
              data.rt !== undefined ? data.rt : rows[rowIndex][3],
              data.grossAmount !== undefined ? data.grossAmount.toString() : rows[rowIndex][4],
              data.consumptionCut !== undefined ? data.consumptionCut.toString() : rows[rowIndex][5],
              data.commissionCut !== undefined ? data.commissionCut.toString() : rows[rowIndex][6],
              data.netAmount !== undefined ? data.netAmount.toString() : rows[rowIndex][7],
              rows[rowIndex][8] || 'Admin',
              currentUser || 'Admin'
            ];
          } else if (sheetName === 'Donatur') {
            rows[rowIndex] = [
              id,
              data.date !== undefined ? data.date : rows[rowIndex][1],
              data.name !== undefined ? data.name : rows[rowIndex][2],
              data.nominal !== undefined ? data.nominal.toString() : rows[rowIndex][3],
              rows[rowIndex][4] || 'Admin',
              currentUser || 'Admin'
            ];
          } else if (sheetName === 'Pengeluaran') {
            rows[rowIndex] = [
              id,
              data.date !== undefined ? data.date : rows[rowIndex][1],
              data.purpose !== undefined ? data.purpose : rows[rowIndex][2],
              data.nominal !== undefined ? data.nominal.toString() : rows[rowIndex][3],
              rows[rowIndex][4] || 'Admin',
              currentUser || 'Admin'
            ];
          }
          
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await writeSheetAppsScript(appsScriptUrl, sheetName, rows);
          } else {
              await writeSheetAPI(sheetName, rows, tokenToUse);
          }

          await fetchSpreadsheetData(true);
          return true;
      } catch (error: any) {
          console.error("Gagal memperbarui item:", error);
          Swal.fire('Gagal Update', error?.message || 'Terjadi gangguan saat menyimpan....', 'error');
          return false;
      }
  };

  const deletePublishedItem = async (table: string, id: string): Promise<boolean> => {
      const tokenToUse = accessToken || (await ensureGoogleConnected("Menghapus Laporan Terbit"));
      if (!tokenToUse) return false;

      try {
          const sheetMap: Record<string, string> = {
            'DanaSebelumnya_data': 'DanaSebelumnya',
            'Mingguan_data': 'Mingguan',
            'Donatur_data': 'Donatur',
            'Pengeluaran_data': 'Pengeluaran'
          };
          const sheetName = sheetMap[table] || table;
          
          let rows: string[][] = [];
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              try {
                rows = await fetchSheetCSV(sheetName);
              } catch (e) {
                throw new Error("Gagal mengambil data sebelum menulis. Pastikan spreadsheet diatur 'Siapa saja yang memiliki link dapat melihat'.");
              }
          } else {
              rows = await fetchSheetAPI(sheetName, tokenToUse);
          }

          if (rows.length <= 1) return false;
          
          const headers = rows[0];
          const filtered = rows.slice(1).filter(r => r[0] !== id);
          
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await writeSheetAppsScript(appsScriptUrl, sheetName, [headers, ...filtered]);
          } else {
              await clearSheetAPI(sheetName, tokenToUse);
              await writeSheetAPI(sheetName, [headers, ...filtered], tokenToUse);
          }

          await fetchSpreadsheetData(true);
          return true;
      } catch (error: any) {
          console.error("Gagal menghapus item:", error);
          Swal.fire('Gagal Hapus', error?.message || 'Terjadi gangguan koneksi.', 'error');
          return false;
      }
  };

  // --- PUBLISH DRAFT TO GOOGLE SHEETS ---
  const publishData = async (updateDate: string) => {
    const tokenToUse = accessToken || (await ensureGoogleConnected("Memublikasikan Laporan Keuangan"));
    if (!tokenToUse) return;

    Swal.fire({
      title: 'Memproses Data...',
      text: 'Mohon tunggu ....',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const writeFn = async (sheetName: string, finalData: any[][]) => {
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              await writeSheetAppsScript(appsScriptUrl, sheetName, finalData);
          } else {
              await writeSheetAPI(sheetName, finalData, tokenToUse);
          }
      };

      const fetchFn = async (sheetName: string) => {
          if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
              return await fetchSheetCSV(sheetName);
          } else {
              return await fetchSheetAPI(sheetName, tokenToUse);
          }
      };

      // 1. DanaSebelumnya
      if (stagedData.previousFunds.length > 0) {
        const current = await fetchFn('DanaSebelumnya');
        const headers = current.length > 0 ? current[0] : HEADERS_MAP.DanaSebelumnya;
        const body = current.length > 0 ? current.slice(1) : [];
        const newRows = stagedData.previousFunds.map(item => [
          item.id,
          item.date,
          item.nominal.toString(),
          item.createdBy || currentUser || 'Admin',
          item.editedBy || ''
        ]);
        await writeFn('DanaSebelumnya', [headers, ...body, ...newRows]);
      }

      // 2. Mingguan
      if (stagedData.weeklyData.length > 0) {
        const current = await fetchFn('Mingguan');
        const headers = current.length > 0 ? current[0] : HEADERS_MAP.Mingguan;
        const body = current.length > 0 ? current.slice(1) : [];
        const newRows = stagedData.weeklyData.map(item => [
          item.id,
          item.date,
          item.week,
          item.rt,
          item.grossAmount.toString(),
          item.consumptionCut.toString(),
          item.commissionCut.toString(),
          item.netAmount.toString(),
          item.createdBy || currentUser || 'Admin',
          item.editedBy || ''
        ]);
        await writeFn('Mingguan', [headers, ...body, ...newRows]);
      }

      // 3. Donatur
      if (stagedData.donors.length > 0) {
        const current = await fetchFn('Donatur');
        const headers = current.length > 0 ? current[0] : HEADERS_MAP.Donatur;
        const body = current.length > 0 ? current.slice(1) : [];
        const newRows = stagedData.donors.map(item => [
          item.id,
          item.date,
          item.name,
          item.nominal.toString(),
          item.createdBy || currentUser || 'Admin',
          item.editedBy || ''
        ]);
        await writeFn('Donatur', [headers, ...body, ...newRows]);
      }

      // 4. Pengeluaran
      if (stagedData.expenses.length > 0) {
        const current = await fetchFn('Pengeluaran');
        const headers = current.length > 0 ? current[0] : HEADERS_MAP.Pengeluaran;
        const body = current.length > 0 ? current.slice(1) : [];
        const newRows = stagedData.expenses.map(item => [
          item.id,
          item.date,
          item.purpose,
          item.nominal.toString(),
          item.createdBy || currentUser || 'Admin',
          item.editedBy || ''
        ]);
        await writeFn('Pengeluaran', [headers, ...body, ...newRows]);
      }

      // 5. Update Meta Update Date
      await writeFn('Meta', [HEADERS_MAP.Meta, ['lastUpdated', updateDate]]);

      setStagedData(initialData);
      await fetchSpreadsheetData(true);
      Swal.fire({
        icon: 'success',
        title: 'Publikasi Berhasil',
        text: 'Laporan keuangan telah diperbarui dan disinkronasi.',
        confirmButtonColor: '#047857'
      });
    } catch (error: any) {
      console.error("Gagal melakukan publikasi laporan:", error);
      Swal.fire('Gagal Publikasi', error?.message || 'Koneksi server bermasalah.', 'error');
    }
  };

  // --- RESET TABLES ---
  const resetData = async (type: 'all' | 'previous' | 'weekly' | 'donor' | 'expense') => {
    const tokenToUse = accessToken || (await ensureGoogleConnected("Mereset Data Spreadsheet"));
    if (!tokenToUse) return;

    if (type === 'all') { 
      setStagedData(initialData); 
    } else {
      const keyMap: Record<string, keyof AppData> = { 
        'previous': 'previousFunds', 
        'weekly': 'weeklyData', 
        'donor': 'donors', 
        'expense': 'expenses' 
      };
      const key = keyMap[type];
      setStagedData(prev => ({ ...prev, [key]: [] }));
    }

    Swal.fire({
      title: 'Mereset Data server...',
      text: 'Mohon tunggu sebentar',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
        if (type === 'all') {
            if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
                await clearSheetAppsScript(appsScriptUrl, 'DanaSebelumnya');
                await writeSheetAppsScript(appsScriptUrl, 'DanaSebelumnya', [HEADERS_MAP.DanaSebelumnya]);
                
                await clearSheetAppsScript(appsScriptUrl, 'Mingguan');
                await writeSheetAppsScript(appsScriptUrl, 'Mingguan', [HEADERS_MAP.Mingguan]);

                await clearSheetAppsScript(appsScriptUrl, 'Donatur');
                await writeSheetAppsScript(appsScriptUrl, 'Donatur', [HEADERS_MAP.Donatur]);

                await clearSheetAppsScript(appsScriptUrl, 'Pengeluaran');
                await writeSheetAppsScript(appsScriptUrl, 'Pengeluaran', [HEADERS_MAP.Pengeluaran]);
            } else {
                await clearSheetAPI('DanaSebelumnya', tokenToUse);
                await writeSheetAPI('DanaSebelumnya', [HEADERS_MAP.DanaSebelumnya], tokenToUse);
                
                await clearSheetAPI('Mingguan', tokenToUse);
                await writeSheetAPI('Mingguan', [HEADERS_MAP.Mingguan], tokenToUse);

                await clearSheetAPI('Donatur', tokenToUse);
                await writeSheetAPI('Donatur', [HEADERS_MAP.Donatur], tokenToUse);

                await clearSheetAPI('Pengeluaran', tokenToUse);
                await writeSheetAPI('Pengeluaran', [HEADERS_MAP.Pengeluaran], tokenToUse);
            }
        } else {
            const tableMap: Record<string, string> = { 
              'previous': 'DanaSebelumnya', 
              'weekly': 'Mingguan', 
              'donor': 'Donatur', 
              'expense': 'Pengeluaran' 
            };
            const tabName = tableMap[type];
            if (tabName) {
                if (tokenToUse === 'BYPASS_OAUTH' && appsScriptUrl) {
                    await clearSheetAppsScript(appsScriptUrl, tabName);
                    await writeSheetAppsScript(appsScriptUrl, tabName, [HEADERS_MAP[tabName]]);
                } else {
                    await clearSheetAPI(tabName, tokenToUse);
                    await writeSheetAPI(tabName, [HEADERS_MAP[tabName]], tokenToUse);
                }
            }
        }

        await fetchSpreadsheetData(true); 
        Swal.fire('Berhasil', 'Data berhasil dirubah.', 'success');
    } catch (error: any) { 
      console.error("Gagal melakukan perubahan:", error);
      Swal.fire('Error', 'Gagal mereset: ' + (error?.message || 'Error'), 'error'); 
    }
  };

  return (
    <DataContext.Provider value={{
      publishedData, stagedData, isLoggedIn, currentUser, accessToken, appsScriptUrl, setAppsScriptUrl, login, logout, verifyUser, addAdminUser, getAdminUsers, deleteAdminUser,
      googleLogin,
      addPreviousFund, updatePreviousFund, deletePreviousFund, addWeeklyData, updateWeeklyData, deleteWeeklyData,
      addDonor, updateDonor, deleteDonor, addExpense, updateExpense, deleteExpense,
      addPublishedItem, updatePublishedItem, deletePublishedItem, publishData, resetData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) { throw new Error('useData must be used within a DataProvider'); }
  return context;
};
