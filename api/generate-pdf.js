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

    return res.status(500).json({
      success: false,
      error: error.message
    });
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

function createPdfBuffer(data, result) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(process.cwd(), "fonts","NotoSans-Regular.ttf");
    doc.font(fontPath);

    doc.rect(0, 0, doc.page.width, 140).fill("#EEF7E8");


    doc.circle(63, 58, 13).fill("#7BA05B");
doc.fillColor("#FFFFFF").fontSize(14).text("K", 58, 51);

doc.fillColor("#1F3D2B");
doc.fontSize(28).text("Кето-план", 90, 45);

doc.fontSize(12).fillColor("#4F6F52");
    doc.text(`${data.name || "клієнтки"}, це ваш персональний розрахунок`);

doc.moveDown();

doc.fillColor("#1F1F1F");

doc.roundedRect(50, 170, 495, 95, 16).fill("#F8FBF5");
doc.fillColor("#6A8F4E").fontSize(12).text("Калорійність для схуднення", 75, 195);
doc.fillColor("#1F3D2B").fontSize(34).text(`${result.targetCalories} ккал/день`, 75, 215);

doc.fillColor("#1F1F1F").fontSize(16).text("Ваші кето КБЖВ", 50, 310);

const boxY = 345;
const boxW = 155;
const gap = 15;

doc.roundedRect(50, boxY, boxW, 90, 14).fill("#FFF7E8");
doc.fillColor("#8A5A00").fontSize(12).text("Білки", 70, boxY + 18);
doc.fillColor("#1F1F1F").fontSize(24).text(`${result.protein} г`, 70, boxY + 42);
doc.fontSize(10).fillColor("#777").text(`${result.proteinPercent}% калорій`, 70, boxY + 68);

doc.roundedRect(50 + boxW + gap, boxY, boxW, 90, 14).fill("#EEF7E8");
doc.fillColor("#4F6F52").fontSize(12).text("Жири", 70 + boxW + gap, boxY + 18);
doc.fillColor("#1F1F1F").fontSize(24).text(`${result.fat} г`, 70 + boxW + gap, boxY + 42);
doc.fontSize(10).fillColor("#777").text(`${result.fatPercent}% калорій`, 70 + boxW + gap, boxY + 68);

doc.roundedRect(50 + (boxW + gap) * 2, boxY, boxW, 90, 14).fill("#F1F5F9");
doc.fillColor("#475569").fontSize(12).text("Вуглеводи", 70 + (boxW + gap) * 2, boxY + 18);
doc.fillColor("#1F1F1F").fontSize(24).text(`${result.carbs} г`, 70 + (boxW + gap) * 2, boxY + 42);
doc.fontSize(10).fillColor("#777").text(`${result.carbsPercent}% калорій`, 70 + (boxW + gap) * 2, boxY + 68);

doc.fillColor("#1F1F1F").fontSize(16).text("Деталі розрахунку", 50, 480);

doc.fontSize(12).fillColor("#333");
doc.text(`Ім’я: ${data.name || "-"}`, 50, 515);
doc.text(`Вік: ${data.age}`);
doc.text(`Вага: ${data.weight} кг`);
doc.text(`Зріст: ${data.height} см`);

doc.text(`BMR: ${result.bmr} ккал`, 300, 515);
doc.text(`TDEE: ${result.tdee} ккал`);
doc.text(`Ціль: ${result.targetCalories} ккал/день`);

doc.roundedRect(50, 635, 495, 80, 14).fill("#FAFAFA");
doc.fillColor("#555").fontSize(11).text(
  "Цей розрахунок є орієнтовною стартовою точкою. Спостерігайте за самопочуттям, енергією, голодом і прогресом протягом 2–3 тижнів.",
  70,
  655,
  { width: 455 }
);

doc.fillColor("#999").fontSize(9).text(
  "Розрахунок не замінює консультацію лікаря або дієтолога.",
  50,
  760,
  { align: "center" }
);
    doc.end();
  });
}

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
