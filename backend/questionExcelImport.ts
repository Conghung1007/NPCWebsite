/**
 * Parse & validate exam questions from Excel (.xlsx) for bulk import.
 *
 * Sheet columns (Vietnamese headers; English aliases accepted):
 *   nhom | ngon_ngu | danh_muc | tieu_de | mo_ta | noi_dung
 *   lua_chon_a | lua_chon_b | lua_chon_c | lua_chon_d | lua_chon_e | lua_chon_f
 *   dap_an | giai_thich | diem
 *
 * - nhom empty → one standalone question per row
 * - same nhom → first row = parent, following rows = sub-questions (max 14 subs)
 * - dap_an: A–F or 1-based index (1 = A). Zero-based "0" is rejected.
 * - Options A–F must be contiguous (no empty gap in the middle).
 */
import * as XLSX from "xlsx";

export const QUESTION_EXCEL_HEADERS = [
  "nhom",
  "ngon_ngu",
  "danh_muc",
  "tieu_de",
  "mo_ta",
  "noi_dung",
  "lua_chon_a",
  "lua_chon_b",
  "lua_chon_c",
  "lua_chon_d",
  "lua_chon_e",
  "lua_chon_f",
  "dap_an",
  "giai_thich",
  "diem",
] as const;

const HEADER_ALIASES: Record<string, (typeof QUESTION_EXCEL_HEADERS)[number]> = {
  nhom: "nhom",
  group: "nhom",
  group_id: "nhom",
  ngon_ngu: "ngon_ngu",
  language: "ngon_ngu",
  lang: "ngon_ngu",
  danh_muc: "danh_muc",
  category: "danh_muc",
  tieu_de: "tieu_de",
  title: "tieu_de",
  question_title: "tieu_de",
  mo_ta: "mo_ta",
  description: "mo_ta",
  noi_dung: "noi_dung",
  question_text: "noi_dung",
  question: "noi_dung",
  lua_chon_a: "lua_chon_a",
  option_a: "lua_chon_a",
  a: "lua_chon_a",
  lua_chon_b: "lua_chon_b",
  option_b: "lua_chon_b",
  b: "lua_chon_b",
  lua_chon_c: "lua_chon_c",
  option_c: "lua_chon_c",
  c: "lua_chon_c",
  lua_chon_d: "lua_chon_d",
  option_d: "lua_chon_d",
  d: "lua_chon_d",
  lua_chon_e: "lua_chon_e",
  option_e: "lua_chon_e",
  e: "lua_chon_e",
  lua_chon_f: "lua_chon_f",
  option_f: "lua_chon_f",
  f: "lua_chon_f",
  dap_an: "dap_an",
  correct: "dap_an",
  correct_answer: "dap_an",
  answer: "dap_an",
  giai_thich: "giai_thich",
  explanation: "giai_thich",
  diem: "diem",
  points: "diem",
  score: "diem",
};

const CATEGORY_MAP: Record<string, string> = {
  "từ vựng": "từ vựng",
  "tu vung": "từ vựng",
  vocabulary: "từ vựng",
  vocab: "từ vựng",
  "ngữ pháp": "ngữ pháp",
  "ngu phap": "ngữ pháp",
  grammar: "ngữ pháp",
  "đọc hiểu": "đọc hiểu",
  "doc hieu": "đọc hiểu",
  reading: "đọc hiểu",
  "nghe hiểu": "nghe hiểu",
  "nghe hieu": "nghe hiểu",
  listening: "nghe hiểu",
};

const LANGUAGE_MAP: Record<string, string> = {
  japanese: "japanese",
  ja: "japanese",
  jp: "japanese",
  "tiếng nhật": "japanese",
  "tieng nhat": "japanese",
  nhật: "japanese",
  english: "english",
  en: "english",
  "tiếng anh": "english",
  "tieng anh": "english",
  german: "german",
  de: "german",
  "tiếng đức": "german",
  "tieng duc": "german",
};

