const statusEl = document.getElementById("status");
const titleEl = document.getElementById("page-title");
const urlEl = document.getElementById("page-url");
const thumbEl = document.getElementById("thumb");
const thumbFallbackEl = document.getElementById("thumb-fallback");
const noteEl = document.getElementById("note");
const boardsEl = document.getElementById("boards");
const useInboxEl = document.getElementById("use-inbox");
const saveBtn = document.getElementById("save-now");
const openBtn = document.getElementById("open-capture");

const authBodyEl = document.getElementById("auth-body");
const authUserEl = document.getElementById("auth-user");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const DEFAULT_ORIGIN = "http://localhost:3000";
const DEFAULT_SUPABASE_URL = "https://ckpdvjiuucxjjbalqllr.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcGR2aml1dWN4ampiYWxxbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzkzOTksImV4cCI6MjA4NTAxNTM5OX0.sFWjQm3LXDEi4blFHmnKZ-BWzh1Gvrejr7P4K8tsTbc";

let captureData = {
  url: "",
  title: "",
  thumbnail: "",
};

function setStatus(message, tone = "error") {
  statusEl.textContent = message || "";
  statusEl.style.color = tone === "success" ? "#1f7a1f" : "#b00020";
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized + "===".slice((normalized.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        captureOrigin: DEFAULT_ORIGIN,
        supabaseUrl: DEFAULT_SUPABASE_URL,
        supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      },
      (items) => {
        resolve({
          origin: (items.captureOrigin || DEFAULT_ORIGIN).replace(/\/$/, ""),
          supabaseUrl: items.supabaseUrl || DEFAULT_SUPABASE_URL,
          supabaseAnonKey: items.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY,
        });
      }
    );
  });
}

function getStoredSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ authSession: null }, (items) => {
      resolve(items.authSession || null);
    });
  });
}

function setStoredSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ authSession: session }, () => resolve());
  });
}

async function clearSession() {
  await setStoredSession(null);
}

async function refreshSession(settings, session) {
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(
      `${settings.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: settings.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: data.user,
    };
    await setStoredSession(next);
    return next;
  } catch {
    return null;
  }
}

async function ensureSession(settings) {
  const session = await getStoredSession();
  if (!session) return null;
  const expiresAt = session.expires_at || 0;
  if (Date.now() + 60000 < expiresAt) return session;
  return refreshSession(settings, session);
}

async function login(settings) {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();
  if (!email || !password) {
    setStatus("Email and password required.");
    return null;
  }
  try {
    const res = await fetch(
      `${settings.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: settings.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.error_description || "Login failed.");
      return null;
    }

    const data = await res.json();
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      user: data.user,
    };
    await setStoredSession(next);
    return next;
  } catch {
    setStatus("Login failed.");
    return null;
  }
}

