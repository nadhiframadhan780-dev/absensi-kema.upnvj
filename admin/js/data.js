/**
 * Data Resmi Fakultas, Program Studi, & Konfigurasi UPNVJ
 * Universitas Pembangunan Nasional "Veteran" Jakarta
 */

export const FAKULTAS_DATA = {
  feb: {
    id: "feb",
    kode: "FEB",
    nama: "Fakultas Ekonomi dan Bisnis",
    ikon: "briefcase",
    warna: "#2563eb",
    dekan: {
      nama: "Dr. Jubaedah, S.E., M.M.",
      nip: "196803201994032001"
    },
    prodi: [
      { id: "d3-perbankan", nama: "D3 Perbankan dan Keuangan", jenjang: "D3" },
      { id: "d3-akuntansi", nama: "D3 Akuntansi", jenjang: "D3" },
      { id: "s1-manajemen", nama: "S1 Manajemen", jenjang: "S1" },
      { id: "s1-akuntansi", nama: "S1 Akuntansi", jenjang: "S1" },
      { id: "s1-ekonomi-pembangunan", nama: "S1 Ekonomi Pembangunan", jenjang: "S1" },
      { id: "s1-ekonomi-syariah", nama: "S1 Ekonomi Syariah", jenjang: "S1" },
      { id: "s2-manajemen", nama: "S2 Manajemen", jenjang: "S2" },
      { id: "s2-akuntansi", nama: "S2 Akuntansi", jenjang: "S2" }
    ]
  },
  fk: {
    id: "fk",
    kode: "FK",
    nama: "Fakultas Kedokteran",
    ikon: "stethoscope",
    warna: "#0284c7",
    catatanKhusus: 'Perlu diperhatikan bahwa "Profesi Dokter" dan "Profesi Apoteker" merupakan program profesi yang harus ditempuh setelah menyelesaikan gelar sarjana terkait, bukan program gelar sarjana mandiri. Selain itu, fakultas kedokteran di universitas ini juga memiliki program studi lain di bidang kesehatan seperti Keperawatan dan Gizi, tetapi program-program tersebut tidak tercantum dalam daftar 7 program studi yang diperkenalkan secara resmi oleh Fakultas Kedokteran.',
    dekan: {
      nama: "Dr. dr. H. Taufiq Fredrik Pasiak, M.Kes., M.Pd.I.",
      nip: "196802281997021001"
    },
    prodi: [
      { id: "s1-kedokteran", nama: "S1 Kedokteran", jenjang: "S1" },
      { id: "profesi-dokter", nama: "Profesi Dokter", jenjang: "Profesi" },
      { id: "s1-farmasi", nama: "S1 Farmasi", jenjang: "S1" },
      { id: "profesi-apoteker", nama: "Profesi Apoteker", jenjang: "Profesi" },
      { id: "s1-biologi", nama: "S1 Biologi", jenjang: "S1" },
      { id: "spesialis-radiologi", nama: "Spesialis Radiologi", jenjang: "Spesialis" },
      { id: "s2-sains-biomedis", nama: "S2 Sains Biomedis", jenjang: "S2" }
    ]
  },
  fisip: {
    id: "fisip",
    kode: "FISIP",
    nama: "Fakultas Ilmu Sosial dan Ilmu Politik",
    ikon: "landmark",
    warna: "#7c3aed",
    dekan: {
      nama: "Dr. S. Bekti Istiyanto, M.Si.",
      nip: "197206121999031001"
    },
    prodi: [
      { id: "s1-ilmu-komunikasi", nama: "S1 Ilmu Komunikasi", jenjang: "S1" },
      { id: "s2-ilmu-komunikasi", nama: "S2 Ilmu Komunikasi", jenjang: "S2" },
      { id: "s1-sains-informasi", nama: "S1 Sains Informasi", jenjang: "S1" },
      { id: "s1-kajian-film", nama: "S1 Kajian Film Televisi dan Media", jenjang: "S1" },
      { id: "s1-hub-internasional", nama: "S1 Hubungan Internasional", jenjang: "S1" },
      { id: "s2-hub-internasional", nama: "S2 Hubungan Internasional", jenjang: "S2" },
      { id: "s1-ilmu-politik", nama: "S1 Ilmu Politik", jenjang: "S1" },
      { id: "s2-ilmu-politik", nama: "S2 Ilmu Politik", jenjang: "S2" }
    ]
  },
  fik: {
    id: "fik",
    kode: "FIK",
    nama: "Fakultas Ilmu Komputer",
    ikon: "cpu",
    warna: "#059669",
    dekan: {
      nama: "Dr. Supriyanto, S.T., M.T.",
      nip: "197105151998031002"
    },
    prodi: [
      { id: "s1-sistem-informasi", nama: "S1 Sistem Informasi", jenjang: "S1" },
      { id: "d3-sistem-informasi", nama: "D3 Sistem Informasi", jenjang: "D3" },
      { id: "s1-teknik-informatika", nama: "S1 Teknik Informatika", jenjang: "S1" },
      { id: "s1-sains-data", nama: "S1 Sains Data", jenjang: "S1" }
    ]
  },
  ft: {
    id: "ft",
    kode: "FT",
    nama: "Fakultas Teknik",
    ikon: "wrench",
    warna: "#d97706",
    dekan: {
      nama: "Dr. Ir. Reda Rizal, M.Si.",
      nip: "196210051992031001"
    },
    prodi: [
      { id: "s1-teknik-mesin", nama: "S1 Teknik Mesin", jenjang: "S1" },
      { id: "s1-teknik-industri", nama: "S1 Teknik Industri", jenjang: "S1" },
      { id: "s1-teknik-perkapalan", nama: "S1 Teknik Perkapalan", jenjang: "S1" },
      { id: "s1-teknik-elektro", nama: "S1 Teknik Elektro", jenjang: "S1" },
      { id: "s1-teknik-logistik", nama: "S1 Teknik Logistik", jenjang: "S1" }
    ]
  },
  fh: {
    id: "fh",
    kode: "FH",
    nama: "Fakultas Hukum",
    ikon: "scale",
    warna: "#dc2626",
    dekan: {
      nama: "Dr. Suherman, S.H., LL.M.",
      nip: "197409212000121001"
    },
    prodi: [
      { id: "s1-hukum", nama: "S1 Hukum", jenjang: "S1" },
      { id: "s1-hukum-bisnis", nama: "S1 Hukum Bisnis", jenjang: "S1" },
      { id: "s2-hukum", nama: "S2 Hukum", jenjang: "S2" },
      { id: "s3-hukum", nama: "S3 Hukum", jenjang: "S3" }
    ]
  },
  fikes: {
    id: "fikes",
    kode: "FIKES",
    nama: "Fakultas Ilmu Kesehatan",
    ikon: "activity",
    warna: "#0891b2",
    dekan: {
      nama: "Desak Nyoman Sithi, S.Kp., MARS.",
      nip: "196708221990032001"
    },
    prodi: [
      { id: "d3-keperawatan", nama: "D3 Keperawatan", jenjang: "D3" },
      { id: "d3-fisioterapi", nama: "D3 Fisioterapi", jenjang: "D3" },
      { id: "s1-keperawatan", nama: "S1 Keperawatan", jenjang: "S1" },
      { id: "s1-kesehatan-masyarakat", nama: "S1 Kesehatan Masyarakat", jenjang: "S1" },
      { id: "s1-gizi", nama: "S1 Gizi", jenjang: "S1" },
      { id: "s1-fisioterapi", nama: "S1 Fisioterapi", jenjang: "S1" },
      { id: "profesi-ners", nama: "Profesi Ners", jenjang: "Profesi" },
      { id: "s2-kesehatan-masyarakat", nama: "S2 Kesehatan Masyarakat", jenjang: "S2" },
      { id: "s2-keperawatan", nama: "S2 Keperawatan", jenjang: "S2" }
    ]
  }
};

