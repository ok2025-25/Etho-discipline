// ========== CUSTOM DIALOGS ==========
// Drop-in async replacements for window.confirm() / window.prompt(),
// styled to match the app instead of the browser's native (and on mobile,
// often ugly/inconsistent) dialogs.
//
// Usage:
//   const ok = await customConfirm("Delete this goal?", { danger: true });
//   const name = await customPrompt("New category name:", { placeholder: "e.g. Health" });
//
// customConfirm resolves to true/false. customPrompt resolves to the
// trimmed string, or null if cancelled/left empty — mirroring the old
// prompt() contract so call sites barely need to change.

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function ensureDialogRoot() {
  let root = document.getElementById("custom-dialog-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "custom-dialog-root";
    document.body.appendChild(root);
  }
  return root;
}

function buildDialogShell(iconClass, bodyHTML, buttonsHTML) {
  const overlay = document.createElement("div");
  overlay.className = "custom-dialog-overlay";
  overlay.innerHTML = `
    <div class="custom-dialog-box" role="dialog" aria-modal="true">
      <div class="custom-dialog-icon"><i class="fa-solid ${iconClass}"></i></div>
      <div class="custom-dialog-body">${bodyHTML}</div>
      <div class="custom-dialog-actions">${buttonsHTML}</div>
    </div>
  `;
  return overlay;
}

function openDialog(overlay, onKeydown) {
  const root = ensureDialogRoot();
  root.appendChild(overlay);
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);
  // trigger CSS transition
  requestAnimationFrame(() => overlay.classList.add("open"));
  return function closeDialog() {
    document.removeEventListener("keydown", onKeydown);
    document.body.style.overflow = prevOverflow;
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 150);
  };
}

function customConfirm(message, opts = {}) {
  const { confirmText = "Confirm", cancelText = "Cancel", danger = false } = opts;
  return new Promise((resolve) => {
    const overlay = buildDialogShell(
      danger ? "fa-triangle-exclamation" : "fa-circle-question",
      `<p>${escapeHTML(message)}</p>`,
      `<button type="button" class="custom-dialog-btn custom-dialog-cancel">${escapeHTML(cancelText)}</button>
       <button type="button" class="custom-dialog-btn ${danger ? "custom-dialog-danger" : "custom-dialog-confirm"}">${escapeHTML(confirmText)}</button>`
    );

    function onKeydown(e) {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter") finish(true);
    }
    const close = openDialog(overlay, onKeydown);
    function finish(result) {
      close();
      resolve(result);
    }

    overlay.querySelector(".custom-dialog-cancel").addEventListener("click", () => finish(false));
    overlay.querySelector(".custom-dialog-danger, .custom-dialog-confirm").addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(false); });

    overlay.querySelector(".custom-dialog-danger, .custom-dialog-confirm").focus();
  });
}

function customPrompt(message, opts = {}) {
  const { placeholder = "", defaultValue = "", confirmText = "OK", cancelText = "Cancel" } = opts;
  return new Promise((resolve) => {
    const overlay = buildDialogShell(
      "fa-pen",
      `<p>${escapeHTML(message)}</p>
       <input type="text" class="custom-dialog-input" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(defaultValue)}">`,
      `<button type="button" class="custom-dialog-btn custom-dialog-cancel">${escapeHTML(cancelText)}</button>
       <button type="button" class="custom-dialog-btn custom-dialog-confirm">${escapeHTML(confirmText)}</button>`
    );

    const input = overlay.querySelector(".custom-dialog-input");

    function onKeydown(e) {
      if (e.key === "Escape") finish(null);
      if (e.key === "Enter") submit();
    }
    const close = openDialog(overlay, onKeydown);
    function finish(result) {
      close();
      resolve(result);
    }
    function submit() {
      const val = input.value.trim();
      finish(val || null);
    }

    overlay.querySelector(".custom-dialog-cancel").addEventListener("click", () => finish(null));
    overlay.querySelector(".custom-dialog-confirm").addEventListener("click", submit);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });

    setTimeout(() => input.focus(), 80);
  });
}