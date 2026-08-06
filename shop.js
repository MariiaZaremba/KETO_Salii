const telegram = window.Telegram?.WebApp;

if (telegram) {
  telegram.ready();
  telegram.expand();

  telegram.setHeaderColor("#f7f4ea");
  telegram.setBackgroundColor("#f7f4ea");
}

const productsGrid = document.getElementById("productsGrid");
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
let activeProduct = null;

function formatPrice(price) {
  return `${price} грн`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replaceAll("ё", "е");
}

function getProductWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return "товар";
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "товари";
  }

  return "товарів";
}

function createProductCard(product) {
  const card = document.createElement("article");

  card.className = "product-card";
  card.dataset.productId = product.id;
  card.dataset.category = product.category;

  card.innerHTML = `
    <button
      class="product-open"
      type="button"
      aria-label="Відкрити ${product.title}"
    >
      <div class="product-image">
        <img
          src="${product.image}"
          alt="${product.imageAlt}"
        />

        <span class="product-badge ${product.badgeClass}">
          ${product.badge}
        </span>
      </div>

      <div class="product-info">
        <h3>${product.cardTitle}</h3>

        <p>${product.shortDescription}</p>

        <div class="product-bottom">
          <strong>${formatPrice(product.price)}</strong>
          <span class="details-link">Детальніше →</span>
        </div>
      </div>
    </button>
  `;

  card
    .querySelector(".product-open")
    .addEventListener("click", () => {
      openProductModal(product);
    });

  return card;
}

function renderProducts() {
  const searchValue = normalizeText(searchInput.value);

  const visibleProducts = PRODUCTS.filter((product) => {
    const matchesFilter =
      activeFilter === "all" ||
      product.category === activeFilter;

    const searchableText = normalizeText(
      [
        product.title,
        product.cardTitle,
        product.shortDescription,
        product.description
      ].join(" ")
    );

    const matchesSearch =
      !searchValue ||
      searchableText.includes(searchValue);

    return matchesFilter && matchesSearch;
  });

  productsGrid.innerHTML = "";

  visibleProducts.forEach((product) => {
    productsGrid.appendChild(createProductCard(product));
  });

  productCount.textContent =
    `${visibleProducts.length} ${getProductWord(visibleProducts.length)}`;

  emptyState.classList.toggle(
    "hidden",
    visibleProducts.length !== 0
  );
}

function setActiveFilter(selectedButton) {
  filterButtons.forEach((button) => {
    button.classList.remove("active");
  });

  selectedButton.classList.add("active");
  activeFilter = selectedButton.dataset.filter;

  telegram?.HapticFeedback?.selectionChanged();

  renderProducts();
}

function openProductModal(product) {
  activeProduct = product;

  modalTitle.textContent = product.title;
  modalDescription.textContent = product.description;
  modalPrice.textContent = formatPrice(product.price);

  modalImage.src = product.image;
  modalImage.alt = product.imageAlt;

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  telegram?.HapticFeedback?.impactOccurred("light");
}

function closeProductModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open");

  activeProduct = null;
}

async function startPurchase(event) {
  event.preventDefault();

  if (!activeProduct) {
    return;
  }

  telegram?.HapticFeedback?.impactOccurred("medium");

  alert(
    `Наступним кроком підключимо оплату для товару:\n${activeProduct.title}`
  );
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button);
  });
});

searchInput.addEventListener("input", renderProducts);

closeModalButton.addEventListener("click", closeProductModal);
modalOverlay.addEventListener("click", closeProductModal);
modalBuyButton.addEventListener("click", startPurchase);

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !modal.classList.contains("hidden")
  ) {
    closeProductModal();
  }
});

renderProducts();