export const ADMIN_ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN_FAKULTAS: 'admin_fakultas',
  ADMIN_PRODI: 'admin_prodi',
  DOSEN: 'dosen'
};

export const ROLE_LABELS = {
  [ADMIN_ROLES.SUPERADMIN]: 'Super Administrator',
  [ADMIN_ROLES.ADMIN_FAKULTAS]: 'Admin Fakultas',
  [ADMIN_ROLES.ADMIN_PRODI]: 'Admin Program Studi',
  [ADMIN_ROLES.DOSEN]: 'Dosen Pengampu'
};

export const ATTENDANCE_STATUS = {
  HADIR: 'Hadir',
  TERLAMBAT: 'Terlambat',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPA: 'Alpa'
};

export const ATTENDANCE_METHODS = {
  SCAN: 'scan',
  MANUAL: 'manual',
  SCAN_ADMIN: 'scan-admin',
  SISTEM: 'sistem'
};

export const SESSION_STATUS = {
  SCHEDULED: 'Terjadwal',
  OPEN: 'Dibuka',
  CLOSED: 'Ditutup'
};

export const DEFAULT_SETTINGS = {
  institutionName: "Universitas Pembangunan Nasional 'Veteran' Jakarta",
  academicYear: "2026/2027",
  semester: "Ganjil",
  lateToleranceMinutes: 15,
  minAttendancePercent: 75,
  operatingHoursStart: "07:00",
  operatingHoursEnd: "21:00",
  allowManualAttendance: true,
  requireActiveSession: true,
  geofencing: {
    enabled: false,
    latitude: -6.314643,
    longitude: 106.793755,
    radiusMeters: 300 // Radius 300 meter kampus UPNVJ Pondok Labu
  },
  maintenanceMode: false,
  maintenanceMessage: "Sistem Presensi sedang dalam pemeliharaan berkala. Silakan coba beberapa saat lagi.",
  holidays: [
    "2026-08-17", // HUT RI
    "2026-12-25"  // Hari Natal
  ]
};

