import PDFDocument from "pdfkit";
import path from "path";

const TELEGRAM_BOT_TOKEN_KETO = process.env.TELEGRAM_BOT_TOKEN_KETO;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const data = req.body?.payload ? JSON.parse(req.body.payload) : req.body;

    if (!data) {
      throw new Error("No data received");
    }

    const today = new Date().toISOString().split("T")[0];
    const result = calculateKeto(data);
    const pdfBuffer = await createPdfBuffer(data, result);

    let telegramResponse = null;

    if (data.chat_id) {
      telegramResponse = await sendPdfToTelegram(
        data.chat_id,
        pdfBuffer,
        `Кето_план_${data.name}_${today}.pdf`
      );
    }

    return res.status(200).json({
      success: true,
      result,
      sentToTelegram: Boolean(data.chat_id),
      telegramResponse
    });

  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function calculateKeto(data) {
  const gender = data.gender;
  const age = Number(data.age);
  const weight = Number(data.weight);
  const height = Number(data.height);
  const activity = Number(data.activity);

  let bmr;
  if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  }

  const tdee = bmr * activity;
  const caloriesForWeightLoss = tdee * 0.9;

  let targetCalories = Math.round(caloriesForWeightLoss / 100) * 100;
  if (targetCalories < bmr) {
    targetCalories = Math.ceil(bmr / 100) * 100;
  }

  const proteinPercent = 25;
  const fatPercent = 70;
  const carbsPercent = 5;

  const protein = (targetCalories * 0.25) / 4;
  const fat = (targetCalories * 0.70) / 9;
  const carbs = (targetCalories * 0.05) / 4;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    proteinPercent,
    fatPercent,
    carbsPercent
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

/** Draw a filled rounded rectangle */
function roundedRect(doc, x, y, w, h, r, fillColor) {
  doc.save()
    .roundedRect(x, y, w, h, r)
    .fill(fillColor)
    .restore();
}

/** Draw a thin horizontal divider */
function divider(doc, x, y, w, color = "#E8EDE5") {
  doc.save()
    .moveTo(x, y)
    .lineTo(x + w, y)
    .strokeColor(color)
    .lineWidth(1)
    .stroke()
    .restore();
}

/** Small label above a value */
function label(doc, text, x, y, color = "#7A8C75", size = 9) {
  doc.fillColor(color).fontSize(size).text(text, x, y);
}

