/** 
 * PG 2025 Semester-I 
 * TABULATION REGISTER GENERATOR 
 * 
 * Input: 
 *   utils/pg2025Sem1Students.json 
 *   utils/pg2025Sem1Calculated.json 
 * 
 * Output: 
 *   output/PG_2025_Semester_1_Tabulation_Register.pdf 
 * 
 * IMPORTANT: 
 *   - Does NOT recalculate marks. 
 *   - Marks / grade / GP / credit / CP / SGPA / percentage 
 *     are taken from calculated JSON. 
 *   - Raw JSON is used only for student details. 
 */ 
 
const fs = require("fs"); 
const path = require("path"); 
const PDFDocument = require("pdfkit"); 
 
const ROOT = path.join(__dirname, ".."); 
 
const RAW_FILE = path.join( 
  ROOT, 
  "utils", 
  "pg2025Sem1Students.json" 
); 
 
const CALCULATED_FILE = path.join( 
  ROOT, 
  "utils", 
  "pg2025Sem1Calculated.json" 
); 
 
const CONFIG_FILE = path.join( 
  ROOT, 
  "config", 
  "pg2025Sem1Config.js" 
); 
 
const LOGO_FILE = path.join( 
  ROOT, 
  "assets", 
  "college-logo.png" 
); 
 
const OUTPUT_DIR = path.join( 
  ROOT, 
  "output" 
); 
 
const OUTPUT_FILE = path.join( 
  OUTPUT_DIR, 
  "PG_2025_Semester_1_Tabulation_Register.pdf" 
); 
 
 
// ---------------------------------------------------- 
// PAGE SETTINGS 
// ---------------------------------------------------- 
 
const PAGE_WIDTH = 842; 
const PAGE_HEIGHT = 595; 
 
const MARGIN = 28; 
 
const TABLE_X = MARGIN; 
const TABLE_WIDTH = 
  PAGE_WIDTH - MARGIN * 2; 
 
 
// ---------------------------------------------------- 
// HELPERS 
// ---------------------------------------------------- 
 
function readJSON(file) { 
  return JSON.parse( 
    fs.readFileSync(file, "utf8") 
  ); 
} 
 
 
function getResult(student) { 
  const failed = student.subjects.some( 
    subject => { 
      const grade = String( 
        subject.grade || "" 
      ).toUpperCase(); 
 
      return ( 
        grade === "F" || 
        grade === "AB" || 
        grade === "M" 
      ); 
 
    } 
  ); 
 
  return failed ? "FAIL" : "PASS"; 
} 
 
 
// ---------------------------------------------------- 
// ADDED: CLASSIFICATION LOGIC 
// ---------------------------------------------------- 
 
function getClassification(student) { 
 
  // Fail has first priority 
  const result = getResult(student); 
 
  if (result === "FAIL") { 
    return "Fail"; 
  } 
 
  const sgpa = Number( 
    student.sgpa || 0 
  ); 
 
 if (sgpa >= 9) { 
  return "Excellent"; 
} 
 
if (sgpa >= 8) { 
  return "Very Good"; 
} 
 
if (sgpa >= 7) { 
  return "Good"; 
} 
 
if (sgpa >= 6) { 
  return "Average"; 
} 
 
  return ""; 
} 
 
 
function drawCell( 
  doc, 
  x, 
  y, 
  width, 
  height, 
  text, 
  options = {} 
) { 
  doc 
    .rect(x, y, width, height) 
    .stroke(); 
 
  doc 
    .font( 
      options.bold 
        ? "Helvetica-Bold" 
        : "Helvetica" 
    ) 
    .fontSize( 
      options.size || 7 
    ) 
    .fillColor( 
      options.color || "black" 
    ) 
    .text( 
      String(text ?? ""), 
      x + 2, 
      y + (options.top || 5), 
      { 
        width: width - 4, 
        height: height - 4, 
        align: options.align || "center", 
        ellipsis: true, 
        lineGap: 0 
      } 
    ); 
} 
 
 
function cleanText(text) { 
  return String(text ?? ""); 
} 
 
 
function getFullMark( 
  department, 
  subject, 
  index 
) { 
  const dept = String( 
    department || "" 
  ).toLowerCase(); 
 
  // Chemistry practical papers 
  if ( 
    dept === "chemistry" && 
    ( 
      index === 3 || 
      index === 4 
    ) 
  ) { 
    return 50; 
  } 
 
  // Chemistry theory 
  if (dept === "chemistry") { 
    return 70; 
  } 
 
  // All other PG Semester-I papers 
  return 100; 
} 
 
 
// ---------------------------------------------------- 
// HEADER 
// ---------------------------------------------------- 
 
