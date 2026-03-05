(() => {
  const STORAGE_KEY = "lugh21-theme";
  const allowed = new Set(["light", "dark", "system"]);

  function applyTheme(theme) {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    document.documentElement.setAttribute("data-theme", theme);
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY) || "light";
    applyTheme(allowed.has(stored) ? stored : "light");
  } catch (error) {
    applyTheme("light");
  }
})();
