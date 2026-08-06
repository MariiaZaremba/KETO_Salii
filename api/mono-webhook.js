import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

const PRODUCTS = {
  "guide-ig": {
    title: "Гайд «Інтервальне голодування»",
    amount: 23000,
    file: "guide-ig.pdf"
  },

  "how-to-start": {
    title: "Чек-лист «Як почати КЕТО»",
    amount: 23000,
    file: "how-to-start.pdf"
  },

  "products-list": {
    title: "Список продуктів для КЕТО",
    amount: 23000,
    file: "products-list.pdf"
  },

  tracker: {
    title: "Трекер замірів тіла",
    amount: 6500,
    file: "tracker.pdf"
  },

  "menu-1500": {
    title: "КЕТО меню на 1500 ккал",
    amount: 69000,
    file: "menu-1500.pdf"
  },

  "menu-1600": {
    title: "КЕТО меню на 1600 ккал",
    amount: 69000,
    file: "menu-1600.pdf"
  },

  "menu-1700": {
    title: "КЕТО меню на 1700 ккал",
    amount: 69000,
    file: "menu-1700.pdf"
  }
};

let cachedPublicKey = null;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

async function getMonoPublicKey() {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  const response = await fetch(
    "https://api.monobank.ua/api/merchant/pubkey",
    {
      method: "GET",
      headers: {
        "X-Token": process.env.MONO_TOKEN_KETO
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Не вдалося отримати public key Monobank: ${text}`
    );
  }

  const publicKeyBase64 = await response.text();

  cachedPublicKey = Buffer
    .from(publicKeyBase64, "base64")
    .toString("utf8");

  return cachedPublicKey;
}

async function verifyMonoSignature(rawBody, signatureBase64) {
  if (!signatureBase64) {
    return false;
  }

  const publicKey = await getMonoPublicKey();

  const verifier = crypto.createVerify("SHA256");

  verifier.update(rawBody);
  verifier.end();

  return verifier.verify(
    publicKey,
    Buffer.from(signatureBase64, "base64")
  );
}

function parseReference(reference) {
  const match = String(reference || "").match(
    /^tg_(\d+)_([a-z0-9-]+)_(\d+)$/
  );

  if (!match) {
    return null;
  }

  return {
    chatId: match[1],
    productId: match[2],
    timestamp: match[3]
  };
}

async function sendPdfToTelegram(chatId, product) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN_KETO;
  const appUrl = process.env.APP_URL_KETO.replace(/\/$/, "");

  const pdfUrl =
    `${appUrl}/products/${encodeURIComponent(product.file)}`;

  const telegramUrl =
    `https://api.telegram.org/bot${botToken}/sendDocument`;

  const response = await fetch(telegramUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      document: pdfUrl,
      caption:
        `Оплата успішна 🎉\n\n` +
        `Дякуємо за покупку!\n` +
        `Ваш матеріал «${product.title}» готовий 💛`
    })
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram error: ${JSON.stringify(result)}`
    );
  }

  return result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-sign"];

    const signatureIsValid = await verifyMonoSignature(
      rawBody,
      signature
    );

    if (!signatureIsValid) {
      console.error("Invalid Monobank webhook signature");

      return res.status(401).json({
        success: false,
        error: "Invalid signature"
      });
    }

    const payment = JSON.parse(rawBody.toString("utf8"));

    console.log("Monobank webhook:", payment);

    /*
      Webhook приходить при кожній зміні статусу.
      PDF видаємо тільки після успішної оплати.
    */
    if (payment.status !== "success") {
      return res.status(200).json({
        success: true,
        ignored: true,
        status: payment.status
      });
    }

    const referenceData = parseReference(payment.reference);

    if (!referenceData) {
      console.error(
        "Invalid payment reference:",
        payment.reference
      );

      return res.status(400).json({
        success: false,
        error: "Invalid reference"
      });
    }

    const { chatId, productId } = referenceData;
    const product = PRODUCTS[productId];

    if (!product) {
      return res.status(400).json({
        success: false,
        error: "Product not found"
      });
    }

    /*
      Додаткова перевірка:
      оплачена сума повинна відповідати ціні товару.
    */
    if (Number(payment.amount) !== product.amount) {
      console.error("Payment amount mismatch", {
        received: payment.amount,
        expected: product.amount
      });

      return res.status(400).json({
        success: false,
        error: "Payment amount mismatch"
      });
    }

    await sendPdfToTelegram(chatId, product);

    return res.status(200).json({
      success: true,
      delivered: true,
      productId,
      chatId
    });

  } catch (error) {
    console.error("Mono webhook error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Webhook error"
    });
  }
}