export const MAX_GROUP_SIZE = 15;
export const MAX_ROWS = 500;
/** Abort if sheet has more physical rows than this (DoS guard). */
const MAX_MATRIX_ROWS = MAX_ROWS + 100;

export type ImportQuestionPayload = {
  language: string;
  category: string;
  questionTitle: string | null;
  description: string | null;
  questionText: string;
  questionType: "multiple_choice";
  options: Array<{ text: string; imageUrls: string[] }>;
  correctAnswer: string;
  explanation: string | null;
  /** String for Drizzle numeric columns */
  points: string;
  /** Excel row numbers that produced this unit (1-based sheet rows). */
  excelRows: number[];
  sourceLabel: string;
  subQuestions?: Array<{
    questionText: string;
    options: Array<{ text: string; imageUrls: string[] }>;
    correctAnswer: string;
    explanation: string | null;
    points: string;
    excelRow: number;
  }>;
};

export type ImportRowError = {
  row: number;
  message: string;
};

export type ParseExcelResult = {
  questions: ImportQuestionPayload[];
  errors: ImportRowError[];
  skippedEmptyRows: number;
};

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function mapCategory(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return "ngữ pháp";
  if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];
  const stripped = normalizeHeader(raw).replace(/_/g, " ");
  return CATEGORY_MAP[stripped] || null;
}

function mapLanguage(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return "japanese";
  if (LANGUAGE_MAP[key]) return LANGUAGE_MAP[key];
  const stripped = normalizeHeader(raw).replace(/_/g, " ");
  return LANGUAGE_MAP[stripped] || null;
}

/**
 * Contiguous A–F options (trim trailing empties only; gaps in the middle = error).
 */
function compactOptions(slots: string[]): { options: string[]; error?: string } {
  let last = -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) last = i;
  }
  if (last < 0) return { options: [] };
  for (let i = 0; i <= last; i++) {
    if (!slots[i]) {
      return {
        error: `Thiếu lựa chọn ${String.fromCharCode(65 + i)} (không được để trống giữa các đáp án)`,
      };
    }
  }
  return { options: slots.slice(0, last + 1) };
}

/** Accept A–F or 1-based index only (reject 0-based "0"). */
function parseCorrectIndex(raw: string, optionCount: number): number | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const letterMap: Record<string, number> = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    E: 4,
    F: 5,
  };
  if (s in letterMap) {
    const idx = letterMap[s];
    return idx < optionCount ? idx : null;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n >= 1 && n <= optionCount) return n - 1;
  return null;
}

function parsePoints(raw: string): number {
  if (!raw.trim()) return 1;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return NaN;
  if (n > 0 && n < 0.1) return NaN;
  if (n > 1000) return NaN;
  return Math.round(n * 100) / 100;
}

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function toOptionObjects(texts: string[]) {
  return texts.map((text) => ({ text, imageUrls: [] as string[] }));
}

type RawRow = {
  excelRow: number;
  group: string;
  language: string;
  category: string;
  title: string;
  description: string;
  questionText: string;
  optionSlots: string[];
  correctRaw: string;
  explanation: string;
  points: number;
};

type BuiltUnit = {
  language: string;
  category: string;
  questionTitle: string | null;
  description: string | null;
  questionText: string;
  questionType: "multiple_choice";
  options: Array<{ text: string; imageUrls: string[] }>;
  correctAnswer: string;
  explanation: string | null;
  points: string;
};

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const names = workbook.SheetNames;
  if (!names.length) return null;
  const preferred = names.find((n) => normalizeHeader(n) === "cauhoi");
  return workbook.Sheets[preferred || names[0]] || null;
}

