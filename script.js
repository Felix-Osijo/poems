const introEl = document.getElementById("intro");
const listView = document.getElementById("list-view");
const listEl = document.getElementById("poem-list");
const readerView = document.getElementById("reader-view");
const readerTitle = document.getElementById("reader-title");
const readerBody = document.getElementById("reader-body");
const searchEl = document.getElementById("search");
const countEl = document.getElementById("count");
const messageEl = document.getElementById("message");
const backEl = document.getElementById("back");

document.getElementById("year").textContent = new Date().getFullYear();

const SITE_TITLE = "Poems by Felix";
let poems = []; // { file, title, html, text, snippet, el }
let listScroll = 0;

const isBlank = (p) => !p.textContent.trim();

// Turn one .docx file into a poem object.
async function loadPoem(file) {
  const res = await fetch("poems/" + encodeURIComponent(file));
  if (!res.ok) throw new Error("Could not load " + file);

  const buffer = await res.arrayBuffer();
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    { ignoreEmptyParagraphs: false }
  );
  const doc = new DOMParser().parseFromString(value, "text/html");
  const paras = Array.from(doc.body.children);

  // Title = first paragraph, if it is bold. Otherwise use the file name.
  let title = file.replace(/\.docx$/i, "");
  if (paras.length && paras[0].querySelector("strong") && paras[0].textContent.trim()) {
    title = paras.shift().textContent.trim();
  }

  // Drop blank paragraphs at the start and end.
  while (paras.length && isBlank(paras[0])) paras.shift();
  while (paras.length && isBlank(paras[paras.length - 1])) paras.pop();

  // Group lines into stanzas.
  // If the file has blank paragraphs, a blank paragraph = new stanza.
  // Otherwise each paragraph is one stanza (lines split with Shift+Enter).
  const stanzas = [];
  if (paras.some(isBlank)) {
    let current = [];
    paras.forEach((p) => {
      if (isBlank(p)) {
        if (current.length) stanzas.push(current);
        current = [];
      } else {
        current.push(p.innerHTML);
      }
    });
    if (current.length) stanzas.push(current);
  } else {
    paras.forEach((p) => stanzas.push([p.innerHTML]));
  }

  const html = stanzas
    .map((lines) => '<p class="stanza">' + lines.join("<br>") + "</p>")
    .join("");

  // Plain text for search and the snippet.
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  wrap.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const stanzaTexts = Array.from(wrap.children).map((el) => el.textContent);

  return {
    file,
    title,
    html,
    text: (title + " " + stanzaTexts.join(" ")).toLowerCase(),
    snippet: (stanzaTexts[0] || "").split("\n")[0].trim(),
  };
}

// Build the list entry for a poem (a link that opens the reader view).
function buildItem(poem) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.className = "poem-link";
  a.href = "#poem=" + encodeURIComponent(poem.file);

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = poem.title;
  const snippet = document.createElement("span");
  snippet.className = "snippet";
  snippet.textContent = poem.snippet;

  a.append(title, snippet);
  li.append(a);
  poem.el = li;
  return li;
}

function updateCount(shown) {
  countEl.textContent =
    shown === poems.length
      ? poems.length + (poems.length === 1 ? " poem" : " poems")
      : shown + " of " + poems.length + " poems";
}

function filterPoems() {
  const query = searchEl.value.trim().toLowerCase();
  let shown = 0;

  poems.forEach((poem) => {
    const match = !query || poem.text.includes(query);
    poem.el.hidden = !match;
    if (match) shown++;
  });

  updateCount(shown);
  messageEl.textContent = shown === 0 ? "No poems match that search." : "";
}

// Show one poem like a page.
function showReader(poem) {
  if (readerView.hidden) listScroll = window.scrollY;
  readerTitle.textContent = poem.title;
  readerBody.innerHTML = poem.html;
  document.title = poem.title + " | " + SITE_TITLE;
  listView.hidden = true;
  introEl.hidden = true;
  readerView.hidden = false;
  window.scrollTo(0, 0);
}

// Show the list (search text and filter are kept).
function showList() {
  const cameFromReader = !readerView.hidden;
  readerView.hidden = true;
  listView.hidden = false;
  introEl.hidden = false;
  document.title = SITE_TITLE;
  if (cameFromReader) window.scrollTo(0, listScroll);
}

function route() {
  const match = location.hash.match(/^#poem=(.+)$/);
  const poem = match && poems.find((p) => p.file === decodeURIComponent(match[1]));
  if (poem) showReader(poem);
  else showList();
}

async function init() {
  try {
    const res = await fetch("poems/poems.json");
    if (!res.ok) throw new Error("poems.json not found");
    const files = await res.json();

    const results = await Promise.allSettled(files.map(loadPoem));
    poems = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    results
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.warn(r.reason.message));

    if (!poems.length) {
      messageEl.textContent = "No poems yet. Check back soon.";
      return;
    }

    poems.forEach((poem) => listEl.append(buildItem(poem)));
    updateCount(poems.length);
    route();
  } catch (err) {
    console.error(err);
    messageEl.textContent = "Poems could not be loaded right now. Please try again later.";
  }
}

searchEl.addEventListener("input", () => {
  // Searching from inside a poem takes you back to the list.
  if (!readerView.hidden) {
    listScroll = 0;
    location.hash = "";
  }
  filterPoems();
});

backEl.addEventListener("click", (e) => {
  e.preventDefault();
  location.hash = "";
});

window.addEventListener("hashchange", route);
init();
