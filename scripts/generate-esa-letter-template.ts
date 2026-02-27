import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

async function generateESALetterTemplate() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter
  const { width, height } = page.getSize();

  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.25, 0.25, 0.25);
  const medGray = rgb(0.4, 0.4, 0.4);
  const lineColor = rgb(0.2, 0.4, 0.7);
  const lightBg = rgb(0.95, 0.96, 0.98);

  const margin = 55;
  const contentWidth = width - margin * 2;
  let y = height - 50;

  // ===== HEADER / LETTERHEAD =====
  page.drawRectangle({
    x: 0, y: height - 100, width, height: 100,
    color: rgb(0.12, 0.25, 0.45),
  });

  page.drawText("PAW CREDENTIALS", {
    x: margin, y: height - 45,
    size: 22, font: helveticaBold, color: rgb(1, 1, 1),
  });

  page.drawText("Emotional Support Animal Certification Services", {
    x: margin, y: height - 63,
    size: 10, font: helvetica, color: rgb(0.75, 0.82, 0.92),
  });

  page.drawText("Licensed Professional ESA Recommendation Letter", {
    x: margin, y: height - 80,
    size: 9, font: helvetica, color: rgb(0.6, 0.7, 0.85),
  });

  // Right side - doctor info in header
  const rightX = width - margin;
  page.drawText("{doctorFirstName} {doctorLastName}", {
    x: rightX - 200, y: height - 40,
    size: 10, font: helveticaBold, color: rgb(1, 1, 1),
  });
  page.drawText("License #: {doctorLicenseNumber}", {
    x: rightX - 200, y: height - 53,
    size: 8, font: helvetica, color: rgb(0.8, 0.85, 0.95),
  });
  page.drawText("NPI #: {doctorNpiNumber}", {
    x: rightX - 200, y: height - 64,
    size: 8, font: helvetica, color: rgb(0.8, 0.85, 0.95),
  });
  page.drawText("{doctorAddress}", {
    x: rightX - 200, y: height - 75,
    size: 8, font: helvetica, color: rgb(0.8, 0.85, 0.95),
  });
  page.drawText("{doctorCity}, {doctorState} {doctorZipCode}", {
    x: rightX - 200, y: height - 86,
    size: 8, font: helvetica, color: rgb(0.8, 0.85, 0.95),
  });

  y = height - 120;

  // ===== DATE =====
  page.drawText("Date: {date}", {
    x: margin, y,
    size: 10, font: timesRoman, color: darkGray,
  });

  y -= 25;

  // ===== TITLE =====
  page.drawText("EMOTIONAL SUPPORT ANIMAL", {
    x: width / 2 - 130, y,
    size: 16, font: timesRomanBold, color: black,
  });
  y -= 20;
  page.drawText("RECOMMENDATION LETTER", {
    x: width / 2 - 115, y,
    size: 16, font: timesRomanBold, color: black,
  });

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1.5, color: lineColor,
  });

  y -= 25;

  // ===== TO WHOM IT MAY CONCERN =====
  page.drawText("To Whom It May Concern:", {
    x: margin, y,
    size: 11, font: timesRomanBold, color: black,
  });

  y -= 22;

  // ===== PARAGRAPH 1 - Professional introduction =====
  const p1Lines = [
    "I am a licensed healthcare professional and I am writing this letter to confirm that my patient,",
    "",
  ];
  for (const line of p1Lines) {
    if (line) {
      page.drawText(line, { x: margin, y, size: 10, font: timesRoman, color: darkGray });
      y -= 15;
    }
  }

  // Patient name line (bold placeholders)
  page.drawText("{firstName} {middleName} {lastName}", {
    x: margin + 20, y,
    size: 11, font: timesRomanBold, color: black,
  });
  page.drawText(", date of birth: {dateOfBirth},", {
    x: margin + 195, y,
    size: 10, font: timesRoman, color: darkGray,
  });
  y -= 15;

  page.drawText("residing at {address}, {city}, {state} {zipCode},", {
    x: margin, y,
    size: 10, font: timesRoman, color: darkGray,
  });
  y -= 18;

  // ===== PARAGRAPH 2 - Clinical statement =====
  const p2Lines = [
    "has been evaluated and is currently under my care. Based on my clinical assessment, it is my",
    "professional opinion that the patient has a mental health or emotional disability as recognized under",
    "the Diagnostic and Statistical Manual of Mental Disorders (DSM-5). This condition substantially",
    "limits one or more major life activities.",
  ];
  for (const line of p2Lines) {
    page.drawText(line, { x: margin, y, size: 10, font: timesRoman, color: darkGray });
    y -= 15;
  }

  y -= 8;

  // ===== PARAGRAPH 3 - ESA recommendation =====
  const p3Lines = [
    "I am prescribing an Emotional Support Animal (ESA) as part of my patient's treatment plan. The",
    "presence of this animal is necessary for the emotional and psychological well-being of my patient",
    "and provides therapeutic benefit that alleviates one or more of the identified symptoms or effects",
    "of their disability.",
  ];
  for (const line of p3Lines) {
    page.drawText(line, { x: margin, y, size: 10, font: timesRoman, color: darkGray });
    y -= 15;
  }

  y -= 8;

  // ===== FAIR HOUSING ACT BOX =====
  page.drawRectangle({
    x: margin, y: y - 55, width: contentWidth, height: 60,
    color: lightBg, borderColor: lineColor, borderWidth: 0.5,
  });

  page.drawText("Fair Housing Act Protection", {
    x: margin + 10, y: y - 5,
    size: 10, font: timesRomanBold, color: black,
  });

  const fhaLines = [
    "Under the Fair Housing Act (42 U.S.C. § 3604), individuals with disabilities are entitled to",
    "reasonable accommodations in housing, including the right to keep an Emotional Support Animal",
    "regardless of pet restrictions or breed/weight limitations imposed by the housing provider.",
  ];
  let fhaY = y - 20;
  for (const line of fhaLines) {
    page.drawText(line, { x: margin + 10, y: fhaY, size: 9, font: timesRomanItalic, color: medGray });
    fhaY -= 12;
  }

  y -= 75;

  // ===== PATIENT INFORMATION SECTION =====
  page.drawText("PATIENT INFORMATION", {
    x: margin, y,
    size: 10, font: helveticaBold, color: lineColor,
  });
  y -= 3;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lineColor });
  y -= 16;

  const drawField = (label: string, value: string, x: number, yPos: number, labelWidth: number = 95) => {
    page.drawText(label, { x, y: yPos, size: 9, font: helveticaBold, color: medGray });
    page.drawText(value, { x: x + labelWidth, y: yPos, size: 10, font: timesRoman, color: black });
  };

  drawField("Full Name:", "{firstName} {middleName} {lastName}", margin, y);
  y -= 16;
  drawField("Date of Birth:", "{dateOfBirth}", margin, y);
  drawField("Phone:", "{phone}", margin + contentWidth / 2, y);
  y -= 16;
  drawField("Address:", "{address}", margin, y);
  y -= 16;
  drawField("City/State/Zip:", "{city}, {state} {zipCode}", margin, y);
  y -= 16;
  drawField("Email:", "{email}", margin, y);
  y -= 16;
  drawField("ID Number:", "{driverLicenseNumber}", margin, y);

  y -= 25;

  // ===== PRESCRIBING PROFESSIONAL SECTION =====
  page.drawText("PRESCRIBING PROFESSIONAL", {
    x: margin, y,
    size: 10, font: helveticaBold, color: lineColor,
  });
  y -= 3;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lineColor });
  y -= 16;

  drawField("Name:", "{doctorFirstName} {doctorLastName}", margin, y);
  y -= 16;
  drawField("License #:", "{doctorLicenseNumber}", margin, y);
  drawField("NPI #:", "{doctorNpiNumber}", margin + contentWidth / 2, y, 50);
  y -= 16;
  drawField("Address:", "{doctorAddress}", margin, y);
  y -= 16;
  drawField("City/State/Zip:", "{doctorCity}, {doctorState} {doctorZipCode}", margin, y);
  y -= 16;
  drawField("Phone:", "{doctorPhone}", margin, y);

  y -= 25;

  // ===== CERTIFICATION STATEMENT =====
  page.drawText("CERTIFICATION", {
    x: margin, y,
    size: 10, font: helveticaBold, color: lineColor,
  });
  y -= 3;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lineColor });
  y -= 18;

  const certLines = [
    "I certify that I am a licensed healthcare professional authorized to practice in the state of",
    "{doctorState}. I have established a therapeutic relationship with the above-named patient and this",
    "recommendation is based on my professional clinical judgment. This ESA recommendation letter",
    "is valid for twelve (12) months from the date of issuance.",
  ];
  for (const line of certLines) {
    page.drawText(line, { x: margin, y, size: 10, font: timesRoman, color: darkGray });
    y -= 15;
  }

  y -= 15;

  // ===== SIGNATURE AREA =====
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 250, y }, thickness: 0.5, color: black });
  page.drawText("Signature of Licensed Professional", {
    x: margin, y: y - 12,
    size: 8, font: timesRomanItalic, color: medGray,
  });

  page.drawLine({ start: { x: margin + 300, y }, end: { x: width - margin, y }, thickness: 0.5, color: black });
  page.drawText("Date: {date}", {
    x: margin + 300, y: y - 12,
    size: 8, font: timesRomanItalic, color: medGray,
  });

  y -= 35;

  // ===== FOOTER =====
  page.drawLine({
    start: { x: margin, y: 55 },
    end: { x: width - margin, y: 55 },
    thickness: 0.5, color: lineColor,
  });

  page.drawText("This letter is issued by Paw Credentials  |  www.pawcredentials.com  |  Info@pawcredentials.com  |  (866) 405-6820", {
    x: margin, y: 42,
    size: 7.5, font: helvetica, color: medGray,
  });

  page.drawText("This document is confidential and is protected under HIPAA regulations. Unauthorized distribution is prohibited.", {
    x: margin, y: 30,
    size: 7, font: timesRomanItalic, color: medGray,
  });

  // Save
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(process.cwd(), "attached_assets", "ESA_Letter_Template_PawCredentials.pdf");
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`ESA Letter Template saved to: ${outputPath}`);
  console.log(`File size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
}

generateESALetterTemplate().catch(console.error);
