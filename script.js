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

  const resultDiv = document.getElementById("result");
  resultDiv.classList.remove("hidden");
  resultDiv.innerHTML = "<p>⏳ Рахуємо...</p>";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Помилка при створенні PDF");
    }

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