/** Bold value text */
function value(doc, text, x, y, color = "#1A2E1A", size = 22) {
  doc.fillColor(color).fontSize(size).text(text, x, y);
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

function createPdfBuffer(data, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks = [];

    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(process.cwd(), "fonts", "NotoSans-Regular.ttf");
    doc.font(fontPath);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 842

    // ── Palета ──────────────────────────────────────────────────────────────
    const C = {
      heroTop:    "#1A3C2A",   // темно-зелений верх
      heroBot:    "#2D6A4F",   // середньо-зелений
      heroAccent: "#52B788",   // акцент
      cream:      "#F7F5EF",   // фон сторінки
      white:      "#FFFFFF",
      cardBg:     "#FFFFFF",
      border:     "#D8E8D0",

      green:      "#2D6A4F",
      greenLight: "#EAF4ED",
      greenMid:   "#52B788",

      orange:     "#E07B39",
      orangeLight:"#FFF1E8",

      purple:     "#6B5B95",
      purpleLight:"#F0EDF8",

      text:       "#1A2E1A",
      textMid:    "#4A6045",
      textLight:  "#7A9070",
      textFaint:  "#A8BBA4",
    };

    // ════════════════════════════════════════════════════════════════════════
    // 1. HERO — верхній блок з темним фоном
    // ════════════════════════════════════════════════════════════════════════
    const HERO_H = 210;

    // Фон hero — заливка прямокутника (PDFKit не має лінійного градієнта,
    // тому робимо два перекриваючих прямокутники для ілюзії глибини)
    doc.rect(0, 0, PW, HERO_H).fill(C.heroTop);
    // нижня частина трохи світліша
    doc.rect(0, HERO_H - 60, PW, 60).fill(C.heroBot);

    // Декоративні кола (фонові)
    doc.save()
      .circle(PW - 60, -20, 130)
      .fillOpacity(0.07)
      .fill(C.white)
      .restore();

    doc.save()
      .circle(PW + 20, 80, 90)
      .fillOpacity(0.05)
      .fill(C.white)
      .restore();

    doc.save()
      .circle(30, HERO_H + 10, 80)
      .fillOpacity(0.06)
      .fill(C.white)
      .restore();

    // Логотип / бейдж
    doc.save()
      .circle(52, 52, 22)
      .fill(C.heroAccent)
      .restore();

    doc.fillColor(C.white).fontSize(20).text("К", 44, 41);

    // Заголовок
    doc.fillColor(C.white)
      .fontSize(32)
      .text("Кето-план харчування", 88, 36, { lineBreak: false });

    // Підзаголовок
    doc.fillColor(C.heroAccent)
      .fontSize(13)
      .text(`Персональний розрахунок для ${data.name || "клієнтки"}`, 88, 75);

    // Акцентна смужка під підзаголовком
    doc.save()
      .rect(88, 94, 160, 2)
      .fill(C.greenMid)
      .restore();

    // Головна цифра — target calories у hero
    const calLabel = "Ваша норма калорій";
    const calValue = `${result.targetCalories} ккал`;
    const calSub   = "на день для схуднення";

    // Картка всередині hero
    doc.save()
      .roundedRect(40, 118, PW - 80, 72, 14)
      .fillOpacity(0.15)
      .fill(C.white)
      .restore();

    // Reset opacity
    doc.fillOpacity(1);

    doc.fillColor(C.heroAccent).fontSize(10).text(calLabel.toUpperCase(), 65, 132, { characterSpacing: 1 });
    doc.fillColor(C.white).fontSize(36).text(calValue, 65, 146);
    doc.fillColor(C.textFaint).fontSize(10).text(calSub, 65, 186);

    // Піктограма вогню / авокадо праворуч (текстова)
    doc.fillColor(C.heroAccent).fontSize(48).text("🥑", PW - 130, 130);

    // ════════════════════════════════════════════════════════════════════════
    // 2. ФОН СТОРІНКИ
    // ════════════════════════════════════════════════════════════════════════
    doc.rect(0, HERO_H, PW, PH - HERO_H).fill(C.cream);

    // ════════════════════════════════════════════════════════════════════════
    // 3. СЕКЦІЯ КБЖВ — три картки
    // ════════════════════════════════════════════════════════════════════════
    const SEC1_Y = HERO_H + 30;

    // Заголовок секції
    doc.fillColor(C.text).fontSize(16)
      .text("Ваші кето КБЖВ", 40, SEC1_Y, { characterSpacing: 0.3 });

    divider(doc, 40, SEC1_Y + 24, PW - 80);

    const CARD_Y   = SEC1_Y + 38;
    const CARD_H   = 110;
    const CARD_GAP = 14;
    const CARD_W   = (PW - 80 - CARD_GAP * 2) / 3;  // ~161

    // ── Картка: Білки ─────────────────────────────────────────────
    const c1x = 40;
    roundedRect(doc, c1x, CARD_Y, CARD_W, CARD_H, 14, C.orangeLight);

    // Акцентна верхня смужка
    doc.save().roundedRect(c1x, CARD_Y, CARD_W, 5, [14, 14, 0, 0]).fill(C.orange).restore();

    doc.fillColor(C.orange).fontSize(10).text("БІЛКИ", c1x + 18, CARD_Y + 18, { characterSpacing: 1.5 });
    doc.fillColor(C.text).fontSize(30).text(`${result.protein} г`, c1x + 18, CARD_Y + 35);
    doc.fillColor(C.orange).fontSize(11)
      .text(`${result.proteinPercent}% від калорій`, c1x + 18, CARD_Y + 82);

    // ── Картка: Жири ──────────────────────────────────────────────
    const c2x = 40 + CARD_W + CARD_GAP;
    roundedRect(doc, c2x, CARD_Y, CARD_W, CARD_H, 14, C.greenLight);

    doc.save().roundedRect(c2x, CARD_Y, CARD_W, 5, [14, 14, 0, 0]).fill(C.green).restore();

    doc.fillColor(C.green).fontSize(10).text("ЖИРИ", c2x + 18, CARD_Y + 18, { characterSpacing: 1.5 });
    doc.fillColor(C.text).fontSize(30).text(`${result.fat} г`, c2x + 18, CARD_Y + 35);
    doc.fillColor(C.green).fontSize(11)
      .text(`${result.fatPercent}% від калорій`, c2x + 18, CARD_Y + 82);

    // ── Картка: Вуглеводи ─────────────────────────────────────────
    const c3x = 40 + (CARD_W + CARD_GAP) * 2;
    roundedRect(doc, c3x, CARD_Y, CARD_W, CARD_H, 14, C.purpleLight);

    doc.save().roundedRect(c3x, CARD_Y, CARD_W, 5, [14, 14, 0, 0]).fill(C.purple).restore();

    doc.fillColor(C.purple).fontSize(10).text("ВУГЛЕВОДИ", c3x + 18, CARD_Y + 18, { characterSpacing: 1.5 });
    doc.fillColor(C.text).fontSize(30).text(`${result.carbs} г`, c3x + 18, CARD_Y + 35);
    doc.fillColor(C.purple).fontSize(11)
      .text(`${result.carbsPercent}% від калорій`, c3x + 18, CARD_Y + 82);

    // ════════════════════════════════════════════════════════════════════════
    // 4. ПРОГРЕС-БАР (макрос)
    // ════════════════════════════════════════════════════════════════════════
    const BAR_Y = CARD_Y + CARD_H + 28;
    const BAR_W = PW - 80;
    const BAR_H = 14;

    // Підписи
    doc.fillColor(C.orange).fontSize(9).text("Білки 25%", 40, BAR_Y - 16);
    doc.fillColor(C.green).fontSize(9).text("Жири 70%", 40 + BAR_W * 0.25 + 4, BAR_Y - 16);
    doc.fillColor(C.purple).fontSize(9).text("Вуглеводи 5%", 40 + BAR_W * 0.95 - 58, BAR_Y - 16);

    // Трек
    doc.save().roundedRect(40, BAR_Y, BAR_W, BAR_H, 7).fill("#DDE9D8").restore();
    // Білки
    doc.save().roundedRect(40, BAR_Y, BAR_W * 0.25, BAR_H, 7).fill(C.orange).restore();
    // Жири
    doc.save().rect(40 + BAR_W * 0.25, BAR_Y, BAR_W * 0.70, BAR_H).fill(C.green).restore();
    // Вуглеводи
    doc.save().roundedRect(40 + BAR_W * 0.95, BAR_Y, BAR_W * 0.05, BAR_H, [0, 7, 7, 0]).fill(C.purple).restore();

    // ════════════════════════════════════════════════════════════════════════
    // 5. ДЕТАЛІ РОЗРАХУНКУ — два стовпці
    // ════════════════════════════════════════════════════════════════════════
    const SEC2_Y = BAR_Y + BAR_H + 36;

    doc.fillColor(C.text).fontSize(16)
      .text("Деталі розрахунку", 40, SEC2_Y, { characterSpacing: 0.3 });

    divider(doc, 40, SEC2_Y + 24, PW - 80);

    const DET_Y  = SEC2_Y + 38;
    const DET_H  = 150;
    const DET_W  = (PW - 80 - 14) / 2;

    // Картка — особисті дані
    roundedRect(doc, 40, DET_Y, DET_W, DET_H, 12, C.white);
    doc.save().rect(40, DET_Y, 4, DET_H).roundedRect(40, DET_Y, 4, DET_H, [2, 0, 0, 2]).fill(C.greenMid).restore();

    doc.fillColor(C.textMid).fontSize(10).text("ОСОБИСТІ ДАНІ", 58, DET_Y + 14, { characterSpacing: 1 });

    const rows1 = [
      ["Ім'я",   data.name || "-"],
      ["Вік",    `${data.age} років`],
      ["Вага",   `${data.weight} кг`],
      ["Зріст",  `${data.height} см`],
    ];

    rows1.forEach(([k, v], i) => {
      const ry = DET_Y + 34 + i * 26;
      doc.fillColor(C.textLight).fontSize(9).text(k, 58, ry);
      doc.fillColor(C.text).fontSize(11).text(v, 58 + 70, ry);
      if (i < rows1.length - 1) divider(doc, 58, ry + 18, DET_W - 36, "#F0F5EE");
    });

    // Картка — метаболічні показники
    const d2x = 40 + DET_W + 14;
    roundedRect(doc, d2x, DET_Y, DET_W, DET_H, 12, C.white);
    doc.save().rect(d2x, DET_Y, 4, DET_H).roundedRect(d2x, DET_Y, 4, DET_H, [2, 0, 0, 2]).fill(C.orange).restore();

    doc.fillColor(C.textMid).fontSize(10).text("МЕТАБОЛІЗМ", d2x + 18, DET_Y + 14, { characterSpacing: 1 });

    const rows2 = [
      ["BMR (базовий обмін)",       `${result.bmr} ккал`],
      ["TDEE (з активністю)",        `${result.tdee} ккал`],
      ["Ціль (−10%)",               `${result.targetCalories} ккал`],
    ];

    rows2.forEach(([k, v], i) => {
      const ry = DET_Y + 34 + i * 34;
      doc.fillColor(C.textLight).fontSize(9).text(k, d2x + 18, ry);
      doc.fillColor(C.text).fontSize(13).text(v, d2x + 18, ry + 12);
      if (i < rows2.length - 1) divider(doc, d2x + 18, ry + 28, DET_W - 36, "#F0F5EE");
    });

    // ════════════════════════════════════════════════════════════════════════
    // 6. DISCLAIMER / ПІДКАЗКА
    // ════════════════════════════════════════════════════════════════════════
    const NOTE_Y = DET_Y + DET_H + 28;

    roundedRect(doc, 40, NOTE_Y, PW - 80, 68, 12, C.greenLight);

    // Іконка-лампочка
    doc.fillColor(C.greenMid).fontSize(18).text("💡", 58, NOTE_Y + 22);

    doc.fillColor(C.textMid).fontSize(10).text(
      "Цей розрахунок є орієнтовною стартовою точкою. Спостерігайте за самопочуттям,\n" +
      "енергією, голодом і прогресом протягом 2–3 тижнів.",
      84, NOTE_Y + 14,
      { width: PW - 144, lineGap: 3 }
    );

    // ════════════════════════════════════════════════════════════════════════
    // 7. FOOTER
    // ════════════════════════════════════════════════════════════════════════
    const FT_Y = PH - 46;

    doc.rect(0, FT_Y - 8, PW, 54).fill(C.heroTop);

    doc.fillColor(C.heroAccent).fontSize(9)
      .text("Розрахунок не замінює консультацію лікаря або дієтолога.", 40, FT_Y + 4, {
        width: PW - 80,
        align: "center"
      });

    doc.fillColor(C.textFaint).fontSize(8)
      .text(`Сформовано автоматично • ${new Date().toLocaleDateString("uk-UA")}`, 40, FT_Y + 18, {
        width: PW - 80,
        align: "center"
      });

    doc.end();
  });
}

// ─── Telegram Sender ─────────────────────────────────────────────────────────

async function sendPdfToTelegram(chatId, pdfBuffer, fileName) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_KETO}/sendDocument`;

  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("caption", "Ваш кето-план готовий 🥑");

  const blob = new Blob([pdfBuffer], { type: "application/pdf" });
  formData.append("document", blob, fileName);

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Telegram error: ${JSON.stringify(json)}`);
  }

  return json;
}
