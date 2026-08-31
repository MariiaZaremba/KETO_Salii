import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

const PRODUCTS = {
  "guide-ig": {
    title: "Інтервальне голодування",
    amount: 23000,
    files: [
      {
        file: "guide-ig.pdf",
        caption: "Ваш матеріал готовий 💛"
      }
    ]
  },

  "how-to-start": {
    title: "Як почати КЕТО",
    amount: 23000,
    files: [
      {
        file: "how-to-start.pdf",
        caption: "Ваш матеріал готовий 💛"
      }
    ]
  },

  "products-list": {
    title: "Список продуктів",
    amount: 23000,
    files: [
      {
        file: "products-list.pdf",
        caption: "Ваш матеріал готовий 💛"
      }
    ]
  },

  tracker: {
    title: "Трекер замірів тіла",
    amount: 6500,
    files: [
      {
        file: "tracker.pdf",
        caption: "Ваш трекер готовий 💛"
      }
    ]
  },

  "menu-1500": {
    title: "КЕТО меню на 1500 ккал",
    amount: 69000,
    files: [
      {
        file: "menu-1500.pdf",
        caption: "Ваше КЕТО-меню готове 💛"
      }
    ]
  },

  "menu-1600": {
    title: "КЕТО меню на 1600 ккал",
    amount: 69000,
    files: [
      {
        file: "menu-1600.pdf",
        caption: "Ваше КЕТО-меню готове 💛"
      }
    ]
  },

  "menu-1700": {
    title: "КЕТО меню на 1700 ккал",
    amount: 69000,
    files: [
      {
        file: "menu-1700.pdf",
        caption: "Ваше КЕТО-меню готове 💛"
      }
    ]
  },

  "keto-laws": {
    title: "КЕТО харчування: Основні закони",
    amount: 23000,
    files: [
      {
        file: "keto-laws-mobile.pdf",
        caption: "📱 Електронна версія"
      },
      {
        file: "keto-laws-print.pdf",
        caption: "🖨 Версія для друку"
      }
    ]
  },

  "keto-meal-builder": {
    title: "Конструктор кето-раціону",
    amount: 59000,
    files: [
      {
        file: "keto-meal-builder-mobile.pdf",
        caption: "📱 Електронна версія для мобільного пристрою"
      },
      {
        file: "keto-meal-builder-print.pdf",
        caption: "🖨 Версія для друку"
      }
    ]
  },

  "keto-menu-lactose-free-1500": {
    title: "КЕТО-меню 1500 ккал без лактози",
    amount: 69000,
    files: [
      {
        file: "keto-menu-lactose-free-1500-mobile.pdf",
        caption: "📱 Електронна версія для мобільного пристрою"
      },
      {
        file: "keto-menu-lactose-free-1500-print.pdf",
        caption: "🖨 Версія для друку"
      }
    ]
  }
};

let cachedPublicKey = null;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => {
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

  const rawResponse = await response.text();

  if (!response.ok) {
    throw new Error(
      `Не вдалося отримати public key Monobank: ${rawResponse}`
    );
  }

  let publicKeyBase64 = rawResponse.trim();

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
    // Monobank повернув не JSON.
  }

  publicKeyBase64 = publicKeyBase64
    .trim()
    .replace(/^"+|"+$/g, "");

  const publicKeyPem = Buffer
    .from(publicKeyBase64, "base64")
    .toString("utf8")
    .trim();

  if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
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

async function verifyMonoSignature(rawBody, signatureBase64) {
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

async function sendTelegramMessage(chatId, text) {
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN_KETO;

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram message error: ${JSON.stringify(result)}`
    );
  }
}

async function sendPdfToTelegram(
  chatId,
  fileData,
  invoiceId,
  fileIndex
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

  const cacheVersion =
    `${invoiceId || Date.now()}-${fileIndex}`;

  const pdfUrl =
    `${appUrl}/products/` +
    `${encodeURIComponent(fileData.file)}` +
    `?v=${encodeURIComponent(cacheVersion)}`;

  console.log("Sending PDF:", {
    chatId,
    file: fileData.file,
    pdfUrl
  });

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        chat_id: chatId,
        document: pdfUrl,
        caption: fileData.caption || ""
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      `Telegram error: ${JSON.stringify(result)}`
    );
  }

  return result;
}

async function deliverProduct(chatId, product, invoiceId) {
  if (product.files.length > 1) {
    await sendTelegramMessage(
      chatId,
      `Оплата успішна 🎉\n\n` +
      `Дякуємо за покупку!\n\n` +
      `Ваш матеріал «${product.title}» готовий 💛\n\n` +
      `Нижче надсилаємо дві версії:\n` +
      `📱 для перегляду на мобільному пристрої\n` +
      `🖨 для друку`
    );
  }

  for (let i = 0; i < product.files.length; i++) {
    await sendPdfToTelegram(
      chatId,
      product.files[i],
      invoiceId,
      i
    );
  }
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

    const signature =
      req.headers["x-sign"] ||
      req.headers["X-Sign"];

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

    const payment = JSON.parse(
      rawBody.toString("utf8")
    );

    console.log("Monobank webhook received:", {
      invoiceId: payment.invoiceId,
      status: payment.status,
      amount: payment.amount,
      reference: payment.reference
    });

    if (payment.status !== "success") {
      return res.status(200).json({
        success: true,
        ignored: true,
        status: payment.status
      });
    }

    const referenceData =
      parseReference(payment.reference);

    if (!referenceData) {
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

    if (Number(payment.amount) !== product.amount) {
      return res.status(400).json({
        success: false,
        error: "Payment amount mismatch"
      });
    }

    await deliverProduct(
      chatId,
      product,
      payment.invoiceId
    );

    return res.status(200).json({
      success: true,
      delivered: true,
      invoiceId: payment.invoiceId,
      productId,
      chatId,
      filesSent: product.files.length
    });

  } catch (error) {
    console.error("Mono webhook error:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Webhook error"
    });
  }
}