function drawHeader( 
  doc, 
  department, 
  studentCount 
) { 
  // College logo 
  if ( 
    fs.existsSync(LOGO_FILE) 
  ) { 
    doc.image( 
      LOGO_FILE, 
      PAGE_WIDTH / 2 - 20, 
      16, 
      { 
        width: 40, 
        height: 40 
      } 
    ); 
  } 
 
  // College name 
  doc 
    .font("Helvetica-Bold") 
    .fontSize(14) 
    .fillColor("black") 
    .text( 
      "NIMAPARA AUTONOMOUS COLLEGE, NIMAPARA", 
      MARGIN, 
      55, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
  // Title 
  doc 
    .fontSize(10.5) 
    .text( 
      "TABULATION REGISTER", 
      MARGIN, 
      73, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
  // Examination 
  doc 
    .fontSize(8.5) 
    .text( 
      "PG — 1ST SEMESTER EXAMINATION (2026) — 2025 ADMISSION BATCH", 
      MARGIN, 
      91, 
      { 
        width: TABLE_WIDTH, 
        align: "center" 
      } 
    ); 
 
  // Department heading 
  drawCell( 
    doc, 
    TABLE_X, 
    110, 
    TABLE_WIDTH, 
    24, 
    `${String(department).toUpperCase()} (${studentCount})`, 
    { 
      bold: true, 
      size: 9, 
      top: 7 
    } 
  ); 
} 
 
 
// ---------------------------------------------------- 
// STUDENT INFORMATION 
// ---------------------------------------------------- 
 
function drawStudentInfo( 
  doc, 
  student, 
  rawStudent, 
  slNo 
) { 
  const y = 145; 
 
  const rowHeight = 22; 
 
  // First row 
 
  drawCell( 
    doc, 
    MARGIN, 
    y, 
    160, 
    rowHeight, 
    `Sl. ${slNo}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
 
  drawCell( 
    doc, 
    MARGIN + 160, 
    y, 
    TABLE_WIDTH - 160 - 210, 
    rowHeight, 
    `Name: ${rawStudent.name || ""}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
 
  drawCell( 
    doc, 
    MARGIN + TABLE_WIDTH - 210, 
    y, 
    210, 
    rowHeight, 
    `Dept: ${rawStudent.department || ""}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
 
 
  // Second row 
 
  const y2 = y + rowHeight; 
 
  const third = 
    TABLE_WIDTH / 3; 
 
  drawCell( 
    doc, 
    MARGIN, 
    y2, 
    third, 
    rowHeight, 
    `College Roll: ${rawStudent.collegeRollNo || ""}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
 
  drawCell( 
    doc, 
    MARGIN + third, 
    y2, 
    third, 
    rowHeight, 
    `Exam Roll: ${student.autonomousRollNo || ""}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
 
  drawCell( 
    doc, 
    MARGIN + third * 2, 
    y2, 
    third, 
    rowHeight, 
    `Exam Code: ${student.examcode || ""}`, 
    { 
      bold: true, 
      align: "left", 
      top: 5,
      size: 8.5
    } 
  ); 
} 
 
 
// ---------------------------------------------------- 
// TABULATION TABLE 
// ---------------------------------------------------- 
 
function drawTable( 
  doc, 
  student, 
  department 
) { 
  const tableTop = 210; 
 
  const firstHeaderHeight = 25; 
  const secondHeaderHeight = 30; 
  const rowHeight = 29; 
 
  /* 
    Columns: 
 
    Paper 
    Subject 
    Midsem 
    Full Mark 
    Secured 
    Total 
    Grace 
    Grade 
    GP 
    Cr 
    CP 
    Result 
  */ 
 
  const originalWidths = [ 
    52,  // Paper 
    172, // Subject 
    55,  // Midsem 
    55,  // Full Mark 
    55,  // Secured 
    55,  // Total 
    45,  // Grace 
    48,  // Grade 
    34,  // GP 
    34,  // Cr 
    38,  // CP 
    45   // Result 
  ]; 
 
  const originalTotal = 
    originalWidths.reduce( 
      (a, b) => a + b, 
      0 
    ); 
 
  const scale = 
    TABLE_WIDTH / originalTotal; 
 
  const widths = 
    originalWidths.map( 
      width => width * scale 
    ); 
 
 
  // -------------------------------------------------- 
  // FIRST HEADER ROW 
  // -------------------------------------------------- 
 
  let x = MARGIN; 
 
  // PAPER 
  drawCell( 
    doc, 
    x, 
    tableTop, 
    widths[0], 
    firstHeaderHeight + 
      secondHeaderHeight, 
    "Paper", 
    { 
      bold: true, 
      size: 7, 
      top: 22 
    } 
  ); 
 
  x += widths[0]; 
 
 
  // SUBJECT 
  drawCell( 
    doc, 
    x, 
    tableTop, 
    widths[1], 
    firstHeaderHeight + 
      secondHeaderHeight, 
    "Subject", 
    { 
      bold: true, 
      size: 7, 
      top: 22 
    } 
  ); 
 
  x += widths[1]; 
 
 
  // MID SEM 
  drawCell( 
    doc, 
    x, 
    tableTop, 
    widths[2], 
    firstHeaderHeight, 
    "MID SEM", 
    { 
      bold: true, 
      size: 7, 
      top: 8 
    } 
  ); 
 
  drawCell( 
    doc, 
    x, 
    tableTop + 
      firstHeaderHeight, 
    widths[2], 
    secondHeaderHeight, 
    "Midsem\n(30)", 
    { 
      bold: true, 
      size: 6.5, 
      top: 7 
    } 
  ); 
 
  x += widths[2]; 
 
 
  // END SEM 
  drawCell( 
    doc, 
    x, 
    tableTop, 
    widths[3] + 
      widths[4], 
    firstHeaderHeight, 
    "END SEM", 
    { 
      bold: true, 
      size: 7, 
      top: 8 
    } 
  ); 
 
 
  // Full Mark 
  drawCell( 
    doc, 
    x, 
    tableTop + 
      firstHeaderHeight, 
    widths[3], 
    secondHeaderHeight, 
    "Full Mark", 
    { 
      bold: true, 
      size: 6.5, 
      top: 7 
    } 
  ); 
 
  x += widths[3]; 
 
 
  // Secured 
  drawCell( 
    doc, 
    x, 
    tableTop + 
      firstHeaderHeight, 
    widths[4], 
    secondHeaderHeight, 
    "Secured", 
    { 
      bold: true, 
      size: 6.5, 
      top: 12 
    } 
  ); 
 
  x += widths[4]; 
 
 
  // TOTAL 
  drawCell( 
    doc, 
    x, 
    tableTop, 
    widths[5] + 
      widths[6] + 
      widths[7] + 
      widths[8] + 
      widths[9] + 
      widths[10] + 
      widths[11], 
    firstHeaderHeight, 
    "TOTAL", 
    { 
      bold: true, 
      size: 7, 
      top: 8 
    } 
  ); 
 
 
  // Second row under TOTAL 
 
  const labels = [ 
    "Total", 
    "Grace", 
    "Grade", 
    "GP", 
    "Cr", 
    "CP", 
    "Result" 
  ]; 
 
  const totalWidths = [ 
    widths[5], 
    widths[6], 
    widths[7], 
    widths[8], 
    widths[9], 
    widths[10], 
    widths[11] 
  ]; 
 
  x = 
    MARGIN + 
    widths[0] + 
    widths[1] + 
    widths[2] + 
    widths[3] + 
    widths[4]; 
 
  labels.forEach( 
    (label, index) => { 
      drawCell( 
        doc, 
        x, 
        tableTop + 
          firstHeaderHeight, 
        totalWidths[index], 
        secondHeaderHeight, 
        label, 
        { 
          bold: true, 
          size: 6.3, 
          top: 12 
        } 
      ); 
 
      x += totalWidths[index]; 
    } 
  ); 
 
 
  // -------------------------------------------------- 
  // SUBJECT ROWS 
  // -------------------------------------------------- 
 
  let y = 
    tableTop + 
    firstHeaderHeight + 
    secondHeaderHeight; 
 
 
  student.subjects.forEach( 
    (subject, index) => { 
 
      const course = 
        subject.courses?.[0] || {}; 
 
      const paper = 
        course.courseType || ""; 
 
      const subjectName = 
        course.subjectName || ""; 
 
      const grade = 
        subject.grade || ""; 
 
      const gradeUpper = 
        String(grade) 
          .toUpperCase(); 
 
 
      const result = 
        ( 
          gradeUpper === "F" || 
          gradeUpper === "AB" || 
          gradeUpper === "M" 
        ) 
          ? "FAIL" 
          : "PASS"; 
 
 
      const fullMark = 
        getFullMark( 
          department, 
          subject, 
          index 
        ); 
 
 
      const values = [ 
        paper, 
        subjectName, 
        subject.midsemMark ?? "", 
        fullMark, 
        subject.finalMark ?? "", 
        subject.totalMark ?? "", 
        "", 
        grade, 
        subject.gradePoint ?? "", 
        subject.credit ?? "", 
        subject.creditPoint ?? "", 
        result 
      ]; 
 
 
      x = MARGIN; 
 
 
      values.forEach( 
        (value, columnIndex) => { 
 
          drawCell( 
            doc, 
            x, 
            y, 
            widths[columnIndex], 
            rowHeight, 
            cleanText(value), 
            { 
              size: 
                columnIndex === 1 
                  ? 6.4 
                  : 7, 
 
              align: 
                columnIndex === 1 
                  ? "left" 
                  : "center", 
 
              top: 9, 
 
              // Keep FAIL text brown-red 
              color: 
                columnIndex === 11 && 
                result === "FAIL" 
                  ? "#8B4513" 
                  : "black" 
            } 
          ); 
 
          x += widths[columnIndex]; 
        } 
      ); 
 
      y += rowHeight; 
    } 
  ); 
 
 
  return y; 
} 
 
 
// ---------------------------------------------------- 
// SUMMARY 
// ---------------------------------------------------- 
 
function drawSummary( 
  doc, 
  student, 
  department, 
  y 
) { 
  y += 7; 
 
 
  const totalCredits = 
    student.subjects.reduce( 
      (sum, subject) => 
        sum + 
        Number( 
          subject.credit || 0 
        ), 
      0 
    ); 
 
 
  const totalCreditPoints = 
    student.subjects.reduce( 
      (sum, subject) => 
        sum + 
        Number( 
          subject.creditPoint || 0 
        ), 
      0 
    ); 
 
 
  const totalMarks = 
    student.subjects.reduce( 
      (sum, subject, index) => 
        sum + 
        getFullMark( 
          department, 
          subject, 
          index 
        ), 
      0 
    ); 
 
 
  // -------------------------------------------------- 
  // ADDED: CLASSIFICATION 
  // -------------------------------------------------- 
 
  const classification = 
    getClassification(student); 
 
 
  const summaryCells = [ 
    [ 
      `Total Marks: ${totalMarks}`, 
      1.35 
    ], 
    [ 
      `Secured Total: ${student.grandTotal ?? 0}`, 
      1.35 
    ], 
    [ 
      `Total Credits: ${totalCredits}`, 
      1.15 
    ], 
    [ 
      `Total Credit Points: ${totalCreditPoints}`, 
      1.45 
    ], 
    [ 
      `SGPA: ${student.sgpa ?? 0}`, 
      0.95 
    ], 
    [ 
      `%: ${student.percentage ?? 0}`, 
      0.95 
    ], 
 
    // ------------------------------------------------ 
    // CHANGED ONLY: 
    // Result -> Classification 
    // ------------------------------------------------ 
 
    [ 
      `Classification: ${classification}`, 
      1.00 
    ] 
  ]; 
 
 
  const ratioTotal = 
    summaryCells.reduce( 
      (sum, cell) => 
        sum + cell[1], 
      0 
    ); 
 
 
  let x = MARGIN; 
 
 
  summaryCells.forEach( 
    ([text, ratio], index) => { 
 
      const width = 
        TABLE_WIDTH * 
        ratio / 
        ratioTotal; 
 
 
      // ------------------------------------------------ 
      // ONLY FAIL TEXT IS BROWN-RED 
      // ------------------------------------------------ 
 
      const isFail = 
        index === 6 && 
        classification === "Fail"; 
 
 
      drawCell( 
        doc, 
        x, 
        y, 
        width, 
        24, 
        text, 
        { 
          bold: true, 
          size: 7.3, 
          align: "left", 
          top: 7, 
 
          color: 
            isFail 
              ? "#8B4513" 
              : "black" 
        } 
      ); 
 
 
      x += width; 
    } 
  ); 
 
 
  // Controller of Examinations 
  doc 
    .font("Helvetica") 
    .fontSize(7) 
    .fillColor("black") 
    .text( 
      "Controller of Examinations", 
      PAGE_WIDTH - 180, 
      PAGE_HEIGHT - 22, 
      { 
        width: 150, 
        align: "right" 
      } 
    ); 
} 
 
 
// ---------------------------------------------------- 
// MAIN 
// ---------------------------------------------------- 
 
function main() { 
 
  // Check files 
 
  if ( 
    !fs.existsSync(RAW_FILE) 
  ) { 
    throw new Error( 
      `Raw JSON not found:\n${RAW_FILE}` 
    ); 
  } 
 
 
  if ( 
    !fs.existsSync(CALCULATED_FILE) 
  ) { 
    throw new Error( 
      `Calculated JSON not found:\n${CALCULATED_FILE}` 
    ); 
  } 
 
 
  // Output directory 
 
  fs.mkdirSync( 
    OUTPUT_DIR, 
    { 
      recursive: true 
    } 
  ); 
 
 
  // Read files 
 
  const rawData = 
    readJSON(RAW_FILE); 
 
  const calculatedData = 
    readJSON(CALCULATED_FILE); 
 
 
  const rawStudents = 
    rawData.students || 
    rawData; 
 
 
  const calculatedStudents = 
    Array.isArray( 
      calculatedData 
    ) 
      ? calculatedData 
      : calculatedData.students || 
        []; 
 
 
  // -------------------------------------------------- 
  // MATCH RAW + CALCULATED 
  // -------------------------------------------------- 
 
  const rawMap = 
    new Map(); 
 
 
  rawStudents.forEach( 
    student => { 
      rawMap.set( 
        String( 
          student.autonomousRollNo 
        ), 
        student 
      ); 
    } 
  ); 
 
 
  // -------------------------------------------------- 
  // GROUP BY DEPARTMENT 
  // -------------------------------------------------- 
 
  const departments = {}; 
 
 
  calculatedStudents.forEach( 
    student => { 
 
      const rawStudent = 
        rawMap.get( 
          String( 
            student.autonomousRollNo 
          ) 
        ); 
 
 
      const department = 
        rawStudent?.department || 
        "Unknown"; 
 
 
      if ( 
        !departments[department] 
      ) { 
        departments[department] = []; 
      } 
 
 
      departments[ 
        department 
      ].push(student); 
    } 
  ); 
 
 
  // -------------------------------------------------- 
  // PDF 
  // -------------------------------------------------- 
 
  const doc = 
    new PDFDocument({ 
      size: "A4", 
      layout: "landscape", 
      margins: { 
        top: 0, 
        bottom: 0, 
        left: 0, 
        right: 0 
      } 
    }); 
 
 
  const stream = 
    fs.createWriteStream( 
      OUTPUT_FILE 
    ); 
 
 
  doc.pipe(stream); 
 
 
  // -------------------------------------------------- 
  // DEPARTMENT ORDER 
  // -------------------------------------------------- 
 
  const preferredOrder = [ 
    "Odia", 
    "Chemistry", 
    "Math", 
    "Commerce", 
    "Geology", 
    "MFC" 
  ]; 
 
 
  const orderedDepartments = 
    preferredOrder.filter( 
      dept => 
        departments[dept] 
    ); 
 
 
  // Add any unexpected department 
  Object.keys( 
    departments 
  ).forEach( 
    dept => { 
      if ( 
        !orderedDepartments.includes( 
          dept 
        ) 
      ) { 
        orderedDepartments.push( 
          dept 
        ); 
      } 
    } 
  ); 
 
 
  // -------------------------------------------------- 
  // GENERATE PAGES 
  // -------------------------------------------------- 
 
  let serialNumber = 1; 
 
 
  orderedDepartments.forEach( 
    ( 
      department, 
      departmentIndex 
    ) => { 
 
      const students = 
        departments[ 
          department 
        ]; 
 
 
      students.forEach( 
        ( 
          student, 
          studentIndex 
        ) => { 
 
          // New page for every student 
          if ( 
            departmentIndex !== 0 || 
            studentIndex !== 0 
          ) { 
            doc.addPage(); 
          } 
 
 
          const rawStudent = 
            rawMap.get( 
              String( 
                student.autonomousRollNo 
              ) 
            ) || {}; 
 
 
          // Header 
          drawHeader( 
            doc, 
            department, 
            students.length 
          ); 
 
 
          // Student details 
          drawStudentInfo( 
            doc, 
            student, 
            rawStudent, 
            serialNumber 
          ); 
 
 
          // Table 
          const tableBottom = 
            drawTable( 
              doc, 
              student, 
              department 
            ); 
 
 
          // Summary 
          drawSummary( 
            doc, 
            student, 
            department, 
            tableBottom 
          ); 
 
 
          serialNumber++; 
        } 
      ); 
    } 
  ); 
 
 
  doc.end(); 
 
 
  stream.on( 
    "finish", 
    () => { 
      console.log( 
        "\n========================================" 
      ); 
 
      console.log( 
        "PG TABULATION REGISTER GENERATED" 
      ); 
 
      console.log( 
        "========================================" 
      ); 
 
      console.log( 
        `Students: ${calculatedStudents.length}` 
      ); 
 
      console.log( 
        `Output: ${OUTPUT_FILE}` 
      ); 
 
      console.log( 
        "========================================\n" 
      ); 
    } 
  ); 
} 
 
 
// ---------------------------------------------------- 
// RUN 
// ---------------------------------------------------- 
 
main();