async function logout(settings, session) {
  if (session?.access_token) {
    try {
      await fetch(`${settings.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: settings.supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // ignore
    }
  }
  await clearSession();
}

function updateAuthUI(session) {
  if (session?.user?.email) {
    authBodyEl.style.display = "none";
    authUserEl.textContent = `Signed in as ${session.user.email}`;
    logoutBtn.style.display = "inline";
  } else {
    authBodyEl.style.display = "grid";
    authUserEl.textContent = "";
    logoutBtn.style.display = "none";
  }
}

function getYouTubeVideoId(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const kind = parts[0];
      const id = parts[1];
      if ((kind === "shorts" || kind === "embed" || kind === "live") && id) {
        return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getYouTubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseYouTubeTime(raw) {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/s$/i, "");
  if (/^\\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s)?$/i);
  if (!match) return null;
  const h = match[1] ? Number(match[1]) : 0;
  const m = match[2] ? Number(match[2]) : 0;
  const s = match[3] ? Number(match[3]) : 0;
  const total = h * 3600 + m * 60 + s;
  return Number.isFinite(total) ? total : null;
}

function getYouTubeStartSeconds(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    return parseYouTubeTime(t);
  } catch {
    return null;
  }
}

function updatePreview() {
  titleEl.textContent = captureData.title || "Untitled";
  urlEl.textContent = captureData.url || "";

  if (captureData.thumbnail) {
    thumbEl.src = captureData.thumbnail;
    thumbEl.style.display = "block";
    thumbFallbackEl.style.display = "none";
  } else {
    thumbEl.removeAttribute("src");
    thumbEl.style.display = "none";
    thumbFallbackEl.style.display = "flex";
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

async function getPageMetadata(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
        document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
        "";
      const canonicalUrl =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
        "";
      return {
        title: document.title || "",
        url: window.location.href,
        ogImage,
        canonicalUrl,
      };
    },
  });
  return result || null;
}

async function buildCaptureUrl(settings) {
  const params = new URLSearchParams();
  if (captureData.url) params.set("url", captureData.url);
  if (captureData.title) params.set("title", captureData.title);
  if (captureData.thumbnail) params.set("thumbnail", captureData.thumbnail);
  const note = noteEl.value.trim();
  if (note) params.set("note", note);
  return `${settings.origin}/capture?${params.toString()}`;
}

async function loadBoards(session, settings) {
  boardsEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Loading boards...";
  boardsEl.appendChild(placeholder);
  boardsEl.disabled = true;

  if (!session?.access_token) {
    boardsEl.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Login required";
    boardsEl.appendChild(option);
    boardsEl.disabled = true;
    setStatus("Sign in above to enable direct save.");
    return;
  }

  const payload = decodeJwtPayload(session.access_token);
  const userId = payload?.sub;
  if (!userId) {
    setStatus("Invalid session. Please sign in again.");
    await clearSession();
    updateAuthUI(null);
    return;
  }

  try {
    const res = await fetch(
      `${settings.supabaseUrl}/rest/v1/boards?select=id,title,slug,is_public&creator_id=eq.${userId}&order=created_at.desc`,
      {
        method: "GET",
        headers: {
          apikey: settings.supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to load boards");
    }

    const boards = await res.json();
    boardsEl.innerHTML = "";

    if (!boards.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No boards yet";
      boardsEl.appendChild(option);
      boardsEl.disabled = true;
      useInboxEl.checked = true;
      return;
    }

    boards.forEach((board, index) => {
      const option = document.createElement("option");
      option.value = board.id;
      option.textContent = board.title;
      if (index === 0) option.selected = true;
      boardsEl.appendChild(option);
    });

    boardsEl.disabled = false;
  } catch {
    boardsEl.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unable to load boards";
    boardsEl.appendChild(option);
    boardsEl.disabled = true;
    setStatus("Unable to reach your app.");
  }
}

async function ensureInbox(session, settings, userId) {
  const res = await fetch(
    `${settings.supabaseUrl}/rest/v1/boards?select=id&creator_id=eq.${userId}&slug=eq.inbox&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: settings.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  if (data?.[0]?.id) return data[0].id;

  const insertRes = await fetch(`${settings.supabaseUrl}/rest/v1/boards`, {
    method: "POST",
    headers: {
      apikey: settings.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      creator_id: userId,
      title: "Inbox",
      slug: "inbox",
      description: "Auto-created for quick saves",
      is_public: false,
    }),
  });

  if (!insertRes.ok) return null;
  const inserted = await insertRes.json();
  return inserted?.[0]?.id || null;
}

async function saveDirect(session, settings) {
  setStatus("");
  saveBtn.disabled = true;

  if (!session?.access_token) {
    setStatus("Login required.");
    saveBtn.disabled = false;
    return;
  }

  if (!captureData.url) {
    setStatus("Missing a valid URL.");
    saveBtn.disabled = false;
    return;
  }

  const payload = decodeJwtPayload(session.access_token);
  const userId = payload?.sub;
  if (!userId) {
    setStatus("Invalid session. Please sign in again.");
    await clearSession();
    updateAuthUI(null);
    saveBtn.disabled = false;
    return;
  }

  let boardId = boardsEl.value;
  if (useInboxEl.checked || !boardId) {
    boardId = await ensureInbox(session, settings, userId);
    if (!boardId) {
      setStatus("Unable to resolve Inbox.");
      saveBtn.disabled = false;
      return;
    }
  }

  const videoId = getYouTubeVideoId(captureData.url);
  const startSeconds = videoId ? getYouTubeStartSeconds(captureData.url) : null;
  const sourceType = videoId ? "youtube" : "web";
  const normalizedUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}${
        startSeconds ? `&t=${startSeconds}` : ""
      }`
    : captureData.url;

  try {
    const res = await fetch(`${settings.supabaseUrl}/rest/v1/cards`, {
      method: "POST",
      headers: {
        apikey: settings.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        board_id: boardId,
        url: normalizedUrl,
        title: captureData.title || null,
        creator_note: noteEl.value.trim() || null,
        thumbnail_url: captureData.thumbnail || null,
        source_type: sourceType,
        youtube_video_id: videoId,
        youtube_timestamp: startSeconds,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data?.message || "Save failed.");
      saveBtn.disabled = false;
      return;
    }

    setStatus("Saved.", "success");
  } catch {
    setStatus("Save failed.");
  } finally {
    saveBtn.disabled = false;
  }
}

async function init() {
  try {
    const settings = await getSettings();
    const session = await ensureSession(settings);
    updateAuthUI(session);

    setStatus("Reading this page...");
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      setStatus("No active tab detected.");
      return;
    }

    const pageData = await getPageMetadata(tab.id);
    const rawTabUrl = tab.url || "";
    const canonicalUrl = pageData?.canonicalUrl || "";
    const pageTitle = pageData?.title || tab.title || "";
    const ogImage = pageData?.ogImage || "";

    const videoIdFromTab = rawTabUrl ? getYouTubeVideoId(rawTabUrl) : null;
    const videoIdFromCanonical = canonicalUrl
      ? getYouTubeVideoId(canonicalUrl)
      : null;
    const videoId = videoIdFromTab || videoIdFromCanonical;

    let pageUrl = rawTabUrl || canonicalUrl || pageData?.url || "";
    if (videoId && !getYouTubeVideoId(pageUrl)) {
      pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    const thumbnail = videoId
      ? getYouTubeThumbnailUrl(videoId)
      : ogImage || "";

    captureData = {
      url: pageUrl,
      title: pageTitle,
      thumbnail,
    };

    updatePreview();
    setStatus("");
    await loadBoards(session, settings);

    loginBtn.addEventListener("click", async () => {
      const nextSession = await login(settings);
      if (!nextSession) return;
      updateAuthUI(nextSession);
      await loadBoards(nextSession, settings);
      setStatus("Signed in.", "success");
    });

    logoutBtn.addEventListener("click", async () => {
      const current = await ensureSession(settings);
      await logout(settings, current);
      updateAuthUI(null);
      await loadBoards(null, settings);
      setStatus("Signed out.", "success");
    });

    saveBtn.addEventListener("click", async () => {
      const nextSession = await ensureSession(settings);
      await saveDirect(nextSession, settings);
    });

    openBtn.addEventListener("click", async () => {
      if (!captureData.url) {
        setStatus("Missing a valid URL.");
        return;
      }
      const captureUrl = await buildCaptureUrl(settings);
      chrome.tabs.create({ url: captureUrl });
    });
  } catch {
    setStatus("Unable to read this page.");
  }
}

useInboxEl.addEventListener("change", () => {
  boardsEl.disabled = useInboxEl.checked;
});

init();