function mapSheetRows(buffer: Buffer): {
  rows: RawRow[];
  errors: ImportRowError[];
  skippedEmptyRows: number;
} {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: false,
  });
  const sheet = pickSheet(workbook);
  if (!sheet) {
    return {
      rows: [],
      errors: [{ row: 0, message: "File Excel không có sheet nào" }],
      skippedEmptyRows: 0,
    };
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Sheet trống" }],
      skippedEmptyRows: 0,
    };
  }

  if (matrix.length > MAX_MATRIX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Sheet quá lớn (>${MAX_MATRIX_ROWS} dòng). Chia nhỏ file hoặc xóa dòng trống.`,
        },
      ],
      skippedEmptyRows: 0,
    };
  }

  const headerRow = (matrix[0] || []).map((h) => normalizeHeader(h));
  const colIndex = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const canon = HEADER_ALIASES[h];
    if (canon && !colIndex.has(canon)) colIndex.set(canon, i);
  });

  if (!colIndex.has("noi_dung")) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message:
            "Thiếu cột bắt buộc «noi_dung» (hoặc question_text). Dùng sheet «CauHoi» và tải file mẫu.",
        },
      ],
      skippedEmptyRows: 0,
    };
  }

  const errors: ImportRowError[] = [];
  const rows: RawRow[] = [];
  let skippedEmptyRows = 0;

  for (let r = 1; r < matrix.length; r++) {
    const excelRow = r + 1;
    const line = (matrix[r] || []) as unknown[];
    const get = (key: (typeof QUESTION_EXCEL_HEADERS)[number]) => {
      const idx = colIndex.get(key);
      if (idx == null) return "";
      const v = line[idx];
      return v == null ? "" : String(v).trim();
    };

    const questionText = get("noi_dung");
    const optA = get("lua_chon_a");
    const title = get("tieu_de");
    const group = get("nhom");
    const isEmpty =
      !questionText &&
      !optA &&
      !title &&
      !group &&
      !get("mo_ta") &&
      !get("dap_an");
    if (isEmpty) {
      skippedEmptyRows += 1;
      continue;
    }

    if (rows.length + 1 > MAX_ROWS) {
      errors.push({
        row: excelRow,
        message: `Vượt quá ${MAX_ROWS} dòng dữ liệu trong một lần nhập`,
      });
      break;
    }

    const optionSlots = [
      get("lua_chon_a"),
      get("lua_chon_b"),
      get("lua_chon_c"),
      get("lua_chon_d"),
      get("lua_chon_e"),
      get("lua_chon_f"),
    ];

    rows.push({
      excelRow,
      group,
      language: get("ngon_ngu"),
      category: get("danh_muc"),
      title,
      description: get("mo_ta"),
      questionText,
      optionSlots,
      correctRaw: get("dap_an"),
      explanation: get("giai_thich"),
      points: parsePoints(get("diem")),
    });
  }

  return { rows, errors, skippedEmptyRows };
}

function buildUnit(
  row: RawRow,
  opts: { allowEmptyOptions: boolean },
): { payload?: BuiltUnit; error?: string } {
  if (!row.questionText) {
    return { error: "Thiếu nội dung câu hỏi (noi_dung)" };
  }
  const language = mapLanguage(row.language);
  if (!language) {
    return {
      error: `Ngôn ngữ không hợp lệ: «${row.language}» (japanese / english / german)`,
    };
  }
  const category = mapCategory(row.category);
  if (!category) {
    return {
      error: `Danh mục không hợp lệ: «${row.category}» (từ vựng / ngữ pháp / đọc hiểu / nghe hiểu)`,
    };
  }
  if (Number.isNaN(row.points)) {
    return {
      error:
        "Điểm không hợp lệ (0 cho đoạn văn; ≥ 0.1 cho câu có đáp án; tối đa 1000)",
    };
  }

  const compacted = compactOptions(row.optionSlots);
  if (compacted.error) {
    return { error: compacted.error };
  }

  let options = compacted.options;
  let correctAnswer = "0";
  let points = row.points;

  if (options.length === 0 && opts.allowEmptyOptions) {
    options = [];
    correctAnswer = "0";
    points = 0;
  } else if (options.length < 2) {
    return {
      error: "Cần ít nhất 2 lựa chọn liên tiếp (lua_chon_a, lua_chon_b, …)",
    };
  } else {
    if (points < 0.1) {
      return { error: "Điểm phải ≥ 0.1 cho câu có đáp án" };
    }
    const idx = parseCorrectIndex(row.correctRaw, options.length);
    if (idx == null) {
      return {
        error: `Đáp án không hợp lệ: «${row.correctRaw || "(trống)"}» — dùng A/B/C/D/E/F hoặc 1/${options.length}`,
      };
    }
    correctAnswer = String(idx);
  }

  return {
    payload: {
      language,
      category,
      questionTitle: row.title || null,
      description: row.description || null,
      questionText: row.questionText,
      questionType: "multiple_choice",
      options: toOptionObjects(options),
      correctAnswer,
      explanation: row.explanation || null,
      points: formatPoints(points),
    },
  };
}

function sourceLabelFor(rows: number[], group?: string): string {
  if (group) {
    if (rows.length === 1) return `Nhóm «${group}» (dòng ${rows[0]})`;
    return `Nhóm «${group}» (dòng ${rows[0]}–${rows[rows.length - 1]})`;
  }
  return `Dòng ${rows[0]}`;
}

/** Build create payloads from an Excel buffer. */
export function parseQuestionsFromExcel(buffer: Buffer): ParseExcelResult {
  const { rows, errors, skippedEmptyRows } = mapSheetRows(buffer);
  if (!rows.length && errors.length) {
    return { questions: [], errors, skippedEmptyRows };
  }
  if (!rows.length) {
    return {
      questions: [],
      errors: [{ row: 0, message: "Không có dòng dữ liệu nào để nhập" }],
      skippedEmptyRows,
    };
  }

  const questions: ImportQuestionPayload[] = [];
  const grouped = new Map<string, RawRow[]>();
  const standalone: RawRow[] = [];

  for (const row of rows) {
    if (!row.group) {
      standalone.push(row);
      continue;
    }
    const list = grouped.get(row.group) || [];
    list.push(row);
    grouped.set(row.group, list);
  }

  for (const row of standalone) {
    const built = buildUnit(row, { allowEmptyOptions: false });
    if (built.error || !built.payload) {
      errors.push({
        row: row.excelRow,
        message: built.error || "Lỗi không xác định",
      });
      continue;
    }
    questions.push({
      ...built.payload,
      excelRows: [row.excelRow],
      sourceLabel: sourceLabelFor([row.excelRow]),
    });
  }

  for (const [groupKey, groupRows] of grouped) {
    if (groupRows.length > MAX_GROUP_SIZE) {
      errors.push({
        row: groupRows[0].excelRow,
        message: `Nhóm «${groupKey}» có ${groupRows.length} câu (tối đa ${MAX_GROUP_SIZE})`,
      });
      continue;
    }
    if (groupRows.length === 1) {
      const built = buildUnit(groupRows[0], { allowEmptyOptions: false });
      if (built.error || !built.payload) {
        errors.push({
          row: groupRows[0].excelRow,
          message: built.error || "Lỗi không xác định",
        });
        continue;
      }
      questions.push({
        ...built.payload,
        excelRows: [groupRows[0].excelRow],
        sourceLabel: sourceLabelFor([groupRows[0].excelRow], groupKey),
      });
      continue;
    }

    const [parentRow, ...subRows] = groupRows;
    const parentBuilt = buildUnit(parentRow, {
      allowEmptyOptions: true,
    });
    if (parentBuilt.error || !parentBuilt.payload) {
      errors.push({
        row: parentRow.excelRow,
        message: parentBuilt.error || "Lỗi không xác định",
      });
      continue;
    }

    const subQuestions: NonNullable<ImportQuestionPayload["subQuestions"]> = [];
    let groupFailed = false;
    for (const sub of subRows) {
      const subBuilt = buildUnit(sub, { allowEmptyOptions: false });
      if (subBuilt.error || !subBuilt.payload) {
        errors.push({
          row: sub.excelRow,
          message: subBuilt.error || "Lỗi không xác định",
        });
        groupFailed = true;
        continue;
      }
      subQuestions.push({
        questionText: subBuilt.payload.questionText,
        options: subBuilt.payload.options,
        correctAnswer: subBuilt.payload.correctAnswer,
        explanation: subBuilt.payload.explanation,
        points: subBuilt.payload.points,
        excelRow: sub.excelRow,
      });
    }
    if (groupFailed) continue;

    const excelRows = groupRows.map((r) => r.excelRow);
    questions.push({
      ...parentBuilt.payload,
      excelRows,
      sourceLabel: sourceLabelFor(excelRows, groupKey),
      subQuestions,
    });
  }

  return { questions, errors, skippedEmptyRows };
}

/** True if buffer looks like OOXML (.xlsx = ZIP). */
export function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/** Generate a .xlsx template buffer with header + sample rows. */
export function buildQuestionImportTemplate(): Buffer {
  const header = [...QUESTION_EXCEL_HEADERS];
  const samples = [
    [
      "",
      "japanese",
      "ngữ pháp",
      "N5 mẫu 1",
      "",
      "「本」の読み方はどれですか。",
      "ほん",
      "もと",
      "はん",
      "ぼく",
      "",
      "",
      "A",
      "Đọc là ほん",
      "1",
    ],
    [
      "doc1",
      "japanese",
      "đọc hiểu",
      "Đoạn đọc N4",
      "Hãy đọc đoạn văn và trả lời các câu hỏi bên dưới.",
      "Đoạn văn: 今日はいい天気です。…",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    [
      "doc1",
      "japanese",
      "đọc hiểu",
      "",
      "",
      "天気はどうですか。",
      "いい",
      "わるい",
      "ふつう",
      "わからない",
      "",
      "",
      "A",
      "",
      "1",
    ],
    [
      "doc1",
      "japanese",
      "đọc hiểu",
      "",
      "",
      "「今日」の意味は？",
      "hôm nay",
      "hôm qua",
      "ngày mai",
      "tuần này",
      "",
      "",
      "A",
      "",
      "1",
    ],
  ];

  const guide = [
    ["Hướng dẫn nhập câu hỏi từ Excel"],
    [""],
    ["nhom", "Cùng mã nhóm = 1 câu cha + các câu con. Để trống = câu độc lập."],
    ["ngon_ngu", "japanese | english | german (mặc định japanese)"],
    ["danh_muc", "từ vựng | ngữ pháp | đọc hiểu | nghe hiểu"],
    ["tieu_de", "Tiêu đề ngắn (tuỳ chọn)"],
    ["mo_ta", "Mô tả / đoạn văn (thường dùng cho câu cha đọc hiểu)"],
    ["noi_dung", "Nội dung câu hỏi (bắt buộc)"],
    [
      "lua_chon_a…f",
      "Lựa chọn liên tiếp A→… (không để trống giữa chừng). Câu cha đoạn văn có thể để trống.",
    ],
    ["dap_an", "A/B/C/D/E/F hoặc số 1-based (1=A). Không dùng 0."],
    ["giai_thich", "Giải thích đáp án (tuỳ chọn)"],
    ["diem", "Điểm số, mặc định 1 (thập phân OK). Đoạn văn cha để trống."],
    [""],
    ["Sheet", "Đặt dữ liệu ở sheet tên «CauHoi» (hoặc sheet đầu tiên)."],
    [
      "Giới hạn",
      `Tối đa ${MAX_ROWS} dòng / lần; tối đa ${MAX_GROUP_SIZE} câu / nhóm; file ≤ 5MB (.xlsx).`,
    ],
    ["Ảnh & audio", "Nhập sau trong Cpanel (Excel chỉ hỗ trợ chữ)."],
  ];

  const wb = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet([header, ...samples]);
  XLSX.utils.book_append_sheet(wb, dataSheet, "CauHoi");
  const guideSheet = XLSX.utils.aoa_to_sheet(guide);
  XLSX.utils.book_append_sheet(wb, guideSheet, "HuongDan");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
