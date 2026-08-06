const telegram = window.Telegram?.WebApp;

if (telegram) {
  telegram.ready();
  telegram.expand();

  telegram.setHeaderColor("#f7f4ea");
  telegram.setBackgroundColor("#f7f4ea");
}

const productCards = [...document.querySelectorAll(".product-card")];
const filterButtons = [...document.querySelectorAll(".filter-button")];

const searchInput = document.getElementById("productSearch");
const productCount = document.getElementById("productCount");
const emptyState = document.getElementById("emptyState");

const modal = document.getElementById("productModal");
const modalOverlay = document.getElementById("modalOverlay");
const closeModalButton = document.getElementById("closeModal");

const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const modalBuyButton = document.getElementById("modalBuyButton");

let activeFilter = "all";
let activeProductLink = "#";

function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replaceAll("ё", "е");
}

function getProductWord(count) {
  if (count === 1) {
    return "товар";
  }

  if (count >= 2 && count <= 4) {
    return "товари";
  }

  return "товарів";
}

function updateProducts() {
  const searchValue = normalizeText(searchInput.value);

  let visibleCount = 0;

  productCards.forEach((card) => {
    const title = normalizeText(card.dataset.title || "");
    const description = normalizeText(card.dataset.description || "");
    const category = card.dataset.category;

    const matchesFilter =
      activeFilter === "all" || category === activeFilter;

    const matchesSearch =
      !searchValue ||
      title.includes(searchValue) ||
      description.includes(searchValue);

    const shouldShow = matchesFilter && matchesSearch;

    card.classList.toggle("hidden", !shouldShow);

    if (shouldShow) {
      visibleCount += 1;
    }
  });

  productCount.textContent =
    `${visibleCount} ${getProductWord(visibleCount)}`;

  emptyState.classList.toggle("hidden", visibleCount !== 0);
}

function setActiveFilter(selectedButton) {
  filterButtons.forEach((button) => {
    button.classList.remove("active");
  });

  selectedButton.classList.add("active");
  activeFilter = selectedButton.dataset.filter;

  telegram?.HapticFeedback?.selectionChanged();

  updateProducts();
}

function openProductModal(card) {
  const title = card.dataset.title || "";
  const description = card.dataset.description || "";
  const price = card.dataset.price || "";
  const image = card.dataset.image || "";
  const buyLink = card.dataset.buyLink || "#";

  modalTitle.textContent = title;
  modalDescription.textContent = description;
  modalPrice.textContent = price;

  modalImage.src = image;
  modalImage.alt = title;

  activeProductLink = buyLink;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  telegram?.HapticFeedback?.impactOccurred("light");
}

function closeProductModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");

  activeProductLink = "#";
}

function openPurchaseFlow(event) {
  event.preventDefault();

  if (!activeProductLink || activeProductLink === "#") {
    if (telegram?.showAlert) {
      telegram.showAlert(
        "Оплата для цього товару ще налаштовується."
      );
    } else {
      alert("Оплата для цього товару ще налаштовується.");
    }

    return;
  }

  telegram?.HapticFeedback?.impactOccurred("medium");

  if (telegram?.openTelegramLink && activeProductLink.includes("t.me")) {
    telegram.openTelegramLink(activeProductLink);
    return;
  }

  if (telegram?.openLink) {
    telegram.openLink(activeProductLink);
    return;
  }

  window.location.href = activeProductLink;
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button);
  });
});

searchInput.addEventListener("input", updateProducts);

productCards.forEach((card) => {
  const openButton = card.querySelector(".product-open");

  openButton.addEventListener("click", () => {
    openProductModal(card);
  });
});

closeModalButton.addEventListener("click", closeProductModal);
modalOverlay.addEventListener("click", closeProductModal);
modalBuyButton.addEventListener("click", openPurchaseFlow);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeProductModal();
  }
});

updateProducts();
