document.getElementById("ketoForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const gender = document.getElementById("gender").value;
  const age = Number(document.getElementById("age").value);
  const weight = Number(document.getElementById("weight").value);
  const height = Number(document.getElementById("height").value);
  const activity = Number(document.getElementById("activity").value);

  let bmr;

  if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  }

  const tdee = bmr * activity;
  const calories = tdee * 0.9;

  const carbs = 25;
  const protein = weight * 1.6;

  const carbsCalories = carbs * 4;
  const proteinCalories = protein * 4;
  const fatCalories = calories - carbsCalories - proteinCalories;
  const fat = fatCalories / 9;

  const resultDiv = document.getElementById("result");

  resultDiv.innerHTML = `
    <h2>${name}, ваш розрахунок:</h2>
    <p><strong>BMR:</strong> ${Math.round(bmr)} ккал</p>
    <p><strong>TDEE:</strong> ${Math.round(tdee)} ккал</p>
    <p><strong>Калорії для схуднення:</strong> ${Math.round(calories)} ккал</p>
    <hr>
    <p><strong>Білки:</strong> ${Math.round(protein)} г</p>
    <p><strong>Жири:</strong> ${Math.round(fat)} г</p>
    <p><strong>Вуглеводи:</strong> ${carbs} г</p>
  `;

  resultDiv.classList.remove("hidden");
});
