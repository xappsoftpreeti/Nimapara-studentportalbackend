const fs = require("fs"); 
const path = require("path"); 
const PDFDocument = require("pdfkit"); 
 
// ============================================================ 
// FILE PATHS 
// ============================================================ 
 
const RAW_FILE = path.join( 
  __dirname, 
  "../utils/pg2025Sem1Students.json" 
); 
 
const CALCULATED_FILE = path.join( 
  __dirname, 
  "../utils/pg2025Sem1Calculated.json" 
); 
 
const OUTPUT_DIR = path.join( 
  __dirname, 
  "../output" 
); 
 
const OUTPUT_FILE = path.join( 
  OUTPUT_DIR, 
  "PG_2025_Semester_1_Result_Statistics.pdf" 
); 
 
// ============================================================ 
// COLLEGE LOGO 
// ============================================================ 
// Put the standalone college logo here: 
// 
// assets/college-logo.png 
// 
// Folder structure: 
// 
// project/ 
// ├── assets/ 
// │   └── college-logo.png 
// ├── scripts/ 
// │   └── generate_pg_result_statistics.js 
// ├── utils/ 
// │   ├── pg2025Sem1Students.json 
// │   └── pg2025Sem1Calculated.json 
// └── output/ 
 
const LOGO_FILE = path.join( 
  __dirname, 
  "../assets/college-logo.png" 
); 
 
 
// ============================================================ 
// LOAD DATA 
// ============================================================ 
 
function loadJSON(file) { 
  if (!fs.existsSync(file)) { 
    throw new Error(`File not found: ${file}`); 
  } 
 
  return JSON.parse( 
    fs.readFileSync(file, "utf8") 
  ); 
} 
 
const rawData = loadJSON(RAW_FILE); 
const calculatedData = loadJSON(CALCULATED_FILE); 
 
const rawStudents = Array.isArray(rawData) 
  ? rawData 
  : rawData.students || []; 
 
const calculatedStudents = Array.isArray(calculatedData) 
  ? calculatedData 
  : calculatedData.students || []; 
 
 
// ============================================================ 
// RAW STUDENT MAP 
// ============================================================ 
 
const rawStudentMap = new Map(); 
 
rawStudents.forEach((student) => { 
  const roll = String( 
    student.autonomousRollNo || "" 
  ).trim(); 
 
  if (roll) { 
    rawStudentMap.set(roll, student); 
  } 
}); 
 
 
// ============================================================ 
// STREAM / DEPARTMENT STRUCTURE 
// ============================================================ 
 
const STREAMS = [ 
  { 
    name: "Arts", 
    departments: [ 
      "Odia" 
    ] 
  }, 
 
  { 
    name: "Science", 
    departments: [ 
      "Chemistry", 
      "Geology", 
      "Mathematics" 
    ] 
  }, 
 
  { 
    name: "Commerce", 
    departments: [ 
      "Commerce" 
    ] 
  }, 
 
  { 
    name: "MFC", 
    departments: [ 
      "MFC" 
    ] 
  } 
]; 
 
 
// ============================================================ 
// HELPERS 
// ============================================================ 
 
function normalizeDepartment(department) { 
  if (!department) return ""; 
 
  const value = String(department) 
    .trim() 
    .toLowerCase(); 
 
  if (value === "odia") { 
    return "Odia"; 
  } 
 
  if ( 
    value === "chemistry" || 
    value === "chem" 
  ) { 
    return "Chemistry"; 
  } 
 
  if ( 
    value === "math" || 
    value === "mathematics" 
  ) { 
    return "Mathematics"; 
  } 
 
  if (value === "geology") { 
    return "Geology"; 
  } 
 
  if (value === "commerce") { 
    return "Commerce"; 
  } 
 
  if ( 
    value === "mfc" || 
    value === "master of finance and control" 
  ) { 
    return "MFC"; 
  } 
 
  return department; 
} 
 
 
function numberValue(value) { 
  const n = Number(value); 
 
  return Number.isFinite(n) 
    ? n 
    : 0; 
} 
 
 
// ============================================================ 
// DETERMINE ABSENT 
// ============================================================ 
// College convention: 
// Students securing 0 in all papers are counted as absent. 
// ============================================================ 
 
function isAbsent(student) { 
  const subjects = student.subjects || []; 
 
  if (!subjects.length) { 
    return true; 
  } 
 
  return subjects.every((subject) => { 
    return numberValue(subject.totalMark) === 0; 
  }); 
} 
 
 
// ============================================================ 
// DETERMINE FAIL 
// ============================================================ 
 
