import { PreviousFund, WeeklyData, DonorData, ExpenseData, AppData } from '../types';

export const SPREADSHEET_ID = '1xLyxq0mi2ak0IE-0KsQxKg2Zocg2Vi6w8wCC-_Sz8yQ';

const REQUIRED_SHEETS = ['DanaSebelumnya', 'Mingguan', 'Donatur', 'Pengeluaran', 'Meta', 'AdminUsers'];

export const HEADERS_MAP: Record<string, string[]> = {
  DanaSebelumnya: ['id', 'date', 'nominal', 'createdBy', 'editedBy'],
  Mingguan: ['id', 'date', 'week', 'rt', 'grossAmount', 'consumptionCut', 'commissionCut', 'netAmount', 'createdBy', 'editedBy'],
  Donatur: ['id', 'date', 'name', 'nominal', 'createdBy', 'editedBy'],
  Pengeluaran: ['id', 'date', 'purpose', 'nominal', 'createdBy', 'editedBy'],
  Meta: ['key', 'value'],
  AdminUsers: ['email', 'name', 'role', 'password']
};

/**
 * Robust CSV parser that correctly handles comma within double quotes.
 */
function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current);
      result.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    result.push(row);
  }
  return result;
}

/**
 * Safe fetch wrapper with cross-browser timeout fallback.
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout = 3000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Fetch spreadsheet tab values in CSV/JSON format directly and safely without CORS restriction.
 * We use the direct Google Visualization JSON API as the primary channel because it is
 * extremely fast, native to Google, 100% CORS-friendly, and returns instantly (less than 200ms).
 * This prevents any CORS proxy timeout hang and clearly identifies lock status.
 */
export async function fetchSheetCSV(sheetName: string): Promise<string[][]> {
  const cacheKey = `phbi_sheet_cache_${sheetName}`;
  const getCached = (): string[][] => {
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Gagal membaca cache lokal:", e);
    }
    return [HEADERS_MAP[sheetName] || []];
  };

  // 1. Direct query to Google Visualization JSON API (Very fast, native CORS enabled)
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;

  try {
    const response = await fetchWithTimeout(gvizUrl, { timeout: 10000 });
    if (response.ok) {
      const text = await response.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      
      if (match) {
        const jsonObj = JSON.parse(match[1]);
        
        // Check if Spreadsheet access is locked/private
        if (jsonObj.status === 'error') {
          const isPrivate = jsonObj.errors?.some((err: any) => 
            err.reason === 'requester_cannot_access' || 
            err.detailed_message?.includes('sign in') ||
            err.message?.includes('access')
          );
          if (isPrivate) {
            throw new Error("PRIVATE_SPREADSHEET");
          }
          console.warn(`gviz error info for ${sheetName}:`, jsonObj.errors);
        } else if (jsonObj.status === 'ok' && jsonObj.table) {
          const table = jsonObj.table;
          const rows = (table.rows || []).map((row: any) => {
            if (!row || !row.c) return [];
            return row.c.map((cell: any) => {
              if (!cell) return '';
              if (cell.v === null || cell.v === undefined) return '';
              if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
                return cell.f || cell.v;
              }
              return String(cell.v);
            });
          });

          const finalRows = [HEADERS_MAP[sheetName] || [], ...rows];
          // Cache successful response locally
          localStorage.setItem(cacheKey, JSON.stringify(finalRows));
          return finalRows;
        }
      }
    }
  } catch (err: any) {
    if (err?.message === "PRIVATE_SPREADSHEET") {
      throw err; // Bubble up lock status so context can show the modal
    }
    // Silently proceed to direct CSV download fallback
  }

  // 2. Fallback to direct CSV export format
  const directCsvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&t=${Date.now()}`;
  try {
    const response = await fetchWithTimeout(directCsvUrl, { timeout: 12000 });
    if (response.ok) {
      const text = await response.text();
      const trimmed = text.trim();
      if (trimmed.startsWith('<!DOCTYPE html') || trimmed.includes('<html') || trimmed.includes('google.com/accounts') || trimmed.includes('Service Login')) {
        throw new Error("PRIVATE_SPREADSHEET");
      }
      const parsed = parseCSV(text);
      if (parsed && parsed.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (err: any) {
    if (err?.message === "PRIVATE_SPREADSHEET") {
      throw err;
    }
    // Quiet fail
  }

  // 3. Last fallback: return local offline cache
  return getCached();
}

/**
 * Fetch sheet value using Sheets API v4 with secure Access Token
 */
export async function fetchSheetAPI(sheetName: string, accessToken: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?valueRenderOption=UNFORMATTED_VALUE&key=`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil data ${sheetName} dari API.`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Overwrite Sheet with full set of values using Sheets API v4
 */
export async function writeSheetAPI(sheetName: string, values: any[][], accessToken: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Gagal menulis sheet ${sheetName}:`, errText);
    throw new Error(`Gagal menyimpan data ke ${sheetName}. Silakan periksa hak akses.`);
  }
}

/**
 * Clear Sheet values cleanly using Sheets API v4
 */
