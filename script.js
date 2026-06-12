const API_URL = "/api/generate-pdf";

const params = new URLSearchParams(window.location.search);
const chatIdFromUrl = params.get("chat_id");

const form = document.getElementById("ketoForm");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const data = {
    name: document.getElementById("name").value,
    gender: document.getElementById("gender").value,
    age: document.getElementById("age").value,
    weight: document.getElementById("weight").value,
    height: document.getElementById("height").value,
    activity: document.getElementById("activity").value,
    chat_id: chatIdFromUrl
  };

  const formData = new FormData();
  formData.append("payload", JSON.stringify(data));

  const resultDiv = document.getElementById("result");
  resultDiv.classList.remove("hidden");
  resultDiv.innerHTML = "<p>⏳ Рахуємо...</p>";

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    });

    resultDiv.innerHTML = `
      <h2>Готово 🎉</h2>
      <p>PDF має прийти в чат протягом кількох секунд.</p>
    `;
  } catch (error) {
    console.error("PDF error:", error);

    resultDiv.innerHTML = `
      <p>❌ Помилка при створенні PDF.</p>
      <pre>${error.message}</pre>
    `;
  }
});
