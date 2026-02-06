const originInput = document.getElementById("origin");
const supabaseUrlInput = document.getElementById("supabase-url");
const supabaseKeyInput = document.getElementById("supabase-key");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

const DEFAULT_ORIGIN = "https://curator-board-sigma.vercel.app";
const DEFAULT_SUPABASE_URL = "https://ckpdvjiuucxjjbalqllr.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcGR2aml1dWN4ampiYWxxbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzkzOTksImV4cCI6MjA4NTAxNTM5OX0.sFWjQm3LXDEi4blFHmnKZ-BWzh1Gvrejr7P4K8tsTbc";

function setStatus(message) {
  statusEl.textContent = message || "";
}

chrome.storage.sync.get(
  {
    captureOrigin: DEFAULT_ORIGIN,
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
  },
  (items) => {
    originInput.value = items.captureOrigin || DEFAULT_ORIGIN;
    supabaseUrlInput.value = items.supabaseUrl || DEFAULT_SUPABASE_URL;
    supabaseKeyInput.value = items.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY;
  }
);

saveBtn.addEventListener("click", () => {
  const origin = originInput.value.trim() || DEFAULT_ORIGIN;
  const supabaseUrl = supabaseUrlInput.value.trim() || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = supabaseKeyInput.value.trim() || DEFAULT_SUPABASE_ANON_KEY;
  chrome.storage.sync.set(
    { captureOrigin: origin, supabaseUrl, supabaseAnonKey },
    () => {
    setStatus("Saved.");
    setTimeout(() => setStatus(""), 2000);
    }
  );
});