function isFail(student) { 
  const subjects = student.subjects || []; 
 
  return subjects.some((subject) => { 
    const grade = String( 
      subject.grade || "" 
    ) 
      .trim() 
      .toUpperCase(); 
 
    return ( 
      grade === "F" || 
      grade === "AB" || 
      grade === "M" 
    ); 
  }); 
} 
 
 
// ============================================================ 
// DETERMINE MP 
// ============================================================ 
 
function isMP(student) { 
 
  // MP is not currently present in the 
  // PG calculated JSON structure. 
 
  if (student.mp === true) { 
    return true; 
  } 
 
  if ( 
    String(student.result || "") 
      .trim() 
      .toUpperCase() === "MP" 
  ) { 
    return true; 
  } 
 
  return false; 
} 
 
 
// ============================================================ 
// CALCULATE DEPARTMENT STATISTICS 
// ============================================================ 
 
function calculateDepartmentStatistics( 
  department 
) { 
 
  const students = 
    calculatedStudents.filter((student) => { 
 
      const roll = String( 
        student.autonomousRollNo || "" 
      ).trim(); 
 
      const rawStudent = 
        rawStudentMap.get(roll); 
 
      if (!rawStudent) { 
        return false; 
      } 
 
      const studentDepartment = 
        normalizeDepartment( 
          rawStudent.department 
        ); 
 
      return ( 
        studentDepartment === department 
      ); 
    }); 
 
 
  let appeared = 0; 
  let cleared = 0; 
  let backFail = 0; 
  let absent = 0; 
  let mp = 0; 
 
 
  students.forEach((student) => { 
 
    if (isAbsent(student)) { 
      absent++; 
      return; 
    } 
 
    appeared++; 
 
 
    if (isMP(student)) { 
      mp++; 
      return; 
    } 
 
 
    if (isFail(student)) { 
      backFail++; 
    } else { 
      cleared++; 
    } 
  }); 
 
 
  const successPercentage = 
    appeared > 0 
      ? (cleared / appeared) * 100 
      : 0; 
 
 
  return { 
    department, 
    appeared, 
    cleared, 
    backFail, 
    absent, 
    mp, 
    successPercentage 
  }; 
} 
 
 
// ============================================================ 
// BUILD STREAM STATISTICS 
// ============================================================ 
 
const streamStatistics = 
  STREAMS.map((stream) => { 
 
    const departments = 
      stream.departments.map( 
        calculateDepartmentStatistics 
      ); 
 
 
    const total = 
      departments.reduce( 
        (acc, row) => { 
 
          acc.appeared += row.appeared; 
          acc.cleared += row.cleared; 
          acc.backFail += row.backFail; 
          acc.absent += row.absent; 
          acc.mp += row.mp; 
 
          return acc; 
 
        }, 
        { 
          appeared: 0, 
          cleared: 0, 
          backFail: 0, 
          absent: 0, 
          mp: 0 
        } 
      ); 
 
 
    total.successPercentage = 
      total.appeared > 0 
        ? (total.cleared / total.appeared) * 100 
        : 0; 
 
 
    return { 
      name: stream.name, 
      departments, 
      total 
    }; 
  }); 
 
 
// ============================================================ 
// GRAND TOTAL 
// ============================================================ 
 
const grandTotal = 
  streamStatistics.reduce( 
    (acc, stream) => { 
 
      acc.appeared += 
        stream.total.appeared; 
 
      acc.cleared += 
        stream.total.cleared; 
 
      acc.backFail += 
        stream.total.backFail; 
 
      acc.absent += 
        stream.total.absent; 
 
      acc.mp += 
        stream.total.mp; 
 
      return acc; 
 
    }, 
    { 
      appeared: 0, 
      cleared: 0, 
      backFail: 0, 
      absent: 0, 
      mp: 0 
    } 
  ); 
 
 
grandTotal.successPercentage = 
  grandTotal.appeared > 0 
    ? (grandTotal.cleared / 
        grandTotal.appeared) * 100 
    : 0; 
 
 
// ============================================================ 
// PDF SETUP 
// ============================================================ 
 
if (!fs.existsSync(OUTPUT_DIR)) { 
  fs.mkdirSync(OUTPUT_DIR, { 
    recursive: true 
  }); 
} 
 
 
const doc = new PDFDocument({ 
  size: "A4", 
  margin: 40 
}); 
 
 
doc.pipe( 
  fs.createWriteStream(OUTPUT_FILE) 
); 
 
 
// ============================================================ 
// PAGE SETTINGS 
// ============================================================ 
 
