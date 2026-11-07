// Wrapped-style retrospective: story slides plus a 1080x1920 image for Instagram Stories.
(function initRetrospective(window, document) {
  const Storage = window.WikibandStorage;
  const Safe = window.WikibandSafe;
  const stage = document.getElementById("wrappedStage");
  const YEAR = new Date().getFullYear();
  const SLIDE_MS = 6500;
  const PREVIEW_SECONDS = 30;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalize(text) {
    return String(text || "").trim().toLowerCase();
  }

  // ---------- Data ----------

  function imageForArtist(name, sources) {
    const wanted = normalize(name);
    return sources.find((item) => normalize(item.nome) === wanted && item.imagem)?.imagem || "";
  }

  function topAlbums(plays, favorites) {
    const counter = new Map();

    [...favorites.map((item) => ({ ...item, weight: 2 })), ...plays.map((item) => ({ ...item, weight: 1 }))].forEach((item) => {
      if (!item.album || !item.imagem) return;
      const key = `${normalize(item.nome)}|${normalize(item.album)}`;
      const entry = counter.get(key) || { album: item.album, nome: item.nome, imagem: item.imagem, total: 0 };
      entry.total += item.weight;
      counter.set(key, entry);
    });

    return [...counter.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }

  function collectData() {
    const dashboard = Storage.getDashboardData();
    const plays = Storage.getPlayHistory();
    const albumFavorites = Storage.getAlbumFavorites();
    const bandFavorites = Storage.getBandFavorites();
    const imageSources = [...albumFavorites, ...bandFavorites, ...plays];
    const session = Storage.getCurrentSession();

    return {
      nome: session?.nome || "Você",
      username: session?.username || "",
      plays: dashboard.totals.plays,
      minutes: Math.max(1, Math.round((dashboard.totals.plays * PREVIEW_SECONDS) / 60)),
      favorites: dashboard.totals.albumFavorites + dashboard.totals.bandFavorites,
      collections: dashboard.totals.collections,
      artists: dashboard.topArtists
        .filter((entry) => entry.label && entry.label !== "Nao informado" && entry.label !== "Artista desconhecido")
        .slice(0, 5)
        .map((entry) => ({ ...entry, imagem: imageForArtist(entry.label, imageSources) })),
      genres: dashboard.topGenres.filter((entry) => entry.label !== "Nao informado").slice(0, 5),
      decade: dashboard.topDecades.find((entry) => entry.label !== "Nao informado")?.label || "",
      albums: topAlbums(plays, albumFavorites)
    };
  }

  // ---------- Slides ----------

  function slide(theme, ...children) {
    const node = element("section", `story-slide ${theme}`);
    const body = element("div", "story-body");
    body.append(...children);
    node.appendChild(body);
    return node;
  }

  function reveal(node, delay) {
    node.classList.add("reveal");
    node.style.setProperty("--delay", `${delay}ms`);
    return node;
  }

  function cover(url, className = "story-cover") {
    const image = element("img", className);
    image.src = Safe.safeImageUrl(url);
    image.alt = "";
    image.crossOrigin = "anonymous";
    return image;
  }

  function rankList(items, render) {
    const list = element("ol", "story-rank");
    items.forEach((item, index) => {
      const row = reveal(element("li"), 300 + index * 160);
      row.append(element("span", "story-rank-n", String(index + 1)), ...render(item));
      list.appendChild(row);
    });
    return list;
  }

  function buildSlides(data) {
    const slides = [];
    const [top] = data.artists;

    slides.push(
      slide(
        "theme-intro",
        reveal(element("span", "story-kicker", "Wikiband"), 0),
        reveal(element("h1", "story-title", `Sua retrospectiva ${YEAR}`), 200),
        reveal(element("p", "story-text", `${data.nome}, bora relembrar o que embalou seu ano?`), 500),
        reveal(element("p", "story-hint", "Toque para avançar →"), 900)
      )
    );

    slides.push(
      slide(
        "theme-minutes",
        reveal(element("span", "story-kicker", "Você deu play em"), 0),
        reveal(element("strong", "story-big", String(data.plays)), 200),
        reveal(element("p", "story-text", `prévias — cerca de ${data.minutes} minutos descobrindo música na Wikiband.`), 500),
        reveal(element("p", "story-text dim", `${data.favorites} favoritos e ${data.collections} coleções no caminho.`), 800)
      )
    );

    if (top) {
      const art = element("div", "story-art-wrap");
      art.appendChild(cover(top.imagem, "story-art"));
      slides.push(
        slide(
          "theme-artist",
          reveal(element("span", "story-kicker", "Seu artista nº1"), 0),
          reveal(art, 200),
          reveal(element("h2", "story-title", top.label), 500),
          reveal(element("p", "story-text dim", "Ninguém tocou tanto no seu repeat."), 800)
        )
      );
    }

    if (data.artists.length > 1) {
      slides.push(
        slide(
          "theme-top",
          reveal(element("span", "story-kicker", "Seus artistas mais ouvidos"), 0),
          rankList(data.artists, (artist) => {
            const thumb = cover(artist.imagem, "story-thumb");
            return [thumb, element("span", "story-rank-name", artist.label)];
          })
        )
      );
    }

    if (data.genres.length) {
      slides.push(
        slide(
          "theme-genre",
          reveal(element("span", "story-kicker", "Seu gênero do ano"), 0),
          reveal(element("h2", "story-title huge", data.genres[0].label), 200),
          data.genres.length > 1
            ? reveal(element("p", "story-text dim", `Depois vieram ${data.genres.slice(1, 3).map((g) => g.label).join(" e ")}.`), 600)
            : element("span")
        )
      );
    }

    if (data.decade) {
      slides.push(
        slide(
          "theme-decade",
          reveal(element("span", "story-kicker", "Seu coração mora nos"), 0),
          reveal(element("strong", "story-big", data.decade), 200),
          reveal(element("p", "story-text dim", "A década que mais aparece nos seus favoritos."), 600)
        )
      );
    }

    if (data.albums.length) {
      slides.push(
        slide(
          "theme-albums",
          reveal(element("span", "story-kicker", "Álbuns que marcaram"), 0),
          rankList(data.albums, (album) => [
            cover(album.imagem, "story-thumb square"),
            (() => {
              const text = element("span", "story-rank-name");
              text.append(element("strong", "", album.album), element("small", "", album.nome));
              return text;
            })()
          ])
        )
      );
    }

    slides.push(buildSummarySlide(data));
    return slides;
  }

  function buildSummarySlide(data) {
    const card = element("div", "story-summary");
    const columns = element("div", "story-summary-cols");

    const col = (title, items) => {
      const box = element("div");
      box.appendChild(element("span", "story-summary-title", title));
      const list = element("ol");
      items.forEach((item) => list.appendChild(element("li", "", item)));
      box.appendChild(list);
      return box;
    };

    columns.append(
      col("Top artistas", data.artists.map((a) => a.label)),
      col("Top gêneros", data.genres.slice(0, 5).map((g) => g.label))
    );

    const stats = element("div", "story-summary-stats");
    [["Prévias", String(data.plays)], ["Década", data.decade || "—"]].forEach(([label, value]) => {
      const box = element("div");
      box.append(element("span", "", label), element("strong", "", value));
      stats.appendChild(box);
    });

    card.append(element("span", "story-kicker", `Retrospectiva ${YEAR}`), columns, stats);

    const actions = element("div", "story-actions");
    const shareStory = element("button", "primary-btn", "Compartilhar no Story");
    const download = element("button", "secondary-btn", "Baixar imagem");
    const copy = element("button", "ghost-btn", "Copiar texto");
    [shareStory, download, copy].forEach((button) => {
      button.type = "button";
      button.dataset.noAdvance = "1";
    });

    shareStory.addEventListener("click", () => shareImage(data, shareStory));
    download.addEventListener("click", () => downloadImage(data, download));
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(summaryText(data));
        window.WikibandUI?.toast("Texto copiado");
      } catch (error) {
        window.WikibandUI?.toast("Não foi possível copiar.");
      }
    });

    actions.append(shareStory, download, copy);
    return slide("theme-summary", card, actions);
  }

  function summaryText(data) {
    const artists = data.artists.slice(0, 3).map((a, i) => `${i + 1}. ${a.label}`).join("\n");
    return `Minha retrospectiva ${YEAR} na Wikiband 🎧\n${artists}\nGênero: ${data.genres[0]?.label || "—"}\n${window.location.origin}`;
  }

  // ---------- Story player ----------

  function startStories(slides) {
    let index = 0;
    let timer = null;
    let startedAt = 0;
    let elapsed = 0;
    let paused = false;

    const viewer = element("div", "story-viewer");
    const bars = element("div", "story-bars");
    const fills = slides.map(() => {
      const bar = element("span", "story-bar");
      const fill = element("span");
      bar.appendChild(fill);
      bars.appendChild(bar);
      return fill;
    });

    const close = element("a", "story-close", "Fechar");
    close.href = "/favoritos.html";
    close.dataset.noAdvance = "1";

    viewer.append(bars, close, ...slides);
    stage.replaceChildren(viewer);

    function show(next) {
      index = Math.max(0, Math.min(slides.length - 1, next));
      slides.forEach((node, i) => node.classList.toggle("is-active", i === index));
      fills.forEach((fill, i) => {
        fill.style.transition = "none";
        fill.style.width = i < index ? "100%" : "0%";
      });
      elapsed = 0;
      run();
    }

    function run() {
      clearTimeout(timer);
      const isLast = index === slides.length - 1;
      const fill = fills[index];
      // Force the reset to apply before animating the bar.
      void fill.offsetWidth;
      fill.style.transition = `width ${SLIDE_MS - elapsed}ms linear`;
      fill.style.width = "100%";
      startedAt = Date.now();
      if (!isLast) timer = setTimeout(() => show(index + 1), SLIDE_MS - elapsed);
    }

    function pause() {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      elapsed += Date.now() - startedAt;
      const fill = fills[index];
      fill.style.transition = "none";
      fill.style.width = `${Math.min(100, (elapsed / SLIDE_MS) * 100)}%`;
    }

    function resume() {
      if (!paused) return;
      paused = false;
      run();
    }

    viewer.addEventListener("click", (event) => {
      if (event.target.closest("[data-no-advance]")) return;
      const rect = viewer.getBoundingClientRect();
      show(event.clientX - rect.left < rect.width * 0.3 ? index - 1 : index + 1);
    });
    viewer.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-no-advance]")) pause();
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((name) => viewer.addEventListener(name, resume));
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") show(index + 1);
      if (event.key === "ArrowLeft") show(index - 1);
    });
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));

    show(0);
  }

  // ---------- 1080x1920 story image ----------

  function loadImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  function fitText(ctx, text, maxWidth, startSize, weight = 800) {
    let size = startSize;
    do {
      ctx.font = `${weight} ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
      size -= 4;
    } while (ctx.measureText(text).width > maxWidth && size > 28);
  }

  function ellipsize(ctx, text, maxWidth) {
    let value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
    return `${value}…`;
  }

  function drawCover(ctx, image, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (image) {
      ctx.drawImage(image, x, y, size, size);
    } else {
      const fallback = ctx.createLinearGradient(x, y, x + size, y + size);
      fallback.addColorStop(0, "#4d8dff");
      fallback.addColorStop(1, "#0b1a4a");
      ctx.fillStyle = fallback;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  }

  async function renderStoryImage(data) {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const [logo, topImage] = await Promise.all([
      loadImage("/assets/icons/android-chrome-512x512.png"),
      loadImage(data.artists[0]?.imagem)
    ]);

    // Background: deep navy with glows.
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b1a4a");
    bg.addColorStop(0.55, "#050914");
    bg.addColorStop(1, "#02040a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    [
      [180, 260, 620, "rgba(77,141,255,0.55)"],
      [960, 1500, 700, "rgba(0,229,255,0.22)"],
      [900, 300, 420, "rgba(155,123,255,0.35)"]
    ].forEach(([x, y, r, color]) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    });

    // Header
    if (logo) ctx.drawImage(logo, 90, 110, 96, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 54px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText("Wikiband", 210, 176);
    ctx.fillStyle = "#9db8ff";
    ctx.font = '700 34px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`RETROSPECTIVA ${YEAR}`, 90, 300);

    // Top artist
    const top = data.artists[0];
    drawCover(ctx, topImage, 90, 350, 420);
    ctx.fillStyle = "#b9c8ea";
    ctx.font = '600 36px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.fillText("Meu artista nº1", 560, 470);
    ctx.fillStyle = "#ffffff";
    fitText(ctx, top?.label || "—", 440, 84);
    const name = ellipsize(ctx, top?.label || "—", 440);
    ctx.fillText(name, 560, 570);

    // Two columns
    const drawColumn = (title, items, x) => {
      ctx.fillStyle = "#9db8ff";
      ctx.font = '700 34px Inter, "Segoe UI", system-ui, sans-serif';
      ctx.fillText(title, x, 900);
      items.slice(0, 5).forEach((item, i) => {
        const y = 990 + i * 92;
        ctx.fillStyle = "#4d8dff";
        ctx.font = '800 48px Inter, "Segoe UI", system-ui, sans-serif';
        ctx.fillText(String(i + 1), x, y);
        ctx.fillStyle = "#ffffff";
        ctx.font = '700 44px Inter, "Segoe UI", system-ui, sans-serif';
        ctx.fillText(ellipsize(ctx, item, 380), x + 56, y);
      });
    };
    drawColumn("Top artistas", data.artists.map((a) => a.label), 90);
    drawColumn("Top gêneros", data.genres.map((g) => g.label), 580);

    // Stats
    [["Prévias ouvidas", String(data.plays)], ["Década favorita", data.decade || "—"]].forEach(([label, value], i) => {
      const x = 90 + i * 460;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.roundRect(x, 1500, 420, 190, 36);
      ctx.fill();
      ctx.fillStyle = "#b9c8ea";
      ctx.font = '600 32px Inter, "Segoe UI", system-ui, sans-serif';
      ctx.fillText(label, x + 36, 1566);
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 72px Inter, "Segoe UI", system-ui, sans-serif';
      ctx.fillText(ellipsize(ctx, value, 350), x + 36, 1652);
    });

    // Footer
    ctx.fillStyle = "#9db8ff";
    ctx.font = '600 36px Inter, "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(`Monte a sua em ${window.location.host}`, W / 2, 1820);

    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas vazio"))), "image/png")
    );
  }

  async function withBusy(button, task) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando imagem...";
    try {
      await task();
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Falha ao gerar a retrospectiva:", error);
        window.WikibandUI?.toast("Não foi possível gerar a imagem agora.");
      }
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  function saveBlob(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wikiband-retrospectiva-${YEAR}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadImage(data, button) {
    return withBusy(button, async () => {
      saveBlob(await renderStoryImage(data));
      window.WikibandUI?.toast("Imagem salva. Poste no seu Story!");
    });
  }

  // On phones the share sheet lists Instagram, which opens the Story editor with the image.
  function shareImage(data, button) {
    return withBusy(button, async () => {
      const blob = await renderStoryImage(data);
      const file = new File([blob], `wikiband-retrospectiva-${YEAR}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Minha retrospectiva ${YEAR}`, text: summaryText(data) });
        return;
      }

      saveBlob(blob);
      window.WikibandUI?.toast("Imagem salva: abra o Instagram e poste no Story.");
    });
  }

  // ---------- Start ----------

  function renderEmpty(title, text, href, label) {
    const box = element("div", "detalhe-content painel");
    const link = element("a", "primary-btn", label);
    link.href = href;
    box.append(element("h1", "", title), element("p", "status", text), link);
    stage.replaceChildren(box);
  }

  if (!Storage.getCurrentSession()) {
    renderEmpty("Sua retrospectiva", "Entre na sua conta para ver o resumo do seu ano musical.", "/login.html", "Entrar");
    return;
  }

  function start() {
    const data = collectData();

    if (!data.artists.length) {
      renderEmpty(
        "Ainda falta música aqui",
        "Ouça prévias e favorite álbuns e artistas: sua retrospectiva aparece assim que houver dados.",
        "/",
        "Explorar a vitrine"
      );
      return;
    }

    startStories(buildSlides(data));

    // Prefer a real artist photo for the nº1 slide and the story image.
    window.WikibandArtistInfo?.getArtistInfo(data.artists[0].label).then((info) => {
      if (!info?.image) return;
      data.artists[0].imagem = info.image;
      stage.querySelectorAll(".story-art").forEach((img) => (img.src = Safe.safeImageUrl(info.image)));
    });
  }

  start();
  document.addEventListener("wikiband:library-synced", start, { once: true });
})(window, document);
