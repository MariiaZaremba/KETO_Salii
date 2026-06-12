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
        data.chat_id, pdfBuffer, `Кето_план_${data.name}_${today}.pdf`
      );
    }
    return res.status(200).json({ success: true, result, sentToTelegram: Boolean(data.chat_id), telegramResponse });
  } catch (error) {
    console.error("ERROR:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function calculateKeto(data) {
  const age = Number(data.age), weight = Number(data.weight);
  const height = Number(data.height), activity = Number(data.activity);
  const bmr = data.gender === "female"
    ? 10*weight + 6.25*height - 5*age - 161
    : 10*weight + 6.25*height - 5*age + 5;
  const tdee = bmr * activity;
  let targetCalories = Math.round((tdee * 0.9) / 100) * 100;
  if (targetCalories < bmr) targetCalories = Math.ceil(bmr / 100) * 100;
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), targetCalories: Math.round(targetCalories),
    protein: Math.round((targetCalories*0.25)/4), fat: Math.round((targetCalories*0.70)/9),
    carbs: Math.round((targetCalories*0.05)/4),
    proteinPercent: 25, fatPercent: 70, carbsPercent: 5
  };
}

function createPdfBuffer(data, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    
    const font = path.join(process.cwd(), "fonts", "NotoSans-Regular.ttf");

    const PW = doc.page.width;
    const PH = doc.page.height;

    const C = {
      heroTop:"#1A3C2A", heroBot:"#2D6A4F", heroCard:"#244D38", heroAccent:"#52B788", cream:"#F4F7F1",
      green:"#2D6A4F", greenLight:"#E6F2EB", greenMid:"#52B788",
      orange:"#D4692E", orangeLight:"#FEF0E6", purple:"#6254A0", purpleLight:"#EDEBF8",
      text:"#1A2E1A", textMid:"#3E5C40", textLight:"#6A8B6C", textFaint:"#9AB09C", white:"#FFFFFF",
    };

    const rr = (x,y,w,h,r,c) => { doc.save().roundedRect(x,y,w,h,r).fill(c).restore(); };
    const fr = (x,y,w,h,c)   => { doc.save().rect(x,y,w,h).fill(c).restore(); };
    const dv = (x,y,w,c="#E0EBD8") => {
      doc.save().moveTo(x,y).lineTo(x+w,y).strokeColor(c).lineWidth(0.75).stroke().restore();
    };

    // HERO
    const HERO_H = 215;
    fr(0, 0, PW, HERO_H - 50, C.heroTop);
    fr(0, HERO_H - 50, PW, 50, C.heroBot);
    doc.save().circle(PW - 50, -30, 140).fill("#162F22").restore();

    //doc.save().circle(54, 54, 22).fill(C.heroAccent).restore();
    //doc.font(font).fillColor(C.white).fontSize(16).text("К", 47, 45);

    doc.font(font).fillColor(C.white).fontSize(26)
      .text("Кето-план харчування", 40, 38, { lineBreak: false });
    doc.font(font).fillColor(C.heroAccent).fontSize(12)
      .text(`Персональний розрахунок для ${data.name || "клієнтки"}`, 40, 72);
    fr(40, 90, 140, 2, C.greenMid);

    rr(40, 108, PW - 80, 90, 14, C.heroCard);
    doc.font(font).fillColor(C.heroAccent).fontSize(9)
      .text("ВАША НОРМА КАЛОРIЙ", 65, 125, { characterSpacing: 1.2 });
    doc.font(font).fillColor(C.white).fontSize(32)
      .text(`${result.targetCalories} ккал`, 60, 135, { lineBreak: false });
    doc.font(font).fillColor(C.textFaint).fontSize(10)
      .text("* на день для схуднення", 85, 179);

    // Декоративні кола замість емодзі авокадо
    doc.save().circle(PW - 95, 155, 32).fill("#1E5C40").restore();
    doc.save().circle(PW - 95, 155, 20).fill("#2D7A54").restore();
    doc.save().circle(PW - 95, 155,  8).fill(C.heroAccent).restore();

    // ФОН
    fr(0, HERO_H, PW, PH - HERO_H, C.cream);

    // КБЖВ
    const SEC1_Y = HERO_H + 28;
    doc.font(font).fillColor(C.text).fontSize(14).text("Вашi кето БЖВ", 40, SEC1_Y);
    dv(40, SEC1_Y + 22, PW - 80);

    const CARD_Y = SEC1_Y + 34, CARD_H = 108, CARD_GAP = 13;
    const CARD_W = Math.floor((PW - 80 - CARD_GAP * 2) / 3);

    const cards = [
      { label:"БIЛКИ",     val:`${result.protein} г`, sub:`${result.proteinPercent}% вiд калорiй`, bg:C.orangeLight, accent:C.orange },
      { label:"ЖИРИ",      val:`${result.fat} г`,     sub:`${result.fatPercent}% вiд калорiй`,    bg:C.greenLight,  accent:C.green  },
      { label:"ВУГЛЕВОДИ", val:`${result.carbs} г`,   sub:`${result.carbsPercent}% вiд калорiй`,  bg:C.purpleLight, accent:C.purple },
    ];
    cards.forEach((card, i) => {
      const cx = 40 + i * (CARD_W + CARD_GAP);
      rr(cx, CARD_Y, CARD_W, CARD_H, 12, card.bg);
      fr(cx + 12, CARD_Y, CARD_W - 24, 4, card.accent);
      doc.font(font).fillColor(card.accent).fontSize(9)
        .text(card.label, cx + 16, CARD_Y + 16, { characterSpacing: 1.4 });
      doc.font(font).fillColor(C.text).fontSize(28).text(card.val, cx + 16, CARD_Y + 32);
      doc.font(font).fillColor(card.accent).fontSize(10).text(card.sub, cx + 16, CARD_Y + 80);
    });

    // ПРОГРЕС-БАР
    const BAR_Y = CARD_Y + CARD_H + 26, BAR_W = PW - 80, BAR_H = 12;
    doc.font(font).fillColor(C.orange).fontSize(8).text("Бiлки 25%", 40, BAR_Y - 14);
    doc.fillColor(C.green).text("Жири 70%", 40 + Math.round(BAR_W * 0.25) + 4, BAR_Y - 14);
    doc.fillColor(C.purple).text("Вуглеводи 5%", 40 + BAR_W - 62, BAR_Y - 14);
    rr(40, BAR_Y, BAR_W, BAR_H, 6, "#D5E8CC");
    const s1 = Math.round(BAR_W * 0.25), s2 = Math.round(BAR_W * 0.70), s3 = BAR_W - s1 - s2;
    rr(40, BAR_Y, s1, BAR_H, 6, C.orange);
    fr(40 + s1, BAR_Y, s2, BAR_H, C.green);
    rr(40 + s1 + s2, BAR_Y, s3, BAR_H, 6, C.purple);

    // ДЕТАЛI
    const SEC2_Y = BAR_Y + BAR_H + 32;
    doc.font(font).fillColor(C.text).fontSize(14).text("Деталi розрахунку", 40, SEC2_Y);
    dv(40, SEC2_Y + 22, PW - 80);

    const DET_Y = SEC2_Y + 34, DET_H = 148, DET_W = Math.floor((PW - 80 - 13) / 2), d2x = 40 + DET_W + 13;

    rr(40, DET_Y, DET_W, DET_H, 10, C.white);
    fr(40, DET_Y, 4, DET_H, C.greenMid);
    doc.font(font).fillColor(C.textMid).fontSize(9)
      .text("ОСОБИСТI ДАНI", 58, DET_Y + 14, { characterSpacing: 1 });
    [["Iм'я", data.name||"-"], ["Вiк",`${data.age} рокiв`], ["Вага",`${data.weight} кг`], ["Зрiст",`${data.height} см`]]
      .forEach(([k,v],i) => {
        const ry = DET_Y + 34 + i * 26;
        doc.font(font).fillColor(C.textLight).fontSize(8).text(k, 58, ry);
        doc.font(font).fillColor(C.text).fontSize(11).text(v, 130, ry);
        if (i < 3) dv(58, ry + 18, DET_W - 36, "#EDF5EA");
      });

    rr(d2x, DET_Y, DET_W, DET_H, 10, C.white);
    fr(d2x, DET_Y, 4, DET_H, C.orange);
    doc.font(font).fillColor(C.textMid).fontSize(9)
      .text("МЕТАБОЛIЗМ", d2x + 18, DET_Y + 14, { characterSpacing: 1 });
    [["BMR (базовий обмiн)",`${result.bmr} ккал`], ["TDEE (з активнiстю)",`${result.tdee} ккал`], ["Цiль (-10%)",`${result.targetCalories} ккал`]]
      .forEach(([k,v],i) => {
        const ry = DET_Y + 34 + i * 34;
        doc.font(font).fillColor(C.textLight).fontSize(8).text(k, d2x + 18, ry);
        doc.font(font).fillColor(C.text).fontSize(12).text(v, d2x + 18, ry + 13);
        if (i < 2) dv(d2x + 18, ry + 28, DET_W - 36, "#EDF5EA");
      });

    // ПРИМIТКА
    const NOTE_Y = DET_Y + DET_H + 24;
    rr(40, NOTE_Y, PW - 80, 66, 10, C.greenLight);
    fr(40, NOTE_Y, 4, 66, C.greenMid);
    // Ромб-іконка замість емодзі
    doc.save()
      .polygon([60, NOTE_Y+24], [68, NOTE_Y+16], [76, NOTE_Y+24], [68, NOTE_Y+32])
      .fill(C.greenMid).restore();
    doc.font(font).fillColor(C.textMid).fontSize(10).text(
      "Цей розрахунок є орiєнтовною стартовою точкою. Спостерiгайте за самопочуттям, " +
      "енергiєю, голодом i прогресом протягом 2-3 тижнiв.",
      84, NOTE_Y + 13, { width: PW - 140, lineGap: 3 }
    );

    // FOOTER
    const FT_Y = PH - 44;
    fr(0, FT_Y - 6, PW, 50, C.heroTop);
    doc.font(font).fillColor(C.heroAccent).fontSize(9).text(
      "Розрахунок не замiнює консультацiю лiкаря або дiєтолога.",
      40, FT_Y + 5, { width: PW - 80, align: "center" }
    );
    doc.fillColor(C.textFaint).fontSize(8).text(
      `Сформовано автоматично  ${new Date().toLocaleDateString("uk-UA")}`,
      40, FT_Y + 19, { width: PW - 80, align: "center" }
    );

    doc.end();
  });
}

async function sendPdfToTelegram(chatId, pdfBuffer, fileName) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_KETO}/sendDocument`;
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  formData.append("caption", "Ваш кето-план готовий");
  formData.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), fileName);
  const response = await fetch(url, { method: "POST", body: formData });
  const json = await response.json();
  if (!response.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`);
  return json;
}
