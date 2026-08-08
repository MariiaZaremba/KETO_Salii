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


/* =========================
   READ RAW WEBHOOK BODY
========================= */

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


/* =========================
   MONOBANK PUBLIC KEY
========================= */

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

  const rawResponse = await response.text();

  if (!response.ok) {
    throw new Error(
      `Не вдалося отримати public key Monobank: ${rawResponse}`
    );
  }

  let publicKeyBase64 = rawResponse.trim();

  /*
    На випадок, якщо Monobank поверне JSON
    замість простого текстового рядка.
  */
  try {
    const parsedResponse = JSON.parse(rawResponse);

    if (typeof parsedResponse === "string") {
      publicKeyBase64 = parsedResponse;
    } else if (parsedResponse?.key) {
      publicKeyBase64 = parsedResponse.key;
    } else if (parsedResponse?.pubkey) {
      publicKeyBase64 = parsedResponse.pubkey;
    }
  } catch {
    // Це нормально — використовуємо rawResponse.
  }

  publicKeyBase64 = publicKeyBase64
    .trim()
    .replace(/^"+|"+$/g, "");

  const publicKeyPem = Buffer
    .from(publicKeyBase64, "base64")
    .toString("utf8")
    .trim();

  if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
    console.error(
      "Decoded Monobank key has unexpected format"
    );

    throw new Error(
      "Monobank повернув public key у неправильному форматі"
    );
  }

  cachedPublicKey = crypto.createPublicKey({
    key: publicKeyPem,
    format: "pem",
    type: "spki"
  });

  return cachedPublicKey;
}


/* =========================
   VERIFY MONOBANK SIGNATURE
========================= */

async function verifyMonoSignature(
  rawBody,
  signatureBase64
) {
  if (!signatureBase64) {
    return false;
  }

  const publicKey = await getMonoPublicKey();

  const signature = Buffer.from(
    String(signatureBase64).trim(),
    "base64"
  );

  return crypto.verify(
    "sha256",
    rawBody,
    publicKey,
    signature
  );
}


/* =========================
   PAYMENT REFERENCE

   Format:
   tg_CHATID_PRODUCTID_TIMESTAMP
========================= */

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


/* =========================
   SEND PDF TO TELEGRAM
========================= */

async function sendPdfToTelegram(
  chatId,
  product,
  invoiceId
) {
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN_KETO;

  const appUrl =
    process.env.APP_URL_KETO?.replace(/\/$/, "");

  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN_KETO відсутній у Vercel"
    );
  }

  if (!appUrl) {
    throw new Error(
      "APP_URL_KETO відсутній у Vercel"
    );
  }

  /*
    ВАЖЛИВО:
    додаємо унікальний query parameter.

    Це не дає Telegram / CDN використати
    стару закешовану версію PDF.
  */

  const cacheVersion =
    invoiceId || Date.now();

  const pdfUrl =
    `${appUrl}/products/` +
    `${encodeURIComponent(product.file)}` +
    `?v=${encodeURIComponent(cacheVersion)}`;

  console.log("Sending PDF:", {
    chatId,
    file: product.file,
    pdfUrl
  });

  const telegramUrl =
    `https://api.telegram.org/bot` +
    `${botToken}/sendDocument`;

  const response = await fetch(
    telegramUrl,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,

        document: pdfUrl,

        caption:
          `Оплата успішна 🎉\n\n` +
          `Дякуємо за покупку!\n\n` +
          `Ваш матеріал «${product.title}» готовий 💛`
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error(
      "Telegram response:",
      result
    );

    throw new Error(
      `Telegram error: ${JSON.stringify(result)}`
    );
  }

  console.log(
    "PDF successfully sent to Telegram",
    {
      chatId,
      product: product.file
    }
  );

  return result;
}


/* =========================
   MAIN WEBHOOK HANDLER
========================= */

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    /* -------------------------
       1. READ ORIGINAL BODY
    ------------------------- */

    const rawBody =
      await readRawBody(req);

    const signature =
      req.headers["x-sign"] ||
      req.headers["X-Sign"];

    /* -------------------------
       2. VERIFY MONOBANK
    ------------------------- */

    const signatureIsValid =
      await verifyMonoSignature(
        rawBody,
        signature
      );

    if (!signatureIsValid) {
      console.error(
        "Invalid Monobank webhook signature"
      );

      return res.status(401).json({
        success: false,
        error: "Invalid signature"
      });
    }

    /* -------------------------
       3. PARSE PAYMENT
    ------------------------- */

    const payment = JSON.parse(
      rawBody.toString("utf8")
    );

    console.log(
      "Monobank webhook received:",
      {
        invoiceId: payment.invoiceId,
        status: payment.status,
        amount: payment.amount,
        reference: payment.reference
      }
    );

    /* -------------------------
       4. ONLY SUCCESSFUL PAYMENT
    ------------------------- */

    if (payment.status !== "success") {
      return res.status(200).json({
        success: true,
        ignored: true,
        status: payment.status
      });
    }

    /* -------------------------
       5. GET CHAT + PRODUCT
    ------------------------- */

    const referenceData =
      parseReference(
        payment.reference
      );

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

    const {
      chatId,
      productId
    } = referenceData;

    const product =
      PRODUCTS[productId];

    if (!product) {
      console.error(
        "Unknown product:",
        productId
      );

      return res.status(400).json({
        success: false,
        error: "Product not found"
      });
    }

    /* -------------------------
       6. CHECK AMOUNT
    ------------------------- */

    if (
      Number(payment.amount) !==
      product.amount
    ) {
      console.error(
        "Payment amount mismatch",
        {
          received:
            payment.amount,

          expected:
            product.amount,

          productId
        }
      );

      return res.status(400).json({
        success: false,
        error: "Payment amount mismatch"
      });
    }

    /* -------------------------
       7. SEND PDF
    ------------------------- */

    await sendPdfToTelegram(
      chatId,
      product,
      payment.invoiceId
    );

    /* -------------------------
       8. SUCCESS RESPONSE
    ------------------------- */

    return res.status(200).json({
      success: true,
      delivered: true,
      invoiceId:
        payment.invoiceId,

      productId,
      chatId
    });

  } catch (error) {

    console.error(
      "Mono webhook error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Webhook error"
    });
  }
}