export async function clearSheetAPI(sheetName: string, accessToken: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}:clear`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Length': '0'
    }
  });

  if (!response.ok) {
    console.error(`Gagal mereset sheet ${sheetName}`);
  }
}

/**
 * Write sheet using Google Apps Script Web App (Bypasses Google OAuth popups and 1-hour token expiration)
 */
export async function writeSheetAppsScript(appsScriptUrl: string, sheetName: string, values: any[][]): Promise<void> {
  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'write',
      sheet: sheetName,
      values
    })
  });

  if (!response.ok) {
    throw new Error(`Apps Script gagal menyimpan data ke ${sheetName}. Status: ${response.status}`);
  }

  const raw = await response.text();
  let result;
  try {
    result = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Respons Google Apps Script tidak valid: ${raw.slice(0, 100)}`);
  }

  if (result && !result.success) {
    throw new Error(result.error || `Apps Script melaporkan kegagalan untuk menulis sheet ${sheetName}`);
  }
}

/**
 * Clear sheet using Google Apps Script Web App
 */
export async function clearSheetAppsScript(appsScriptUrl: string, sheetName: string): Promise<void> {
  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'clear',
      sheet: sheetName
    })
  });

  if (!response.ok) {
    throw new Error(`Apps Script gagal mereset sheet ${sheetName}. Status: ${response.status}`);
  }

  const raw = await response.text();
  let result;
  try {
    result = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Respons Google Apps Script tidak valid: ${raw.slice(0, 100)}`);
  }

  if (result && !result.success) {
    throw new Error(result.error || `Apps Script melaporkan kegagalan untuk mereset sheet ${sheetName}`);
  }
}

/**
 * Test connectivity, CORS, and deployment settings of Google Apps Script Web App
 */
export async function testAppsScriptConnection(appsScriptUrl: string): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    if (!appsScriptUrl || !appsScriptUrl.trim()) {
      return { success: false, message: 'URL Apps Script kosong!' };
    }
    if (!appsScriptUrl.includes('/exec')) {
      return { success: false, message: 'URL tidak mengandung "/exec". Pastikan Anda menuliskan URL Aplikasi Web yang aktif (bukan URL editor /dev).' };
    }

    const res = await fetch(appsScriptUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      return { 
        success: false, 
        message: `Koneksi ditolak oleh server Google. Status HTTP: ${res.status}. Pastikan URL telah disalin dengan lengkap.` 
      };
    }

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      if (text.includes('ServiceLogin') || text.includes('google.com/accounts') || text.includes('login')) {
        return {
          success: false,
          code: 'UNAUTHORIZED_ACCESS',
          message: 'Akses Ditolak / Butuh Login Google. Ini terjadi karena setelan "Siapa saja yang memiliki akses" (Who has access) belum diatur sebagai "Siapa saja" (Anyone) saat "Terapkan baru (Deploy)".Silakan Deploy Ulang.'
        };
      }
      return { 
        success: false, 
        message: `Respons dari server bukan format JSON yang valid. Harap periksa apakah kode Apps Script Anda sudah benar.` 
      };
    }

    if (json && json.success) {
      return { success: true, message: json.message || "Koneksi berhasil terjalin!" };
    } else {
      return { success: false, message: json.error || "Gagal menyambung ke Apps Script." };
    }

  } catch (error: any) {
    console.error("Test Apps Script error:", error);
    return {
      success: false,
      code: 'CORS_OR_NETWORK_ERROR',
      message: 'Gagal melakukan koneksi aman (CORS / Failed to fetch). HAL INI TERJADI KARENA setelan "Who has access" (Siapa yang memiliki akses) diatur ke "Hanya saya" atau "Hanya yang memiliki akun Google" sehingga diblokir browser. Harap lakukan Terapkan Baru (Deploy) dan ganti setelan ke "Siapa saja" (Anyone).'
    };
  }
}

/**
 * Initialize Google Spreadsheet: Auto-create required sheets and write header rows.
 * This guarantees a beautiful self-healing process.
 */
export async function initializeSpreadsheet(accessToken: string): Promise<void> {
  try {
    // 1. Fetch metadata to check existing tabs
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!metaRes.ok) {
      throw new Error("Gagal mengambil metadata Spreadsheet. Harap periksa apakah Anda adalah Editor di Spreadsheet tersebut.");
    }

    const metadata = await metaRes.json();
    const existingTitles: string[] = metadata.sheets?.map((s: any) => s.properties.title) || [];

    // 2. Add missing sheets
    const missing = REQUIRED_SHEETS.filter(s => !existingTitles.includes(s));
    if (missing.length > 0) {
      const requests = missing.map(title => ({
        addSheet: { properties: { title } }
      }));

      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });

      if (!batchRes.ok) {
        throw new Error("Gagal menginisialisasi lembar kerja baru di Spreadsheet.");
      }
    }

    // 3. Populate header rows for empty/new sheets
    for (const title of REQUIRED_SHEETS) {
      const currentValues = await fetchSheetAPI(title, accessToken);
      if (currentValues.length === 0) {
        const headers = HEADERS_MAP[title];
        await writeSheetAPI(title, [headers], accessToken);
      }
    }

    // Initialize Default Admin user if AdminUsers is empty except for headers
    const admins = await fetchSheetAPI('AdminUsers', accessToken);
    if (admins.length <= 1) {
      const defaultAdmin = ['nawasyiahmed@gmail.com', 'ahmed', 'admin', 'ahmed123'];
      await writeSheetAPI('AdminUsers', [HEADERS_MAP.AdminUsers, defaultAdmin], accessToken);
    }

    // Initialize default metadata if missing
    const metaValues = await fetchSheetAPI('Meta', accessToken);
    if (metaValues.length <= 1) {
      await writeSheetAPI('Meta', [HEADERS_MAP.Meta, ['lastUpdated', new Date().toISOString()]], accessToken);
    }

  } catch (error: any) {
    console.error("Inisialisasi Spreadsheet Gagal:", error);
    throw error;
  }
}
