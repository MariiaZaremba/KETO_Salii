import crypto from "crypto";

const PRODUCTS = {
  "guide-ig": {
    title: "Інтервальне голодування",
    amount: 23000
  },

  "how-to-start": {
    title: "Як почати КЕТО",
    amount: 23000
  },

  "products-list": {
    title: "Список продуктів",
    amount: 23000
  },

  tracker: {
    title: "Трекер замірів тіла",
    amount: 6500
  },

  "menu-1500": {
    title: "КЕТО меню на 1500 ккал",
    amount: 69000
  },

  "menu-1600": {
    title: "КЕТО меню на 1600 ккал",
    amount: 69000
  },

  "menu-1700": {
    title: "КЕТО меню на 1700 ккал",
    amount: 69000
  },

  "keto-laws": {
    title: "КЕТО харчування: Основні закони",
    amount: 23000
  },

  "keto-meal-builder": {
    title: "Конструктор кето-раціону",
    amount: 59000
  },

  "keto-menu-lactose-free-1500": {
    title: "КЕТО-меню 1500 ккал без лактози",
    amount: 69000
  }
};

function validateTelegramInitData(initData, botToken) {
  if (!initData || !botToken) {
    return null;
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    return null;
  }

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedHash, "hex");
  const calculatedBuffer = Buffer.from(calculatedHash, "hex");

  if (
    receivedBuffer.length !== calculatedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, calculatedBuffer)
  ) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));

  if (!authDate) {
    return null;
  }

  const ageInSeconds = Math.floor(Date.now() / 1000) - authDate;

  if (ageInSeconds > 60 * 60) {
    return null;
  }

  const userData = params.get("user");

  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch {
    return null;
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
    const { productId, initData } = req.body || {};

    const product = PRODUCTS[productId];

    if (!product) {
      return res.status(400).json({
        success: false,
        error: "Товар не знайдено"
      });
    }

    const telegramUser = validateTelegramInitData(
      initData,
      process.env.TELEGRAM_BOT_TOKEN_KETO
    );

    if (!telegramUser?.id) {
      return res.status(401).json({
        success: false,
        error:
          "Не вдалося підтвердити користувача Telegram. Відкрийте магазин через Mini App у боті."
      });
    }

    const reference =
      `tg_${telegramUser.id}_${productId}_${Date.now()}`;

    const monoResponse = await fetch(
      "https://api.monobank.ua/api/merchant/invoice/create",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "X-Token": process.env.MONO_TOKEN_KETO
        },

        body: JSON.stringify({
          amount: product.amount,
          ccy: 980,

          merchantPaymInfo: {
            reference,
            destination: product.title,
            comment: `PDF-матеріал: ${product.title}`
          },

          redirectUrl:
            `${process.env.APP_URL_KETO}/payment-success.html`,

          webHookUrl:
            `${process.env.APP_URL_KETO}/api/mono-webhook`,

          validity: 3600,
          paymentType: "debit"
        })
      }
    );

    const monoData = await monoResponse.json();

    if (!monoResponse.ok) {
      console.error("Monobank error:", monoData);

      return res.status(monoResponse.status).json({
        success: false,
        error:
          monoData?.errText ||
          monoData?.message ||
          "Monobank не створив рахунок"
      });
    }

    return res.status(200).json({
      success: true,
      invoiceId: monoData.invoiceId,
      pageUrl: monoData.pageUrl
    });

  } catch (error) {
    console.error("Create payment error:", error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Помилка створення оплати"
    });
  }
}