const PAGE_WIDTH = doc.page.width; 
const PAGE_HEIGHT = doc.page.height; 
 
const LEFT = 40; 
const RIGHT = 40; 
 
const TABLE_WIDTH = 
  PAGE_WIDTH - LEFT - RIGHT; 
 
 
// ============================================================ 
// HEADER 
// ============================================================ 
 
function drawHeader() { 
 
  let y = 24; 
 
 
  // ---------------------------------------------------------- 
  // COLLEGE LOGO 
  // ---------------------------------------------------------- 
 
  if (fs.existsSync(LOGO_FILE)) { 
 
    try { 
 
      doc.image( 
        LOGO_FILE, 
        PAGE_WIDTH / 2 - 24, 
        y, 
        { 
          width: 48, 
          height: 48 
        } 
      ); 
 
      y += 52; 
 
    } catch (error) { 
 
      console.log( 
        "Logo could not be loaded:", 
        error.message 
      ); 
    } 
 
  } else { 
 
    console.log( 
      `WARNING: Logo not found at ${LOGO_FILE}` 
    ); 
 
    y += 5; 
  } 
 
 
  // ---------------------------------------------------------- 
  // COLLEGE NAME 
  // ---------------------------------------------------------- 
 
  doc 
    .font("Helvetica-Bold") 
    .fontSize(11) 
    .fillColor("black") 
    .text( 
      "NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA", 
      LEFT, 
      y, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
 
  y += 15; 
 
 
  // ---------------------------------------------------------- 
  // RESULT STATISTICS 
  // ---------------------------------------------------------- 
 
  doc 
    .font("Helvetica-Bold") 
    .fontSize(10) 
    .text( 
      "RESULT STATISTICS", 
      LEFT, 
      y, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
 
  y += 14; 
 
 
  // ---------------------------------------------------------- 
  // EXAMINATION / BATCH 
  // ---------------------------------------------------------- 
 
  doc 
    .font("Helvetica-Bold") 
    .fontSize(7.5) 
    .text( 
      "PG — 1ST SEMESTER EXAMINATION (2026) — 2025 ADMISSION BATCH", 
      LEFT, 
      y, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
 
  return y + 17; 
} 
 
 
// ============================================================ 
// TABLE SETTINGS 
// ============================================================ 
 
const COL_WIDTHS = [ 
  82,  // Stream 
  145, // Subject / Department 
  57,  // Appeared 
  57,  // Cleared 
  65,  // Back / Fail 
  40,  // MP 
  67   // % of Success 
]; 
 
 
const ROW_HEIGHT = 19; 
 
 
const HEADERS = [ 
  "Stream", 
  "Subject / Department", 
  "Appeared", 
  "Cleared", 
  "Back / Fail", 
  "MP", 
  "% of Success" 
]; 
 
 
// ============================================================ 
// DRAW CELL 
// ============================================================ 
 
function drawCell( 
  x, 
  y, 
  width, 
  height, 
  text, 
  options = {} 
) { 
 
  const { 
    fill = null, 
    bold = false, 
    align = "center", 
    fontSize = 7, 
    padding = 3 
  } = options; 
 
 
  // Background 
  if (fill) { 
 
    doc 
      .save() 
      .fillColor(fill) 
      .rect( 
        x, 
        y, 
        width, 
        height 
      ) 
      .fill() 
      .restore(); 
  } 
 
 
  // Border 
  doc 
    .lineWidth(0.5) 
    .rect( 
      x, 
      y, 
      width, 
      height 
    ) 
    .stroke(); 
 
 
  // Text 
  doc 
    .font( 
      bold 
        ? "Helvetica-Bold" 
        : "Helvetica" 
    ) 
    .fontSize(fontSize) 
    .fillColor("black"); 
 
 
  const textHeight = 
    doc.heightOfString( 
      String(text ?? ""), 
      { 
        width: 
          width - padding * 2, 
        align 
      } 
    ); 
 
 
  doc.text( 
    String(text ?? ""), 
    x + padding, 
    y + 
      (height - textHeight) / 2, 
    { 
      width: 
        width - padding * 2, 
      align 
    } 
  ); 
} 
 
 
// ============================================================ 
// DRAW TABLE HEADER 
// ============================================================ 
 
function drawTableHeader(y) { 
 
  let x = LEFT; 
 
 
  HEADERS.forEach( 
    (header, index) => { 
 
      drawCell( 
        x, 
        y, 
        COL_WIDTHS[index], 
        ROW_HEIGHT, 
        header, 
        { 
          fill: "#e5e5e5", 
          bold: true, 
          fontSize: 6.5 
        } 
      ); 
 
 
      x += COL_WIDTHS[index]; 
    } 
  ); 
 
 
  return y + ROW_HEIGHT; 
} 
 
 
// ============================================================ 
// DRAW STATISTICS ROW 
// ============================================================ 
 
function drawStatisticsRow( 
  y, 
  stream, 
  department, 
  stats, 
  isStreamTotal = false 
) { 
 
  let x = LEFT; 
 
 
  // ---------------------------------------------------------- 
  // STREAM 
  // ---------------------------------------------------------- 
 
  drawCell( 
    x, 
    y, 
    COL_WIDTHS[0], 
    ROW_HEIGHT, 
    stream, 
    { 
      bold: isStreamTotal, 
      fill: isStreamTotal 
        ? "#eeeeee" 
        : null, 
      fontSize: 7 
    } 
  ); 
 
 
  x += COL_WIDTHS[0]; 
 
 
  // ---------------------------------------------------------- 
  // DEPARTMENT 
  // ---------------------------------------------------------- 
 
  drawCell( 
    x, 
    y, 
    COL_WIDTHS[1], 
    ROW_HEIGHT, 
    department, 
    { 
      bold: isStreamTotal, 
      fill: isStreamTotal 
        ? "#eeeeee" 
        : null, 
      align: "left", 
      fontSize: 7 
    } 
  ); 
 
 
  x += COL_WIDTHS[1]; 
 
 
  // ---------------------------------------------------------- 
  // STATISTICS 
  // ---------------------------------------------------------- 
 
  const values = [ 
    stats.appeared, 
    stats.cleared, 
    stats.backFail, 
    stats.mp, 
    stats.successPercentage.toFixed(2) 
  ]; 
 
 
  values.forEach( 
    (value, index) => { 
 
      drawCell( 
        x, 
        y, 
        COL_WIDTHS[index + 2], 
        ROW_HEIGHT, 
        value, 
        { 
          bold: isStreamTotal, 
          fill: isStreamTotal 
            ? "#eeeeee" 
            : null, 
          fontSize: 7 
        } 
      ); 
 
 
      x += COL_WIDTHS[index + 2]; 
    } 
  ); 
 
 
  return y + ROW_HEIGHT; 
} 
 
 
// ============================================================ 
// DRAW GRAND TOTAL 
// ============================================================ 
 
function drawGrandTotal(y) { 
 
  let x = LEFT; 
 
 
  drawCell( 
    x, 
    y, 
    COL_WIDTHS[0] + 
      COL_WIDTHS[1], 
    ROW_HEIGHT, 
    "Grand Total", 
    { 
      fill: "#d9d9d9", 
      bold: true, 
      align: "center", 
      fontSize: 7 
    } 
  ); 
 
 
  x += 
    COL_WIDTHS[0] + 
    COL_WIDTHS[1]; 
 
 
  const values = [ 
    grandTotal.appeared, 
    grandTotal.cleared, 
    grandTotal.backFail, 
    grandTotal.mp, 
    grandTotal.successPercentage.toFixed(2) 
  ]; 
 
 
  values.forEach( 
    (value, index) => { 
 
      drawCell( 
        x, 
        y, 
        COL_WIDTHS[index + 2], 
        ROW_HEIGHT, 
        value, 
        { 
          fill: "#d9d9d9", 
          bold: true, 
          fontSize: 7 
        } 
      ); 
 
 
      x += COL_WIDTHS[index + 2]; 
    } 
  ); 
 
 
  return y + ROW_HEIGHT; 
} 
 
 
// ============================================================ 
// DRAW MAIN TABLE 
// ============================================================ 
 
let y = drawHeader(); 
 
 
// Table header 
y = drawTableHeader(y); 
 
 
// ------------------------------------------------------------ 
// STREAMS 
// ------------------------------------------------------------ 
 
streamStatistics.forEach( 
  (stream) => { 
 
    stream.departments.forEach( 
      (departmentStats, index) => { 
 
        // Show stream name only on 
        // the first department row. 
        const streamText = 
          index === 0 
            ? stream.name 
            : ""; 
 
 
        y = drawStatisticsRow( 
          y, 
          streamText, 
          departmentStats.department.toUpperCase(), 
          departmentStats, 
          false 
        ); 
      } 
    ); 
 
 
    // -------------------------------------------------------- 
    // STREAM TOTAL 
    // -------------------------------------------------------- 
 
    y = drawStatisticsRow( 
      y, 
      "", 
      "Stream Total", 
      stream.total, 
      true 
    ); 
  } 
); 
 
 
// ------------------------------------------------------------ 
// GRAND TOTAL 
// ------------------------------------------------------------ 
 
y = drawGrandTotal(y); 
 
 
// ============================================================ 
// SUMMARY 
// ============================================================ 
 
y += 14; 
 
 
doc 
  .font("Helvetica-Bold") 
  .fontSize(8) 
  .fillColor("black") 
  .text( 
    "Summary", 
    LEFT, 
    y 
  ); 
 
 
y += 11; 
 
 
// Top line 
doc 
  .moveTo( 
    LEFT, 
    y 
  ) 
  .lineTo( 
    LEFT + TABLE_WIDTH, 
    y 
  ) 
  .lineWidth(0.7) 
  .stroke(); 
 
 
y += 5; 
 
 
// ------------------------------------------------------------ 
// SUMMARY DATA 
// ------------------------------------------------------------ 
 
const summaryRows = [ 
 
  [ 
    "Total Appeared", 
    grandTotal.appeared 
  ], 
 
  [ 
    "Total Cleared", 
    grandTotal.cleared 
  ], 
 
  [ 
    "Total Back / Fail", 
    grandTotal.backFail 
  ], 
 
  [ 
    "Total MP", 
    grandTotal.mp 
  ], 
 
  [ 
    "Result %", 
    grandTotal.successPercentage.toFixed(2) 
  ] 
]; 
 
 
const SUMMARY_LEFT_WIDTH = 430; 
 
const SUMMARY_VALUE_WIDTH = 
  TABLE_WIDTH - 
  SUMMARY_LEFT_WIDTH; 
 
 
// ------------------------------------------------------------ 
// DRAW SUMMARY 
// ------------------------------------------------------------ 
 
summaryRows.forEach( 
  ([label, value]) => { 
 
    drawCell( 
      LEFT, 
      y, 
      SUMMARY_LEFT_WIDTH, 
      ROW_HEIGHT, 
      label, 
      { 
        align: "left", 
        fontSize: 7 
      } 
    ); 
 
 
    drawCell( 
      LEFT + SUMMARY_LEFT_WIDTH, 
      y, 
      SUMMARY_VALUE_WIDTH, 
      ROW_HEIGHT, 
      value, 
      { 
        bold: true, 
        fontSize: 7 
      } 
    ); 
 
 
    y += ROW_HEIGHT; 
  } 
); 
 
 
// ============================================================ 
// FOOTER NOTE 
// ============================================================ 
 
y += 7; 
 
 
// Line above note 
doc 
  .moveTo( 
    LEFT, 
    y 
  ) 
  .lineTo( 
    LEFT + TABLE_WIDTH, 
    y 
  ) 
  .lineWidth(0.7) 
  .stroke(); 
 
 
y += 7; 
 
 
// Note 
doc 
  .font("Helvetica") 
  .fontSize(6.5) 
  .fillColor("black") 
  .text( 
    "Those who secure 0 in all papers are counted as Absent students.", 
    LEFT, 
    y, 
    { 
      width: TABLE_WIDTH, 
      align: "left" 
    } 
  ); 
 
 
// ============================================================ 
// CONTROLLER OF EXAMINATIONS 
// RIGHT SIDE 
// ============================================================ 
 
y += 25; 
 
 
const signatureWidth = 170; 
 
const signatureX = 
  LEFT + 
  TABLE_WIDTH - 
  signatureWidth; 
 
 
// Signature line 
doc 
  .moveTo( 
    signatureX, 
    y 
  ) 
  .lineTo( 
    signatureX + signatureWidth, 
    y 
  ) 
  .lineWidth(0.7) 
  .stroke(); 
 
 
y += 6; 
 
 
// Controller of Examinations 
doc 
  .font("Helvetica-Bold") 
  .fontSize(7) 
  .fillColor("black") 
  .text( 
    "Controller of Examinations", 
    signatureX, 
    y, 
    { 
      width: signatureWidth, 
      align: "right" 
    } 
  ); 
 
 
// ============================================================ 
// FINISH PDF 
// ============================================================ 
 
doc.end(); 
 
 
console.log( 
  "============================================" 
); 
 
console.log( 
  "PG RESULT STATISTICS GENERATED" 
); 
 
console.log( 
  `Output: ${OUTPUT_FILE}` 
); 
 
console.log( 
  "============================================" 
);