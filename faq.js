const items = document.querySelectorAll(".item");

items.forEach((item) => {
  const question = item.querySelector(".question");

  question.addEventListener("click", () => {
    item.classList.toggle("active");
  });
});
