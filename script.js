const API_URL = "https://script.google.com/macros/s/AKfycbzqff59sQiDqr_SotdVfvb3mHCutXOThv-wJBQpskIRAt46785xJZ2tMMOHLB9p_4FfdA/exec";

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

  console.log(data);

  const resultDiv = document.getElementById("result");
  resultDiv.classList.remove("hidden");
  resultDiv.innerHTML = "<p>⏳ Рахуємо...</p>";

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(data)
    });

    resultDiv.innerHTML = `
      <h2>Готово 🎉</h2>
      <p>Якщо все спрацювало, PDF має прийти в чат.</p>
    `;
  } catch (error) {
    console.error("PDF error:", error);

    resultDiv.innerHTML = `
      <p>❌ Помилка при створенні PDF.</p>
      <pre>${error.message}</pre>
    `;
  }
});
