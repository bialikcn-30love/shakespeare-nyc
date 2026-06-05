const AXES = ["water_coast", "green_wild", "civic_power", "commerce", "danger_death", "festivity_disguise"];
const AXIS_LABEL = {
  water_coast: "Water & coast", green_wild: "Green & wild", civic_power: "Civic power",
  commerce: "Commerce", danger_death: "Danger & death", festivity_disguise: "Festivity",
};
const css = (a) => getComputedStyle(document.documentElement).getPropertyValue("--" + a).trim();
const AXIS_COLOR = Object.fromEntries(AXES.map((a) => [a, css(a)]));
const MODE_NOTE = {
  default: "plays may share a neighborhood",
  distinct: "every play a unique neighborhood",
};

const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([40.7, -73.92], 11);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap, &copy; CARTO', subdomains: "abcd", maxZoom: 19,
}).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
  { subdomains: "abcd", maxZoom: 19, opacity: 0.5, pane: "shadowPane" }).addTo(map);

let layerByNta = {}, cardByTitle = {}, PLAYS = [], playByTitle = {}, geo = null;
const _qsMode = new URLSearchParams(location.search).get("mode");
let MODE = _qsMode === "distinct" ? "distinct" : "default";
let byNta = {}, selectedTitle = null, selectedNta = null;

const getMatch = (pl) => pl.modes[MODE];

function computeByNta() {
  byNta = {};
  PLAYS.forEach((pl) => {
    const m = getMatch(pl).match;
    (byNta[m.nta2020] = byNta[m.nta2020] || []).push({
      title: pl.title, distance: m.distance, confidence: m.confidence,
    });
  });
}

function styleFor(f) {
  const p = f.properties;
  const matched = byNta[p.nta2020] && byNta[p.nta2020].length;
  return {
    fillColor: AXIS_COLOR[p.dominant] || "#555",
    fillOpacity: matched ? 0.78 : 0.32,
    color: matched ? "#f3e6c4" : "#3a4150",
    weight: matched ? 1.6 : 0.4,
  };
}

fetch("data/plays.json").then((r) => r.json()).then((pd) => {
  PLAYS = pd.plays;
  PLAYS.forEach((p) => (playByTitle[p.title] = p));
  computeByNta();
  buildLegend(); buildModeToggle(); buildPlaylist();
  return fetch("data/nta.geojson").then((r) => r.json());
}).then((gj) => {
  geo = L.geoJSON(gj, {
    style: styleFor,
    onEachFeature: (f, layer) => {
      layerByNta[f.properties.nta2020] = layer;
      layer.on("click", () => showNeighborhood(f.properties.nta2020));
      layer.on("mouseover", () => { layer.setStyle({ weight: 2.4, color: "#fff" }); layer.bindTooltip(tipFor(f.properties.nta2020), { className: "nta-tip", sticky: true }).openTooltip(); });
      layer.on("mouseout", () => restyle(f.properties.nta2020));
    },
  }).addTo(map);
  applyHash();
});

function tipFor(nta) {
  const f = layerByNta[nta].feature.properties;
  let tip = `<b>${f.name}</b><br>${f.borough}`;
  const mp = byNta[nta];
  if (mp && mp.length) tip += `<br>▶ ${mp.map((m) => m.title).join(", ")}`;
  return tip;
}

function restyle(nta) {
  const layer = layerByNta[nta];
  if (!layer) return;
  if (nta === selectedNta) layer.setStyle({ weight: 3.2, color: "#ffcf5c", fillOpacity: 0.9 });
  else geo.resetStyle(layer);
}

function buildLegend() {
  document.getElementById("legend").innerHTML = AXES.map((a) =>
    `<span class="legend-item"><span class="swatch" style="background:${AXIS_COLOR[a]}"></span>${AXIS_LABEL[a]}</span>`
  ).join("");
}

function buildModeToggle() {
  document.getElementById("modeNote").textContent = MODE_NOTE[MODE];
  document.querySelectorAll("#modeToggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === MODE);
    b.onclick = () => setMode(b.dataset.mode);
  });
}

