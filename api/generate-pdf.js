import PDFDocument from "pdfkit";
import path from "path";

const TELEGRAM_BOT_TOKEN_KETO = process.env.TELEGRAM_BOT_TOKEN_KETO;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const data = req.body?.payload ? JSON.parse(req.body.payload) : req.body;
    if (!data) throw new Error("No data received");

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

// ─── Calculation ─────────────────────────────────────────────────────────────

function calculateKeto(data) {
  const gender   = data.gender;
  const age      = Number(data.age);
  const weight   = Number(data.weight);
  const height   = Number(data.height);
  const activity = Number(data.activity);

  const bmr = gender === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;

  const tdee = bmr * activity;
  let targetCalories = Math.round((tdee * 0.9) / 100) * 100;
  if (targetCalories < bmr) targetCalories = Math.ceil(bmr / 100) * 100;

  return {
    bmr:            Math.round(bmr),
    tdee:           Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    protein:        Math.round((targetCalories * 0.25) / 4),
    fat:            Math.round((targetCalories * 0.70) / 9),
    carbs:          Math.round((targetCalories * 0.05) / 4),
    proteinPercent: 25,
    fatPercent:     70,
    carbsPercent:   5
  };
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

/** Rounded rect fill — always uses save/restore to avoid state leaks */
function rr(doc, x, y, w, h, r, color) {
  doc.save().roundedRect(x, y, w, h, r).fill(color).restore();
}

/** Plain rect fill */
function fr(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

/** Horizontal divider */
function divider(doc, x, y, w, color = "#E0EBD8") {
  doc.save()
    .moveTo(x, y).lineTo(x + w, y)
    .strokeColor(color).lineWidth(0.75).stroke()
    .restore();
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

function createPdfBuffer(data, result) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 0, size: "A4" });
    const chunks = [];
    doc.on("data",  c => chunks.push(c));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(process.cwd(), "fonts", "NotoSans-Regular.ttf");
    doc.font(fontPath);

    const PW = doc.page.width;   // 595.28
    const PH = doc.page.height;  // 841.89

    // ── Палітра ──────────────────────────────────────────────────────────
    const C = {
      heroTop:      "#1A3C2A",
      heroBot:      "#2D6A4F",
      heroCard:     "#244D38",   // картка всередині hero (непрозора)
      heroAccent:   "#52B788",
      cream:        "#F4F7F1",

      green:        "#2D6A4F",
      greenLight:   "#E6F2EB",
      greenMid:     "#52B788",

      orange:       "#D4692E",
      orangeLight:  "#FEF0E6",

      purple:       "#6254A0",
      purpleLight:  "#EDEBF8",

      text:         "#1A2E1A",
      textMid:      "#3E5C40",
      textLight:    "#6A8B6C",
      textFaint:    "#9AB09C",
      white:        "#FFFFFF",
    };

    // ════════════════════════════════════════════════════════════════════
    // 1. HERO
    // ════════════════════════════════════════════════════════════════════
    const HERO_H = 215;

    fr(doc, 0, 0,          PW, HERO_H - 50, C.heroTop);
    fr(doc, 0, HERO_H - 50, PW, 50,         C.heroBot);

    // Декоративні кола (суцільний колір з низьким lightness — без opacity)
    doc.save().circle(PW - 50, -30, 140).fill("#162F22").restore();
    doc.save().circle(PW + 10,  90,  90).fill("#1E4232").restore();
    doc.save().circle(25,  HERO_H + 5, 75).fill("#223A2C").restore();

    // Логотип
    doc.save().circle(54, 54, 22).fill(C.heroAccent).restore();
    doc.fillColor(C.white).fontSize(18).text("К", 46, 44);

    // Заголовок
    doc.fillColor(C.white).fontSize(28)
      .text("Кето-план харчування", 90, 38, { lineBreak: false });
    doc.fillColor(C.heroAccent).fontSize(12)
      .text(`Персональний розрахунок для ${data.name || "клієнтки"}`, 90, 74);

    // Підкреслення-акцент
    fr(doc, 90, 92, 140, 2, C.greenMid);

    // Картка калорій — непрозорий темніший фон (без fillOpacity)
    rr(doc, 40, 112, PW - 80, 78, 14, C.heroCard);

    doc.fillColor(C.heroAccent).fontSize(9)
      .text("ВАША НОРМА КАЛОРІЙ", 66, 126, { characterSpacing: 1.2 });

    doc.fillColor(C.white).fontSize(34)
      .text(`${result.targetCalories} ккал`, 66, 142, { lineBreak: false });

    doc.fillColor(C.textFaint).fontSize(10)
      .text("на день для схуднення", 66, 181);

    // Авокадо
    doc.fillColor(C.heroAccent).fontSize(42).text("🥑", PW - 120, 134);

    // ════════════════════════════════════════════════════════════════════
    // 2. ФОН
    // ════════════════════════════════════════════════════════════════════
    fr(doc, 0, HERO_H, PW, PH - HERO_H, C.cream);

    // ════════════════════════════════════════════════════════════════════
    // 3. КБЖВ — три картки
    // ════════════════════════════════════════════════════════════════════
    const SEC1_Y = HERO_H + 28;

    doc.fillColor(C.text).fontSize(14)
      .text("Ваші кето КБЖВ", 40, SEC1_Y);
    divider(doc, 40, SEC1_Y + 22, PW - 80);

    const CARD_Y   = SEC1_Y + 34;
    const CARD_H   = 108;
    const CARD_GAP = 13;
    const CARD_W   = Math.floor((PW - 80 - CARD_GAP * 2) / 3);

    const cards = [
      { label: "БІЛКИ",     value: `${result.protein} г`,  sub: `${result.proteinPercent}% від калорій`, bg: C.orangeLight, accent: C.orange },
      { label: "ЖИРИ",      value: `${result.fat} г`,      sub: `${result.fatPercent}% від калорій`,    bg: C.greenLight,  accent: C.green  },
      { label: "ВУГЛЕВОДИ", value: `${result.carbs} г`,    sub: `${result.carbsPercent}% від калорій`,  bg: C.purpleLight, accent: C.purple },
    ];

    cards.forEach((card, i) => {
      const cx = 40 + i * (CARD_W + CARD_GAP);

      rr(doc, cx, CARD_Y, CARD_W, CARD_H, 12, card.bg);

      // Верхня смужка (окремий прямокутник зверху)
      fr(doc, cx + 12, CARD_Y, CARD_W - 24, 4, card.accent);

      doc.fillColor(card.accent).fontSize(9)
        .text(card.label, cx + 16, CARD_Y + 16, { characterSpacing: 1.4 });
      doc.fillColor(C.text).fontSize(28)
        .text(card.value, cx + 16, CARD_Y + 32);
      doc.fillColor(card.accent).fontSize(10)
        .text(card.sub, cx + 16, CARD_Y + 80);
    });

    // ════════════════════════════════════════════════════════════════════
    // 4. ПРОГРЕС-БАР
    // ════════════════════════════════════════════════════════════════════
    const BAR_Y = CARD_Y + CARD_H + 24;
    const BAR_W = PW - 80;
    const BAR_H = 12;

    // Підписи
    doc.fillColor(C.orange).fontSize(8).text("Білки 25%", 40, BAR_Y - 14);
    doc.fillColor(C.green).fontSize(8)
      .text("Жири 70%", 40 + Math.round(BAR_W * 0.25) + 4, BAR_Y - 14);
    doc.fillColor(C.purple).fontSize(8)
      .text("Вуглеводи 5%", 40 + Math.round(BAR_W * 0.95) - 60, BAR_Y - 14);

    // Трек
    rr(doc, 40, BAR_Y, BAR_W, BAR_H, 6, "#D5E8CC");

    // Сегменти (цілі числа — без float артефактів)
    const seg1w = Math.round(BAR_W * 0.25);
    const seg2w = Math.round(BAR_W * 0.70);
    const seg3w = BAR_W - seg1w - seg2w;

    rr(doc,  40,               BAR_Y, seg1w, BAR_H, 6, C.orange);
    fr(doc,  40 + seg1w,       BAR_Y, seg2w, BAR_H,    C.green);
    rr(doc,  40 + seg1w + seg2w, BAR_Y, seg3w, BAR_H, 6, C.purple);

    // ════════════════════════════════════════════════════════════════════
    // 5. ДЕТАЛІ — два стовпці
    // ════════════════════════════════════════════════════════════════════
    const SEC2_Y = BAR_Y + BAR_H + 32;

    doc.fillColor(C.text).fontSize(14)
      .text("Деталі розрахунку", 40, SEC2_Y);
    divider(doc, 40, SEC2_Y + 22, PW - 80);

    const DET_Y = SEC2_Y + 34;
    const DET_H = 148;
    const DET_W = Math.floor((PW - 80 - 13) / 2);
    const d2x   = 40 + DET_W + 13;

    // ── Картка ліва (особисті дані) ───────────────────────────────────
    rr(doc, 40, DET_Y, DET_W, DET_H, 10, C.white);
    fr(doc, 40, DET_Y, 4, DET_H, C.greenMid);

    doc.fillColor(C.textMid).fontSize(9)
      .text("ОСОБИСТІ ДАНІ", 58, DET_Y + 14, { characterSpacing: 1 });

    const rows1 = [
      ["Ім'я",  data.name     || "-"],
      ["Вік",   `${data.age} років`],
      ["Вага",  `${data.weight} кг`],
      ["Зріст", `${data.height} см`],
    ];

    rows1.forEach(([k, v], i) => {
      const ry = DET_Y + 34 + i * 26;
      doc.fillColor(C.textLight).fontSize(8).text(k, 58, ry);
      doc.fillColor(C.text).fontSize(11).text(v, 130, ry);
      if (i < rows1.length - 1) divider(doc, 58, ry + 18, DET_W - 36, "#EDF5EA");
    });

    // ── Картка права (метаболізм) ──────────────────────────────────────
    rr(doc, d2x, DET_Y, DET_W, DET_H, 10, C.white);
    fr(doc, d2x, DET_Y, 4, DET_H, C.orange);

    doc.fillColor(C.textMid).fontSize(9)
      .text("МЕТАБОЛІЗМ", d2x + 18, DET_Y + 14, { characterSpacing: 1 });

    const rows2 = [
      ["BMR (базовий обмін)", `${result.bmr} ккал`],
      ["TDEE (з активністю)", `${result.tdee} ккал`],
      ["Ціль (−10%)",         `${result.targetCalories} ккал`],
    ];

    rows2.forEach(([k, v], i) => {
      const ry = DET_Y + 34 + i * 34;
      doc.fillColor(C.textLight).fontSize(8).text(k,  d2x + 18, ry);
      doc.fillColor(C.text).fontSize(12).text(v, d2x + 18, ry + 13);
      if (i < rows2.length - 1) divider(doc, d2x + 18, ry + 28, DET_W - 36, "#EDF5EA");
    });

    // ════════════════════════════════════════════════════════════════════
    // 6. ПРИМІТКА
    // ════════════════════════════════════════════════════════════════════
    const NOTE_Y = DET_Y + DET_H + 24;

    rr(doc, 40, NOTE_Y, PW - 80, 66, 10, C.greenLight);
    fr(doc, 40, NOTE_Y, 4, 66, C.greenMid);

    doc.fillColor(C.greenMid).fontSize(16).text("💡", 56, NOTE_Y + 21);
    doc.fillColor(C.textMid).fontSize(10).text(
      "Цей розрахунок є орієнтовною стартовою точкою. Спостерігайте за самопочуттям, " +
      "енергією, голодом і прогресом протягом 2–3 тижнів.",
      82, NOTE_Y + 13,
      { width: PW - 140, lineGap: 3 }
    );

    // ════════════════════════════════════════════════════════════════════
    // 7. FOOTER
    // ════════════════════════════════════════════════════════════════════
    const FT_Y = PH - 44;

    fr(doc, 0, FT_Y - 6, PW, 50, C.heroTop);

    doc.fillColor(C.heroAccent).fontSize(9).text(
      "Розрахунок не замінює консультацію лікаря або дієтолога.",
      40, FT_Y + 5, { width: PW - 80, align: "center" }
    );
    doc.fillColor(C.textFaint).fontSize(8).text(
      `Сформовано автоматично · ${new Date().toLocaleDateString("uk-UA")}`,
      40, FT_Y + 19, { width: PW - 80, align: "center" }
    );

    doc.end();
  });
}

// ─── Telegram ────────────────────────────────────────────────────────────────

async function sendPdfToTelegram(chatId, pdfBuffer, fileName) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_KETO}/sendDocument`;
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("caption", "Ваш кето-план готовий 🥑");
  formData.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), fileName);

  const response = await fetch(url, { method: "POST", body: formData });
  const json = await response.json();
  if (!response.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`);
  return json;
}
