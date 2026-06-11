const API_URL =
  "https://script.google.com/macros/s/AKfycbzqff59sQiDqr_SotdVfvb3mHCutXOThv-wJBQpskIRAt46785xJZ2tMMOHLB9p_4FfdA/exec";

const tg = window.Telegram?.WebApp;
const user = tg?.initDataUnsafe?.user;

document.getElementById("ketoForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const data = {
    name: document.getElementById("name").value,
    gender: document.getElementById("gender").value,
    age: document.getElementById("age").value,
    weight: document.getElementById("weight").value,
    height: document.getElementById("height").value,
    activity: document.getElementById("activity").value,
    chat_id: user?.id
  };

  const resultDiv = document.getElementById("result");

  resultDiv.classList.remove("hidden");
  resultDiv.innerHTML = "<p>⏳ Рахуємо...</p>";

  try {
    const response = await fetch(API_URL, {
  method: "POST",
  body: JSON.stringify(data)
});

    const responseData = await response.json();

    resultDiv.innerHTML = `
      <h2>${data.name}, ваш розрахунок готовий 🎉</h2>

      <p><strong>Калорії:</strong> ${responseData.result.targetCalories} ккал</p>
      <p><strong>Білки:</strong> ${responseData.result.protein} г</p>
      <p><strong>Жири:</strong> ${responseData.result.fat} г</p>
      <p><strong>Вуглеводи:</strong> ${responseData.result.carbs} г</p>

      <br>

      <a href="${responseData.pdfUrl}"
         target="_blank"
         style="
           display:inline-block;
           background:#222;
           color:white;
           padding:14px 20px;
           border-radius:12px;
           text-decoration:none;
         ">
         Завантажити PDF
      </a>
    `;
  } catch (error) {
    console.error(error);

    resultDiv.innerHTML = `
      <p>❌ Помилка при створенні PDF.</p>
    `;
  }
});