export function getFacultyList() {
  return Object.values(FAKULTAS_DATA);
}

export function getFacultyById(idOrNameOrProdi) {
  if (!idOrNameOrProdi) return null;
  const raw = String(idOrNameOrProdi).trim();
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const faculties = Object.values(FAKULTAS_DATA);

  // 1. Direct match by id or code
  const direct = faculties.find(f => 
    f.id.toLowerCase() === clean || 
    f.kode.toLowerCase() === clean
  );
  if (direct) return direct;

  const lowerRaw = raw.toLowerCase();

  // 2. Exact or substring match on faculty name
  const nameMatch = faculties.find(f => {
    const fName = f.nama.toLowerCase();
    return fName === lowerRaw || fName.includes(lowerRaw) || lowerRaw.includes(fName) ||
      (f.id === 'fisip' && (lowerRaw.includes('sosial dan politik') || lowerRaw.includes('sosial dan ilmu politik')));
  });
  if (nameMatch) return nameMatch;

  // 3. Match against known Prodi list
  const prodiMatch = faculties.find(f => 
    f.prodi.some(p => {
      const pLower = p.nama.toLowerCase();
      return pLower === lowerRaw || lowerRaw.includes(pLower) || pLower.includes(lowerRaw);
    })
  );
  if (prodiMatch) return prodiMatch;

  // 4. Keyword fuzzy matcher
  // Kedokteran (FK)
  if (
    lowerRaw.includes('kedokteran') || 
    lowerRaw.includes('dokter') || 
    lowerRaw.includes('farmasi') || 
    lowerRaw.includes('biomedis') || 
    lowerRaw.includes('radiologi') || 
    lowerRaw.includes('biologi') ||
    clean === 'fk'
  ) {
    return FAKULTAS_DATA.fk || null;
  }

  // Ekonomi & Bisnis (FEB)
  if (
    lowerRaw.includes('ekonomi') || 
    lowerRaw.includes('bisnis') || 
    lowerRaw.includes('manajemen') || 
    lowerRaw.includes('akuntansi') || 
    lowerRaw.includes('perbankan') || 
    lowerRaw.includes('syariah') ||
    clean === 'feb'
  ) {
    return FAKULTAS_DATA.feb || null;
  }

  // Ilmu Komputer (FIK)
  if (
    lowerRaw.includes('komputer') || 
    lowerRaw.includes('informatika') || 
    lowerRaw.includes('sistem informasi') || 
    lowerRaw.includes('sains data') ||
    clean === 'fik'
  ) {
    return FAKULTAS_DATA.fik || null;
  }

  // Teknik (FT)
  if (
    lowerRaw.includes('teknik') || 
    lowerRaw.includes('mesin') || 
    lowerRaw.includes('industri') || 
    lowerRaw.includes('perkapalan') || 
    lowerRaw.includes('elektro') || 
    lowerRaw.includes('logistik') ||
    clean === 'ft'
  ) {
    return FAKULTAS_DATA.ft || null;
  }

  // Hukum (FH)
  if (lowerRaw.includes('hukum') || clean === 'fh') {
    return FAKULTAS_DATA.fh || null;
  }

  // Ilmu Sosial & Politik (FISIP)
  if (
    lowerRaw.includes('sosial') || 
    lowerRaw.includes('politik') || 
    lowerRaw.includes('komunikasi') || 
    lowerRaw.includes('hubungan internasional') || 
    lowerRaw.includes('fisip') ||
    clean === 'fisip'
  ) {
    return FAKULTAS_DATA.fisip || null;
  }

  // Ilmu Kesehatan (FIKES)
  if (
    lowerRaw.includes('kesehatan') || 
    lowerRaw.includes('keperawatan') || 
    lowerRaw.includes('fisioterapi') || 
    lowerRaw.includes('gizi') || 
    lowerRaw.includes('ners') || 
    lowerRaw.includes('fikes') ||
    clean === 'fikes'
  ) {
    return FAKULTAS_DATA.fikes || null;
  }

  return null;
}

export function getAllProdiList() {
  const result = [];
  Object.values(FAKULTAS_DATA).forEach(f => {
    f.prodi.forEach(p => {
      result.push({
        ...p,
        fakultasId: f.id,
        fakultasKode: f.kode,
        fakultasNama: f.nama
      });
    });
  });
  return result;
}

export function getDekanByFaculty(facultyIdOrName) {
  const fac = getFacultyById(facultyIdOrName);
  if (fac && fac.dekan) {
    return {
      ...fac.dekan,
      fakultasCode: fac.kode,
      fakultasName: fac.nama
    };
  }
  return {
    nama: "Dr. Supriyanto, S.T., M.T.",
    nip: "197105151998031002",
    fakultasCode: "FIK",
    fakultasName: "Fakultas Ilmu Komputer"
  };
}
