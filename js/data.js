/**
 * Data Fakultas dan Program Studi Universitas Pembangunan Nasional "Veteran" Jakarta (UPNVJ)
 * Sesuai spesifikasi resmi sistem absensi mahasiswa UPNVJ.
 */

export const FK_SPECIAL_NOTE = 
  'Perlu diperhatikan bahwa "Profesi Dokter" dan "Profesi Apoteker" merupakan program profesi yang harus ditempuh setelah menyelesaikan gelar sarjana terkait, bukan program gelar sarjana mandiri. Selain itu, fakultas kedokteran di universitas ini juga memiliki program studi lain di bidang kesehatan seperti Keperawatan dan Gizi, tetapi program-program tersebut tidak tercantum dalam daftar 7 program studi yang diperkenalkan secara resmi oleh Fakultas Kedokteran.';

export const FACULTIES = [
  {
    id: "feb",
    code: "FEB",
    name: "Fakultas Ekonomi dan Bisnis",
    icon: "briefcase",
    color: "#1e3a8a",
    accent: "#3b82f6",
    dekan: {
      nama: "Dr. Jubaedah, S.E., M.M.",
      nip: "196803201994032001"
    },
    prodi: [
      "D3 Perbankan dan Keuangan",
      "D3 Akuntansi",
      "S1 Manajemen",
      "S1 Akuntansi",
      "S1 Ekonomi Pembangunan",
      "S1 Ekonomi Syariah",
      "S2 Manajemen",
      "S2 Akuntansi"
    ]
  },
  {
    id: "fk",
    code: "FK",
    name: "Fakultas Kedokteran",
    icon: "stethoscope",
    color: "#065f46",
    accent: "#10b981",
    specialNote: FK_SPECIAL_NOTE,
    dekan: {
      nama: "Dr. dr. H. Taufiq Fredrik Pasiak, M.Kes., M.Pd.I.",
      nip: "196802281997021001"
    },
    prodi: [
      "S1 Kedokteran",
      "Profesi Dokter",
      "S1 Farmasi",
      "Profesi Apoteker",
      "S1 Biologi",
      "Spesialis Radiologi",
      "S2 Sains Biomedis"
    ]
  },
  {
    id: "fisip",
    code: "FISIP",
    name: "Fakultas Ilmu Sosial dan Ilmu Politik",
    icon: "landmark",
    color: "#7c2d12",
    accent: "#f97316",
    dekan: {
      nama: "Dr. S. Bekti Istiyanto, M.Si.",
      nip: "197206121999031001"
    },
    prodi: [
      "S1 Ilmu Komunikasi",
      "S2 Ilmu Komunikasi",
      "S1 Sains Informasi",
      "S1 Kajian Film Televisi dan Media",
      "S1 Hubungan Internasional",
      "S2 Hubungan Internasional",
      "S1 Ilmu Politik",
      "S2 Ilmu Politik"
    ]
  },
  {
    id: "fik",
    code: "FIK",
    name: "Fakultas Ilmu Komputer",
    icon: "laptop",
    color: "#1e1b4b",
    accent: "#6366f1",
    dekan: {
      nama: "Dr. Supriyanto, S.T., M.T.",
      nip: "197105151998031002"
    },
    prodi: [
      "S1 Sistem Informasi",
      "D3 Sistem Informasi",
      "S1 Teknik Informatika",
      "S1 Sains Data"
    ]
  },
  {
    id: "ft",
    code: "FT",
    name: "Fakultas Teknik",
    icon: "cog",
    color: "#78350f",
    accent: "#d97706",
    dekan: {
      nama: "Dr. Ir. Reda Rizal, M.Si.",
      nip: "196210051992031001"
    },
    prodi: [
      "S1 Teknik Mesin",
      "S1 Teknik Industri",
      "S1 Teknik Perkapalan",
      "S1 Teknik Elektro",
      "S1 Teknik Logistik"
    ]
  },
  {
    id: "fh",
    code: "FH",
    name: "Fakultas Hukum",
    icon: "scale",
    color: "#4c1d95",
    accent: "#8b5cf6",
    dekan: {
      nama: "Dr. Suherman, S.H., LL.M.",
      nip: "197409212000121001"
    },
    prodi: [
      "S1 Hukum",
      "S1 Hukum Bisnis",
      "S2 Hukum",
      "S3 Hukum"
    ]
  },
  {
    id: "fikes",
    code: "FIKES",
    name: "Fakultas Ilmu Kesehatan",
    icon: "heart-pulse",
    color: "#134e4a",
    accent: "#14b8a6",
    dekan: {
      nama: "Desak Nyoman Sithi, S.Kp., MARS.",
      nip: "196708221990032001"
    },
    prodi: [
      "D3 Keperawatan",
      "D3 Fisioterapi",
      "S1 Keperawatan",
      "S1 Kesehatan Masyarakat",
      "S1 Gizi",
      "S1 Fisioterapi",
      "Profesi Ners",
      "S2 Kesehatan Masyarakat",
      "S2 Keperawatan"
    ]
  }
];

export function getFaculties() {
  return FACULTIES;
}

export function getFacultyById(idOrNameOrProdi) {
  if (!idOrNameOrProdi) return null;
  const raw = String(idOrNameOrProdi).trim();
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Direct match by id or code
  const direct = FACULTIES.find(f => 
    f.id.toLowerCase() === clean || 
    f.code.toLowerCase() === clean
  );
  if (direct) return direct;

  const lowerRaw = raw.toLowerCase();

  // 2. Exact or substring match on faculty name
  const nameMatch = FACULTIES.find(f => {
    const fName = f.name.toLowerCase();
    return fName === lowerRaw || fName.includes(lowerRaw) || lowerRaw.includes(fName) ||
      (f.id === 'fisip' && (lowerRaw.includes('sosial dan politik') || lowerRaw.includes('sosial dan ilmu politik')));
  });
  if (nameMatch) return nameMatch;

  // 3. Match against known Prodi list
  const prodiMatch = FACULTIES.find(f => 
    f.prodi.some(p => {
      const pLower = p.toLowerCase();
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
    return FACULTIES.find(f => f.id === 'fk') || null;
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
    return FACULTIES.find(f => f.id === 'feb') || null;
  }

  // Ilmu Komputer (FIK)
  if (
    lowerRaw.includes('komputer') || 
    lowerRaw.includes('informatika') || 
    lowerRaw.includes('sistem informasi') || 
    lowerRaw.includes('sains data') ||
    clean === 'fik'
  ) {
    return FACULTIES.find(f => f.id === 'fik') || null;
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
    return FACULTIES.find(f => f.id === 'ft') || null;
  }

  // Hukum (FH)
  if (lowerRaw.includes('hukum') || clean === 'fh') {
    return FACULTIES.find(f => f.id === 'fh') || null;
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
    return FACULTIES.find(f => f.id === 'fisip') || null;
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
    return FACULTIES.find(f => f.id === 'fikes') || null;
  }

  return null;
}

export function getProdiList(facultyId) {
  const fac = getFacultyById(facultyId);
  return fac ? fac.prodi : [];
}

export function getDekanByFaculty(facultyIdOrName) {
  const fac = getFacultyById(facultyIdOrName);
  if (fac && fac.dekan) {
    return {
      ...fac.dekan,
      fakultasCode: fac.code,
      fakultasName: fac.name
    };
  }
  return {
    nama: "Dr. Supriyanto, S.T., M.T.",
    nip: "197105151998031002",
    fakultasCode: "FIK",
    fakultasName: "Fakultas Ilmu Komputer"
  };
}
