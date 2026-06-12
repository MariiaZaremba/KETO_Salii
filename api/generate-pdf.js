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
    `Кето_розрахунок_${data.name}_${today}.pdf`
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

    doc.fontSize(22).text("Ваш кето-розрахунок", { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Ім’я: ${data.name || "-"}`);
    doc.text(`Вік: ${data.age}`);
    doc.text(`Вага: ${data.weight} кг`);
    doc.text(`Зріст: ${data.height} см`);

    doc.moveDown();
    doc.fontSize(16).text("Результат");
    doc.moveDown(0.5);

    doc.fontSize(12);
    doc.text(`BMR: ${result.bmr} ккал`);
    doc.text(`TDEE: ${result.tdee} ккал`);
    doc.text(`Калорії для схуднення: ${result.targetCalories} ккал/день`);

    doc.moveDown();
    doc.fontSize(16).text("Кето КБЖВ");
    doc.moveDown(0.5);

    doc.fontSize(12);
    doc.text(`Білки: ${result.protein} г — ${result.proteinPercent}%`);
    doc.text(`Жири: ${result.fat} г — ${result.fatPercent}%`);
    doc.text(`Вуглеводи: ${result.carbs} г — ${result.carbsPercent}%`);

    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray");
    doc.text("Розрахунок є орієнтовним і не замінює консультацію лікаря або дієтолога.");

    doc.end();
  });
}

async function sendPdfToTelegram(chatId, pdfBuffer, fileName) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_KETO}/sendDocument`;

  const formData = new FormData();

  formData.append("chat_id", String(chatId));
  formData.append("caption", "Ваш кето-розрахунок готовий 🥑");

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
