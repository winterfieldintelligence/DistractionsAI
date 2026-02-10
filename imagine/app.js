document.addEventListener("DOMContentLoaded", () => {
  const viewHome = document.getElementById("viewHome");
  const viewResult = document.getElementById("viewResult");
  const generateBtn = document.getElementById("generateBtn");
  const sendBtn = document.getElementById("sendBtn");
  const promptInput = document.getElementById("promptInput");
  const promptInputBottom = document.getElementById("promptInputBottom");
  const resultImage = document.getElementById("resultImage");
  const loadingState = document.getElementById("loadingState");
  const resultBubble = document.getElementById("resultBubble");
  const resultPrompt = document.getElementById("resultPrompt");
  const resultCaption = document.getElementById("resultCaption");
  const navNew = document.getElementById("navNew");
  const sliderTrack = document.getElementById("sliderTrack");
  const sliderDots = document.getElementById("sliderDots");
  const fileModal = document.getElementById("fileModal");
  const addFiles = document.getElementById("addFiles");
  const addFilesTop = document.getElementById("addFilesTop");
  const closeModal = document.getElementById("closeModal");
  const browseBtn = document.getElementById("browseBtn");
  const fileInput = document.getElementById("fileInput");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarClose = document.getElementById("sidebarClose");
  const resultCard = document.getElementById("resultCard");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadSingleBtn = document.getElementById("downloadSingleBtn");
  const recentList = document.getElementById("recentList");


  let slideIndex = 0;
  let notesData = { topics: [] };
  let historyItems = [];
  const MAX_HISTORY = 24;

  const basePath = (() => {
    const path = window.location.pathname;
    if (path.endsWith("/")) return path;
    if (path.endsWith("/index.html")) return path.replace("/index.html", "/");
    return path.substring(0, path.lastIndexOf("/") + 1);
  })();

  function withBase(src) {
    if (!src) return src;
    if (src.startsWith("http") || src.startsWith("data:")) return src;
    if (src.startsWith("/")) return src;
    return `${basePath}${src}`;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem("daiNotesHistory");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) historyItems = parsed;
    } catch (_err) {
      historyItems = [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem("daiNotesHistory", JSON.stringify(historyItems.slice(0, MAX_HISTORY)));
    } catch (_err) {
      // ignore quota errors
    }
  }

  function addHistoryItem(item) {
    if (!item || !item.prompt || !item.images || !item.images.length) return;
    const signature = `${item.prompt}|${item.images[0]}`;
    historyItems = historyItems.filter((h) => `${h.prompt}|${h.images[0]}` !== signature);
    historyItems.unshift(item);
    historyItems = historyItems.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (!recentList) return;
    recentList.innerHTML = "";
    if (!historyItems.length) return;

    historyItems.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "recent-item";
      btn.type = "button";

      const img = document.createElement("img");
      img.src = withBase(item.images[0]);
      img.alt = item.prompt;
      img.loading = "lazy";

      const span = document.createElement("span");
      span.textContent = item.prompt;

      btn.appendChild(img);
      btn.appendChild(span);
      btn.addEventListener("click", () => showHistoryItem(item));

      recentList.appendChild(btn);
    });
  }

  function showHistoryItem(item) {
    if (!item) return;
    const promptText = item.prompt || "Previous image";
    if (resultPrompt) resultPrompt.textContent = promptText;
    if (resultCaption) resultCaption.textContent = promptText;
    if (resultBubble) resultBubble.textContent = promptText;
    setView("result");

    const grid = resultCard?.querySelector(".result-grid");
    if (grid) grid.style.display = "none";

    if (loadingState) loadingState.style.display = "none";

    if (item.type === "grid") {
      showHistoryGrid(item);
      return;
    }

    if (resultImage) {
      resultImage.style.display = "block";
      resultImage.src = withBase(item.images[0]);
      resultImage.alt = promptText;
    }
  }

  function showHistoryGrid(item) {
    const grid = ensureResultGrid();
    if (!grid) return;
    if (resultImage) resultImage.style.display = "none";
    grid.innerHTML = "";
    item.images.forEach((src, idx) => {
      const card = createImageCard(src, `${item.prompt || "Notes"} ${idx + 1}`);
      grid.appendChild(card);
    });
    grid.style.display = "grid";
  }


  function downloadImages(urls, baseName = "notes") {
    urls.forEach((url, idx) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}-${String(idx + 1).padStart(2, "0")}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }

  downloadSingleBtn?.addEventListener("click", () => {
    if (resultImage && resultImage.src) {
      downloadImages([resultImage.src], "image");
    }
  });

  downloadBtn?.addEventListener("click", () => {
    const grid = resultCard?.querySelector(".result-grid");
    if (grid && grid.style.display !== "none") {
      const images = Array.from(grid.querySelectorAll("img"))
        .map((img) => img.src)
        .filter(Boolean);
      if (images.length) {
        downloadImages(images, "notes");
        return;
      }
    }

    if (resultImage && resultImage.src) {
      downloadImages([resultImage.src], "image");
    }
  });

  function createImageCard(src, altText) {
    const card = document.createElement("div");
    card.className = "image-card";

    const img = document.createElement("img");
    img.src = withBase(src);
    img.alt = altText;
    img.loading = "lazy";

    const actions = document.createElement("div");
    actions.className = "image-actions";

    const btn = document.createElement("button");
    btn.className = "icon-action";
    btn.type = "button";
    btn.setAttribute("aria-label", "Download image");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    btn.addEventListener("click", () => {
      downloadImages([img.src], "notes");
    });

    actions.appendChild(btn);
    card.appendChild(img);
    card.appendChild(actions);

    return card;
  }
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setView(view) {
    if (!viewHome || !viewResult) return;
    if (view === "home") {
      viewHome.classList.remove("hidden");
      viewResult.classList.add("hidden");
    } else {
      viewHome.classList.add("hidden");
      viewResult.classList.remove("hidden");
    }
  }

  function rotateSlides() {
    if (!sliderTrack || !sliderDots) return;
    slideIndex = (slideIndex + 1) % 3;
    sliderTrack.style.transform = `translateX(-${slideIndex * 100}%)`;
    Array.from(sliderDots.children).forEach((dot, idx) => {
      dot.classList.toggle("active", idx === slideIndex);
    });
  }

  setInterval(rotateSlides, 3500);

  function openModal() {
    if (fileModal) fileModal.classList.remove("hidden");
  }

  function closeModalFn() {
    if (fileModal) fileModal.classList.add("hidden");
  }

  addFiles?.addEventListener("click", openModal);
  addFilesTop?.addEventListener("click", openModal);
  closeModal?.addEventListener("click", closeModalFn);

  browseBtn?.addEventListener("click", () => fileInput?.click());

  fileModal?.addEventListener("click", (e) => {
    if (e.target === fileModal) closeModalFn();
  });

  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  sidebarClose?.addEventListener("click", () => {
    sidebar?.classList.remove("open");
  });

  navNew?.addEventListener("click", () => {
    setView("home");
  });

  function loadNotesData() {
    return (async () => {
    try {
      let res = await fetch(`${basePath}notes.json`, { cache: "no-store" });
      if (!res.ok) {
        res = await fetch("notes.json", { cache: "no-store" });
      }
      if (!res.ok) {
        res = await fetch("/imagine/notes.json", { cache: "no-store" });
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.topics)) notesData = data;
    } catch (_err) {
      notesData = { topics: [] };
    }
  })();
  }

  function normalizeText(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function findTopicMatch(prompt) {
    const norm = normalizeText(prompt);
    if (!norm) return null;

    for (const topic of notesData.topics || []) {
      const promptSet = new Set((topic.prompts || []).map((p) => normalizeText(p)));
      if (promptSet.has(norm)) return topic;

      const contains = (topic.match_contains || []).some((phrase) =>
        norm.includes(normalizeText(phrase))
      );
      if (contains) return topic;

      const keywords = topic.match_keywords || [];
      if (keywords.length) {
        const all = keywords.every((word) => norm.includes(normalizeText(word)));
        if (all) return topic;
      }
    }

    return null;
  }

  function ensureResultGrid() {
    if (!resultCard) return null;
    let grid = resultCard.querySelector(".result-grid");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "result-grid";
      resultCard.appendChild(grid);
    }
    return grid;
  }

  function showNotesImages(topic) {
    const grid = ensureResultGrid();
    if (!grid) return;

    if (resultImage) resultImage.style.display = "none";
    grid.innerHTML = "";
    const images = topic.images || [];
    images.forEach((src, idx) => {
      const card = createImageCard(src, `${topic.title || "Notes"} ${idx + 1}`);
      grid.appendChild(card);
    });
    grid.style.display = "grid";
  }

  async function handleGenerate(prompt, fallbackText = "New image") {
    await notesReady;
    if (!prompt) prompt = fallbackText;
    if (resultPrompt) resultPrompt.textContent = prompt;
    if (resultCaption) resultCaption.textContent = prompt;
    if (resultBubble) resultBubble.textContent = prompt;
    setView("result");

    if (resultImage) {
      resultImage.style.display = "none";
      resultImage.src = "";
      resultImage.alt = "Generating...";
    }

    const grid = resultCard?.querySelector(".result-grid");
    if (grid) grid.style.display = "none";

    if (loadingState) loadingState.style.display = "grid";
    const startTime = Date.now();

    const topic = findTopicMatch(prompt);
    if (topic) {
      // small delay so loading animation shows
      setTimeout(() => {
        showNotesImages(topic);
        if (loadingState) loadingState.style.display = "none";
        addHistoryItem({
          id: Date.now(),
          prompt,
          type: "grid",
          images: topic.images || []
        });
      }, 5000);
      return;
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.image_url && resultImage) {
        resultImage.src = data.image_url;
        resultImage.alt = prompt;
      } else if (resultImage) {
        resultImage.src = "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=900&q=60";
        resultImage.alt = "Fallback";
      }
    } catch (err) {
      if (resultImage) {
        resultImage.src = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=60";
        resultImage.alt = "Fallback";
      }
    } finally {
      const elapsed = Date.now() - startTime;
      if (elapsed < 5000) {
        await delay(5000 - elapsed);
      }
      if (loadingState) loadingState.style.display = "none";
      if (resultImage) resultImage.style.display = "block";
      if (resultImage && resultImage.src) {
        addHistoryItem({
          id: Date.now(),
          prompt,
          type: "single",
          images: [resultImage.src]
        });
      }
    }
  }

  window.forceGenerate = handleGenerate;

  generateBtn?.addEventListener("click", () => {
    const fallback = promptInput?.placeholder || "New image";
    handleGenerate(promptInput?.value.trim() || "", fallback);
  });

  sendBtn?.addEventListener("click", () => {
    const fallback = promptInputBottom?.placeholder || "New image";
    handleGenerate(promptInputBottom?.value.trim() || "", fallback);
  });

  const notesReady = loadNotesData();
  loadHistory();
  renderHistory();
});