function setMode(mode) {
  if (mode === MODE) return;
  MODE = mode;
  computeByNta();
  buildModeToggle(); buildPlaylist();
  if (geo) geo.eachLayer((l) => restyle(l.feature.properties.nta2020));
  document.getElementById("search").dispatchEvent(new Event("input"));
  // refresh open detail in the new mode
  if (selectedTitle && playByTitle[selectedTitle]) selectPlay(selectedTitle);
  else if (selectedNta) showNeighborhood(selectedNta);
}

function buildPlaylist() {
  const list = document.getElementById("playlist");
  list.innerHTML = "";
  PLAYS.slice().sort((a, b) => a.title.localeCompare(b.title)).forEach((pl) => {
    const m = getMatch(pl).match;
    const el = document.createElement("div");
    el.className = "play-card" + (pl.title === selectedTitle ? " active" : "");
    el.innerHTML = `<div class="pt">${pl.title}</div>
      <div class="pm">→ <b>${m.name}</b> · ${m.borough}</div>`;
    el.onclick = () => selectPlay(pl.title);
    cardByTitle[pl.title] = el;
    list.appendChild(el);
  });
}

document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  Object.entries(cardByTitle).forEach(([t, el]) => {
    const m = getMatch(playByTitle[t]).match;
    el.style.display = (t.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)) ? "" : "none";
  });
});

function bars(playScores, nbScores) {
  return `<div class="bars">` + AXES.map((a) => {
    const pv = Math.round((playScores ? playScores[a] : nbScores[a]) * 100);
    const nb = nbScores ? `<div class="bar-nb" style="left:${Math.round(nbScores[a] * 100)}%"></div>` : "";
    return `<div class="bar-row"><div class="bar-label">${AXIS_LABEL[a]}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pv}%;background:${AXIS_COLOR[a]}"></div>${nb}</div></div>`;
  }).join("") + `</div>`;
}

function quoteBlock(q) {
  if (!q || !q.quote) return "";
  return `<div class="d-section"><h3>Representative line</h3>
    <div class="quote">“${q.quote}”</div>
    <div class="quote-meta">— ${q.speaker}, ${q.act_scene}</div>
    <div class="why">${q.why || ""}</div></div>`;
}

function openDetail(html) {
  document.getElementById("detail-body").innerHTML = html;
  document.getElementById("detail").classList.remove("hidden");
}
document.getElementById("detail-close").onclick = () => {
  document.getElementById("detail").classList.add("hidden");
  selectedTitle = selectedNta = null;
  Object.values(cardByTitle).forEach((e) => e.classList.remove("active"));
  if (geo) geo.eachLayer((l) => geo.resetStyle(l));
};

function focusNta(nta2020) {
  const prev = selectedNta;
  selectedNta = nta2020;
  if (geo) geo.eachLayer((l) => { if (l.feature.properties.nta2020 !== nta2020) geo.resetStyle(l); });
  const layer = layerByNta[nta2020];
  if (layer) {
    layer.setStyle({ weight: 3.2, color: "#ffcf5c", fillOpacity: 0.9 });
    layer.bringToFront();
    map.fitBounds(layer.getBounds(), { paddingTopLeft: [360, 30], paddingBottomRight: [410, 30], maxZoom: 14 });
  }
}

function selectPlay(title) {
  const pl = playByTitle[title];
  Object.values(cardByTitle).forEach((e) => e.classList.remove("active"));
  if (cardByTitle[title]) cardByTitle[title].classList.add("active");
  const e = getMatch(pl), m = e.match;
  focusNta(m.nta2020);          // sets selectedNta -> keeps the gold highlight on mouseout
  selectedTitle = title;         // play selection takes priority on mode switch
  const html = `
    <div class="d-kicker">Play · ${MODE === "distinct" ? "one-to-one" : "nearest"} match</div>
    <div class="d-title">${pl.title}</div>
    <div class="d-sub">${pl.one_line}</div>
    <div class="d-section"><h3>Matched neighborhood</h3>
      <div class="chips">
        <span class="chip">📍 <b>${m.name}</b></span>
        <span class="chip">${m.borough}</span>
        <span class="chip">distance <b>${m.distance.toFixed(2)}</b></span>
        <span class="chip">confidence <b>${Math.round(m.confidence * 100)}%</b></span>
      </div>
      <div class="why">${m.one_line}</div>
    </div>
    <div class="d-section"><h3>Codebook fit</h3>
      <div class="legend2">bar = play<span class="sw" style="background:#888"></span> · white tick = neighborhood<span class="sw bar-nb" style="position:static;width:3px;height:11px;background:#fff"></span></div>
      ${bars(pl.scores, ntaScores(m.nta2020))}
    </div>
    ${quoteBlock(pl.quote)}
    <div class="d-section"><h3>Top-3 nearest neighborhoods</h3>
      ${e.top3.map((t) => `<div class="alt"><span class="an"><a class="fly" onclick="showNeighborhood('${t.nta2020}')">${t.name}</a></span><span class="ad">${t.borough} · d=${t.distance.toFixed(2)}</span></div>`).join("")}
    </div>`;
  openDetail(html);
}

function ntaScores(nta2020) {
  const layer = layerByNta[nta2020];
  return layer ? layer.feature.properties.scores : null;
}

function showNeighborhood(nta2020) {
  const layer = layerByNta[nta2020];
  if (!layer) return;
  const p = layer.feature.properties;
  selectedTitle = null;
  Object.values(cardByTitle).forEach((e) => e.classList.remove("active"));
  focusNta(nta2020);
  const ft = p.features || {};
  let html = `
    <div class="d-kicker">Neighborhood</div>
    <div class="d-title">${p.name}</div>
    <div class="d-sub">${p.borough}</div>
    <div class="chips">
      <span class="chip">shore <b>${Math.round(ft.shoreline_m || 0)}m</b></span>
      <span class="chip">park <b>${Math.round((ft.park_share || 0) * 100)}%</b></span>
      <span class="chip">food/drink <b>${Math.round((ft.food_drink_share || 0) * 100)}%</b></span>
    </div>
    <div class="d-section"><h3>Codebook profile</h3>${bars(p.scores, null)}
      <div class="lowconf">⚑ danger &amp; death is a low-confidence axis (see spec §2)</div>
    </div>`;
  const mp = byNta[nta2020] || [];
  if (mp.length) {
    html += `<div class="d-section"><h3>Matched play${mp.length > 1 ? "s" : ""} <span class="ad" style="font-weight:400">(${MODE === "distinct" ? "one-to-one" : "nearest"})</span></h3>`;
    mp.forEach((m) => {
      const pl = playByTitle[m.title]; const q = pl.quote;
      html += `<div style="margin-bottom:12px">
        <div class="pt" style="font-size:14px"><a class="fly" onclick="selectPlay(${JSON.stringify(m.title)})">${m.title}</a>
          <span class="ad" style="font-weight:400">· d=${m.distance.toFixed(2)} · ${Math.round(m.confidence * 100)}%</span></div>
        <div class="why">${pl.one_line}</div>
        ${q && q.quote ? `<div class="quote" style="font-size:13px;margin-top:6px">“${q.quote}”</div><div class="quote-meta">— ${q.speaker}, ${q.act_scene}</div>` : ""}
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="d-section"><h3>Matched play</h3><div class="why">No play matches here in ${MODE === "distinct" ? "one-to-one" : "nearest"} mode. Color shows this area's dominant axis: <b>${AXIS_LABEL[p.dominant]}</b>.</div></div>`;
  }
  openDetail(html);
}

window.showNeighborhood = showNeighborhood; window.selectPlay = selectPlay;

// Shareable deep link: #play=<exact title> auto-opens that play once data is ready.
function applyHash() {
  const m = decodeURIComponent(location.hash).match(/^#play=(.+)$/);
  if (m && playByTitle[m[1]]) selectPlay(m[1]);
}
window.addEventListener("hashchange", applyHash);
