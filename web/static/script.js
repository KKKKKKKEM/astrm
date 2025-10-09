document.addEventListener("DOMContentLoaded", () => {
  // Editor config
  const editorConfig = {
    tools: { code: CodeTool },
    placeholder: "Enter data",
  };

  let currentFieldInfo = null;
  let editor;

  // Toast helper with type support
  function showToast(message, type = "info") {
    const el = document.getElementById("liveToast");
    const body = el.querySelector(".toast-body");
    body.textContent = message;

    // Add type class for styling
    el.className = "ui-toast show";
    if (type === "success") el.classList.add("toast-success");
    else if (type === "error") el.classList.add("toast-error");

    clearTimeout(el.__hideTimer);
    // Success messages disappear faster
    const duration = type === "success" ? 800 : type === "error" ? 2000 : 1200;
    el.__hideTimer = setTimeout(() => el.classList.remove("show"), duration);
  }
  window.showToast = showToast;

  // Tabs
  (function initNav() {
    const navAlist = document.getElementById("navAlist");
    const navJobs = document.getElementById("navJobs");
    const navEmby = document.getElementById("navEmby");
    const viewAlist = document.getElementById("viewAlist");
    const viewJobs = document.getElementById("viewJobs");
    const viewEmby = document.getElementById("viewEmby");

    function activate(which) {
      const isAlist = which === "alist";
      const isJobs = which === "jobs";
      const isEmby = which === "emby";

      if (navAlist && navJobs && navEmby) {
        navAlist.classList.toggle("active", isAlist);
        navJobs.classList.toggle("active", isJobs);
        navEmby.classList.toggle("active", isEmby);
        navAlist.setAttribute("aria-selected", String(isAlist));
        navJobs.setAttribute("aria-selected", String(isJobs));
        navEmby.setAttribute("aria-selected", String(isEmby));
      }
      viewAlist.classList.toggle("active", isAlist);
      viewJobs.classList.toggle("active", isJobs);
      viewEmby.classList.toggle("active", isEmby);

      // Toggle floating add buttons visibility
      const addAlistBtn = document.getElementById("addAlistBtn");
      const addJobBtn = document.getElementById("addJobBtn");
      if (addAlistBtn) addAlistBtn.style.display = isAlist ? "flex" : "none";
      if (addJobBtn) addJobBtn.style.display = isJobs ? "flex" : "none";

      try {
        localStorage.setItem("astrm_active_tab", which);
      } catch {}
      // Close sidebar on mobile after navigation
      if (window.innerWidth <= 768) {
        document.body.classList.remove("sidebar-open");
        const bd = document.getElementById("sidebarBackdrop");
        if (bd) bd.hidden = true;
      }
    }
    if (navAlist && navJobs && navEmby) {
      navAlist.addEventListener("click", () => activate("alist"));
      navJobs.addEventListener("click", () => activate("jobs"));
      navEmby.addEventListener("click", () => activate("emby"));
    }
    let initial = "alist";
    try {
      initial = localStorage.getItem("astrm_active_tab") || "alist";
    } catch {}
    activate(initial);

    // Sidebar toggle - Logo click toggles sidebar
    const toggle = document.getElementById("sidebarToggle");
    const backdrop = document.getElementById("sidebarBackdrop");
    const sidebar = document.getElementById("sidebar");

    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle sidebar-closed class for desktop, sidebar-open for mobile
        if (window.innerWidth > 768) {
          // Desktop: toggle closed state
          document.body.classList.toggle("sidebar-closed");
        } else {
          // Mobile: toggle open state (overlay)
          const isOpen = document.body.classList.contains("sidebar-open");
          document.body.classList.toggle("sidebar-open", !isOpen);
          if (backdrop) {
            backdrop.hidden = isOpen;
          }
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", () => {
        document.body.classList.remove("sidebar-open");
        document.body.classList.remove("sidebar-closed");
        backdrop.hidden = true;
      });
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        document.body.classList.remove("sidebar-open");
        if (backdrop) backdrop.hidden = true;
      } else {
        // Mobile: remove desktop closed state
        document.body.classList.remove("sidebar-closed");
      }

      // Debounce re-render on resize
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Trigger re-render for responsive layout
        if (window.alistMgr) window.alistMgr.load();
        if (window.jobMgr) window.jobMgr.load();
      }, 300);
    });
  })();

  // Theme: follow system preference (no button)
  (function initTheme() {
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-theme",
      prefersDark ? "dark" : "light"
    );
  })();

  // API helpers
  let __reloadTimer = null;
  function reloadSoon() {
    if (__reloadTimer) return; // debounce
    // persist current tab before refresh
    try {
      const isJobs = document
        .getElementById("viewJobs")
        ?.classList.contains("active");
      localStorage.setItem("astrm_active_tab", isJobs ? "jobs" : "alist");
    } catch {}
    __reloadTimer = setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  const api = {
    async get(url) {
      const res = await fetch(url);
      return res.json();
    },
    async post(url, data) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      showToast(out.msg);
      reloadSoon();
      return out;
    },
    async patch(url, data) {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json();
      showToast(out.msg);
      reloadSoon();
      return out;
    },
    async del(url) {
      const res = await fetch(url, { method: "DELETE" });
      const out = await res.json();
      showToast(out.msg);
      reloadSoon();
      return out;
    },
  };

  // Modal + Editor helpers
  function initializeEditor(obj, key) {
    if (editor) editor.destroy();
    const raw = obj[key];
    const value =
      typeof raw === "object"
        ? JSON.stringify(raw, null, 2)
        : String(raw ?? "");
    const tag = document.querySelector("#editModalLabel");
    tag.textContent = `Edit ${key}`;
    editor = new EditorJS({
      holder: "editorjs",
      ...editorConfig,
      data: { blocks: [{ type: "code", data: { code: value } }] },
    });
  }

  document.getElementById("saveEditBtn").addEventListener("click", async () => {
    editor.saver
      .save()
      .then((outputData) => {
        const newData = outputData.blocks?.[0]?.data?.code ?? "";
        if (currentFieldInfo && typeof currentFieldInfo.onSave === "function") {
          currentFieldInfo.onSave(newData);
        }
        if (currentFieldInfo?.cell) {
          const span = currentFieldInfo.cell.querySelector("span");
          const key = currentFieldInfo.fieldKey;
          const esc = (s) =>
            String(s).replace(
              /[&<>\"']/g,
              (m) =>
                ({
                  "&": "&amp;",
                  "<": "&lt;",
                  ">": "&gt;",
                  '"': "&quot;",
                  "'": "&#39;",
                }[m])
            );
          if (["from", "dest", "opts", "spec"].includes(key)) {
            const t = String(newData).trim();
            if (t)
              span.innerHTML = `<pre class=\"code-block\">${esc(
                newData
              )}</pre>`;
            else span.textContent = "";
          } else {
            span.textContent = newData;
          }
        }
        closeModal("editModal");
      })
      .catch((error) => console.error(error));
  });

  // Mobile field editor - full screen drawer
  function openMobileFieldEditor(fieldKey, currentValue, fieldType, onSave) {
    const modal = document.getElementById("editModal");
    const modalLabel = document.getElementById("editModalLabel");
    const editorContainer = document.getElementById("editorjs");
    const saveBtn = document.getElementById("saveEditBtn");

    if (!modal || !editorContainer || !saveBtn) return;

    // Set title with field name
    const fieldNames = {
      name: "名称",
      from: "源路径",
      dest: "目标路径",
      opts: "选项",
      spec: "规格",
      enabled: "启用状态",
      interval: "间隔时间",
    };
    modalLabel.textContent = `编辑 ${fieldNames[fieldKey] || fieldKey}`;

    // Create editor
    const isTextarea =
      fieldType === "json" ||
      ["from", "dest", "opts", "spec"].includes(fieldKey);
    const editorTag = isTextarea ? "textarea" : "input";
    const editor = document.createElement(editorTag);
    editor.className = "form-control mobile-field-editor";
    editor.value = currentValue ?? "";

    if (isTextarea) {
      editor.rows = 12;
      editor.style.fontFamily =
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    }

    editorContainer.innerHTML = "";
    editorContainer.appendChild(editor);

    // Save handler
    const handleSave = async () => {
      let parsed;
      const raw = editor.value;
      try {
        if (fieldType === "int") parsed = parseInt(String(raw), 10);
        else if (fieldType === "json")
          parsed = raw ? JSON.parse(String(raw)) : {};
        else parsed = String(raw);
      } catch (e) {
        showToast("Invalid JSON");
        return;
      }

      // Show loading state
      const originalText = newSaveBtn.textContent;
      newSaveBtn.disabled = true;
      newSaveBtn.innerHTML = '<span class="spinner"></span> 保存中...';
      newSaveBtn.classList.add("btn-loading");

      try {
        // Close modal immediately for better UX
        closeModal("editModal");

        // Save in background
        await onSave(parsed);

        // Show success feedback
        showToast("✓ 保存成功", "success");
      } catch (error) {
        // Reopen modal on error
        openModal("editModal");
        showToast("✗ 保存失败", "error");
        console.error(error);
      } finally {
        newSaveBtn.disabled = false;
        newSaveBtn.textContent = originalText;
        newSaveBtn.classList.remove("btn-loading");
      }
    };

    // Remove old listeners and bind new ones
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener("click", handleSave);

    // Cancel button
    const cancelBtn = document.getElementById("cancelEditBtn");
    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener("click", () => {
        closeModal("editModal");
      });
    }

    openModal("editModal");
    setTimeout(() => {
      editor.focus();
      if (editor.select) editor.select();
    }, 300);
  }

  // Pure modal helpers
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    // close on backdrop
    function onBackdrop(e) {
      if (e.target === el) closeModal(id);
    }
    el.__backdrop = onBackdrop;
    el.addEventListener("click", onBackdrop);
    // close on Esc
    function onEsc(e) {
      if (e.key === "Escape") closeModal(id);
    }
    el.__onEsc = onEsc;
    document.addEventListener("keydown", onEsc);
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    if (el.__backdrop) el.removeEventListener("click", el.__backdrop);
    if (el.__onEsc) document.removeEventListener("keydown", el.__onEsc);
  }

  // UI element helpers
  function createButton(text, className, onClick, { title, icon } = {}) {
    const btn = document.createElement("button");
    btn.className = className + " action-btn btn-icon";
    btn.innerHTML = (icon ? icon : "") + (text ? ` ${text}` : "");
    if (title) btn.title = title;
    btn.setAttribute("aria-label", title || text || "action");
    btn.onclick = onClick;
    return btn;
  }

  function createEditableCell(item, key, type, onPersist) {
    const cell = document.createElement("td");
    cell.classList.add("editable");
    const value = item[key];
    const displayRaw =
      typeof value === "object" ? JSON.stringify(value, null, 2) : value ?? "";
    const span = document.createElement("span");
    const esc = (s) =>
      String(s).replace(
        /[&<>\"']/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[m])
      );
    if (["from", "dest", "opts", "spec"].includes(key)) {
      const t = String(displayRaw).trim();
      if (t)
        span.innerHTML = `<pre class=\"code-block\">${esc(displayRaw)}</pre>`;
      else span.textContent = "";
    } else {
      span.textContent = displayRaw;
    }
    cell.appendChild(span);
    const startInlineEdit = () => {
      if (cell.__editing) return;

      // Mobile: use full-screen drawer editor
      if (window.innerWidth <= 768) {
        openMobileFieldEditor(key, displayRaw, type, async (newValue) => {
          await onPersist(key, newValue);
          // Update UI
          const span = cell.querySelector("span");
          if (["from", "dest", "opts", "spec"].includes(key)) {
            const esc = (s) =>
              String(s).replace(
                /[&<>\"']/g,
                (m) =>
                  ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                  }[m])
              );
            const t = String(newValue).trim();
            if (t)
              span.innerHTML = `<pre class=\"code-block\">${esc(
                newValue
              )}</pre>`;
            else span.textContent = "";
          } else {
            span.textContent = newValue;
          }
        });
        return;
      }

      // Desktop: inline editing
      cell.__editing = true;
      cell.setAttribute("data-editing", "true");

      const editorTag =
        type === "json" || ["from", "dest", "opts", "spec"].includes(key)
          ? "textarea"
          : "input";
      const editor = document.createElement(editorTag);
      editor.className = "form-control inline-editor";
      editor.style.width = "100%";

      if (editorTag === "textarea") {
        editor.rows = 6;
      }

      editor.value = displayRaw ?? "";

      const span = cell.querySelector("span");
      span.style.display = "none";
      cell.appendChild(editor);

      editor.focus();
      if (editor.select) editor.select();

      const commit = async () => {
        if (!cell.__editing) return;
        let parsed;
        const raw = editor.value;
        try {
          if (type === "int") parsed = parseInt(String(raw), 10);
          else if (type === "json") parsed = raw ? JSON.parse(String(raw)) : {};
          else parsed = String(raw);
        } catch (e) {
          showToast("Invalid JSON");
          editor.focus();
          return;
        }

        // Optimistic UI update - update immediately
        if (["from", "dest", "opts", "spec"].includes(key)) {
          const esc = (s) =>
            String(s).replace(
              /[&<>"']/g,
              (m) =>
                ({
                  "&": "&amp;",
                  "<": "&lt;",
                  ">": "&gt;",
                  '"': "&quot;",
                  "'": "&#39;",
                }[m])
            );
          const t = String(raw).trim();
          if (t) span.innerHTML = `<pre class=\"code-block\">${esc(raw)}</pre>`;
          else span.textContent = "";
        } else {
          span.textContent = String(raw);
        }

        // Close editor immediately
        cleanup();

        // Save in background
        try {
          await onPersist(key, parsed);
          // Optional: show subtle success feedback
          // showToast("✓", "success");
        } catch (error) {
          showToast("✗ 保存失败", "error");
          console.error(error);
          // Could revert UI here if needed
        }
      };

      const cancel = () => {
        if (!cell.__editing) return;
        cleanup();
      };

      const onKey = (e) => {
        if (e.key === "Enter" && !(e.shiftKey && editorTag === "textarea")) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      };
      editor.addEventListener("keydown", onKey);
      editor.addEventListener("blur", commit);

      function cleanup() {
        editor.removeEventListener("keydown", onKey);
        editor.removeEventListener("blur", commit);
        if (editor.parentNode === cell) cell.removeChild(editor);
        span.style.display = "";
        cell.__editing = false;
        cell.removeAttribute("data-editing");
      }
    };
    cell.__openEditor = startInlineEdit;
    // Desktop: single-click to edit
    cell.addEventListener("click", startInlineEdit);
    // Mobile: long-press
    attachLongPress(cell, startInlineEdit);
    return cell;
  }

  function attachLongPress(el, handler) {
    const isCoarse = () =>
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    let timer = null,
      startX = 0,
      startY = 0,
      active = false;
    const thresholdMs = 500,
      movePx = 10;
    function start(ev) {
      if (!isCoarse() && ev.pointerType !== "touch") return;
      active = true;
      startX = ev.clientX || (ev.touches && ev.touches[0]?.clientX) || 0;
      startY = ev.clientY || (ev.touches && ev.touches[0]?.clientY) || 0;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (active) handler();
      }, thresholdMs);
    }
    function move(ev) {
      if (!timer) return;
      const x = ev.clientX || (ev.touches && ev.touches[0]?.clientX) || 0;
      const y = ev.clientY || (ev.touches && ev.touches[0]?.clientY) || 0;
      if (Math.abs(x - startX) > movePx || Math.abs(y - startY) > movePx) {
        clearTimeout(timer);
        timer = null;
        active = false;
      }
    }
    function cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      active = false;
    }
    el.addEventListener("pointerdown", start, { passive: true });
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerup", cancel, { passive: true });
    el.addEventListener("pointercancel", cancel, { passive: true });
    el.addEventListener("pointerleave", cancel, { passive: true });
    // Fallback for touch events if pointer events are not supported
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", cancel, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
  }

  // (Expand/Collapse removed by request)

  // Excel-like selection and keyboard nav
  let selectedCell = null;
  function selectCell(td) {
    if (selectedCell) selectedCell.classList.remove("cell-selected");
    selectedCell = td;
    if (selectedCell) selectedCell.classList.add("cell-selected");
  }
  document.addEventListener("click", (e) => {
    const td = e.target.closest("td.editable");
    if (!td) return;
    selectCell(td);
  });
  document.addEventListener("keydown", (e) => {
    if (!selectedCell) return;
    const tag = (e.target && e.target.tagName) || "";
    if (["INPUT", "TEXTAREA"].includes(tag)) return;
    const table = selectedCell.closest("table");
    if (!table) return;
    const row = selectedCell.parentElement;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const rowIndex = rows.indexOf(row);
    const editableInRow = Array.from(row.querySelectorAll("td.editable"));
    const colIndex = editableInRow.indexOf(selectedCell);
    if (colIndex === -1) return;
    let target = null;
    if (e.key === "Enter") {
      if (selectedCell.__openEditor) selectedCell.__openEditor();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft") {
      target = editableInRow[colIndex - 1] || selectedCell;
    } else if (e.key === "ArrowRight") {
      target = editableInRow[colIndex + 1] || selectedCell;
    } else if (e.key === "ArrowUp") {
      for (let r = rowIndex - 1; r >= 0; r--) {
        const candidate = rows[r].querySelectorAll("td.editable")[colIndex];
        if (candidate) {
          target = candidate;
          break;
        }
      }
    } else if (e.key === "ArrowDown") {
      for (let r = rowIndex + 1; r < rows.length; r++) {
        const candidate = rows[r].querySelectorAll("td.editable")[colIndex];
        if (candidate) {
          target = candidate;
          break;
        }
      }
    }
    if (target) {
      selectCell(target);
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      e.preventDefault();
    }
  });

  function buildFormFields(container, fields, initialData = {}) {
    container.innerHTML = "";
    fields.forEach((f) => {
      const div = document.createElement("div");
      div.className = "form-group mb-2";
      const label = document.createElement("label");
      label.textContent =
        f.label ?? f.key.charAt(0).toUpperCase() + f.key.slice(1);
      const input = document.createElement(
        f.type === "json" ? "textarea" : "input"
      );
      input.className = "form-control";
      input.name = f.key;
      if (f.type === "json") input.rows = 3;
      const v = initialData[f.key];
      if (v !== undefined) {
        input.value = f.type === "json" ? JSON.stringify(v, null, 2) : v;
      }
      div.appendChild(label);
      div.appendChild(input);
      container.appendChild(div);
    });
  }

  function collectFormPayload(form, fields) {
    const fd = new FormData(form);
    const payload = {};
    for (const f of fields) {
      const raw = fd.get(f.key);
      if (raw === null) continue;
      const s = String(raw);
      try {
        if (f.type === "int") payload[f.key] = parseInt(s, 10);
        else if (f.type === "json") payload[f.key] = s ? JSON.parse(s) : {};
        else payload[f.key] = s;
      } catch (e) {
        showToast(`Invalid ${f.key}`);
        return null;
      }
    }
    return payload;
  }

  // Icons
  function svg(pathD) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="${pathD}"/></svg>`;
  }
  const icons = {
    copy: svg(
      "M16 1H6a2 2 0 0 0-2 2v10h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 13H10V7h9v11z"
    ),
    trash: svg("M9 3h6v2h5v2H4V5h5V3zm1 6h2v9h-2V9zm4 0h2v9h-2V9z"),
    play: svg("M8 5v14l11-7-11-7z"),
    edit: svg(
      "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
    ),
  };

  class ResourceManager {
    constructor(cfg) {
      this.cfg = cfg;
    }

    async load() {
      this.showSkeleton();
      const list = await api.get(this.cfg.endpoint).catch(() => []);
      this.render(list || []);
    }

    render(items) {
      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        this.renderMobileCards(items);
      } else {
        this.renderDesktopTable(items);
      }
    }

    renderMobileCards(items) {
      const tableWrap = document.querySelector(
        `#${this.cfg.tableId}`
      ).parentElement;
      const panelBody = tableWrap.parentElement;

      // Hide table wrap completely
      tableWrap.style.display = "none";

      let cardContainer = panelBody.querySelector(".mobile-card-container");
      if (!cardContainer) {
        cardContainer = document.createElement("div");
        cardContainer.className = "mobile-card-container";
        panelBody.appendChild(cardContainer);
      }

      cardContainer.style.display = "flex";
      cardContainer.innerHTML = "";

      if (!items.length) {
        cardContainer.innerHTML = '<div class="ui-empty">No data found</div>';
        return;
      }

      items.forEach((item) => {
        const card = this.createMobileCard(item);
        cardContainer.appendChild(card);
      });
    }

    createMobileCard(item) {
      const card = document.createElement("div");
      card.className = "data-card";

      const originalId = item[this.cfg.idKey];
      const patchUrl = () => `${this.cfg.endpoint}/${originalId}`;

      // Card header with ID/Name and toggle
      const header = document.createElement("div");
      header.className = "data-card-header";
      const idField = this.cfg.columns[0];
      const idValue = item[idField.key] || "";

      const title = document.createElement("h3");
      title.textContent = idValue;

      const toggle = document.createElement("span");
      toggle.className = "data-card-toggle";
      toggle.innerHTML = "▼";

      header.appendChild(title);
      header.appendChild(toggle);
      card.appendChild(header);

      // Content wrapper for collapse animation
      const content = document.createElement("div");
      content.className = "data-card-content";

      // Card body with fields
      const body = document.createElement("div");
      body.className = "data-card-body";

      this.cfg.columns.slice(1).forEach((col) => {
        const field = document.createElement("div");
        field.className = "data-card-field";

        const label = document.createElement("div");
        label.className = "data-card-label";
        label.textContent = col.label || col.key;

        const value = document.createElement("div");
        value.className = "data-card-value";

        const cellContent = this.createEditableCellContent(
          item,
          col.key,
          col.type,
          async (key, newVal) => {
            const data = {};
            data[key] = newVal;
            await api.patch(patchUrl(), data);
            if (key === this.cfg.idKey) {
              await this.load();
            } else {
              item[key] = newVal;
            }
          }
        );

        value.appendChild(cellContent);
        field.appendChild(label);
        field.appendChild(value);
        body.appendChild(field);
      });

      content.appendChild(body);

      // Card footer with actions
      const footer = document.createElement("div");
      footer.className = "data-card-footer";

      footer.appendChild(
        createButton(
          "复制",
          "ui-btn ui-btn-ghost ui-btn-sm",
          () => this.openInlineAddRow(item),
          { title: "Copy", icon: icons.copy }
        )
      );

      footer.appendChild(
        createButton(
          "删除",
          "ui-btn ui-btn-danger ui-btn-sm",
          async () => {
            if (!confirm("Delete this item?")) return;
            await api.del(patchUrl());
            await this.load();
          },
          { title: "Delete", icon: icons.trash }
        )
      );

      if (typeof this.cfg.extraActions === "function") {
        this.cfg.extraActions(footer, item);
      }

      content.appendChild(footer);
      card.appendChild(content);

      // Toggle collapse on header click
      header.addEventListener("click", () => {
        card.classList.toggle("collapsed");
      });

      return card;
    }

    createEditableCellContent(item, key, type, onPersist) {
      const span = document.createElement("span");
      span.className = "editable-content";

      const value = item[key];
      const displayRaw =
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : value ?? "";

      const esc = (s) =>
        String(s).replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            }[m])
        );

      if (["from", "dest", "opts", "spec"].includes(key)) {
        const t = String(displayRaw).trim();
        if (t)
          span.innerHTML = `<pre class="code-block">${esc(displayRaw)}</pre>`;
        else span.textContent = "";
      } else {
        span.textContent = displayRaw;
      }

      // Make it clickable to edit
      span.style.cursor = "pointer";
      span.addEventListener("click", () => {
        openMobileFieldEditor(key, displayRaw, type, async (newValue) => {
          await onPersist(key, newValue);
          // Update UI
          if (["from", "dest", "opts", "spec"].includes(key)) {
            const t = String(newValue).trim();
            if (t)
              span.innerHTML = `<pre class="code-block">${esc(newValue)}</pre>`;
            else span.textContent = "";
          } else {
            span.textContent = newValue;
          }
        });
      });

      return span;
    }

    renderDesktopTable(items) {
      const tableWrap = document.querySelector(
        `#${this.cfg.tableId}`
      ).parentElement;
      const panelBody = tableWrap.parentElement;
      const cardContainer = panelBody.querySelector(".mobile-card-container");

      // Show table wrap, hide cards
      tableWrap.style.display = "";
      if (cardContainer) cardContainer.style.display = "none";

      const tbody = document.querySelector(`#${this.cfg.tableId} tbody`);
      tbody.innerHTML = "";
      if (!items.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = this.cfg.columns.length + 1;
        cell.innerHTML = '<div class="ui-empty">No data found</div>';
        row.appendChild(cell);
        tbody.appendChild(row);
      }
      items.forEach((item) => {
        const row = document.createElement("tr");
        const originalId = item[this.cfg.idKey];
        const patchUrl = () => `${this.cfg.endpoint}/${originalId}`;
        this.cfg.columns.forEach((col) => {
          row.appendChild(
            createEditableCell(item, col.key, col.type, async (key, newVal) => {
              const data = {};
              data[key] = newVal;
              await api.patch(patchUrl(), data);
              if (key === this.cfg.idKey) {
                // If ID key changed (rename), reload to rebind row actions
                await this.load();
              } else {
                // Update local item for snappy UI
                item[key] = newVal;
              }
            })
          );
        });

        const actionCell = document.createElement("td");
        actionCell.classList.add("action-cell");
        // Copy
        actionCell.appendChild(
          createButton(
            "",
            "ui-btn ui-btn-ghost ui-btn-sm ui-icon-btn",
            () => this.openInlineAddRow(item),
            { title: "Copy", icon: icons.copy }
          )
        );
        // Delete
        actionCell.appendChild(
          createButton(
            "",
            "ui-btn ui-btn-danger ui-btn-sm ui-icon-btn",
            async () => {
              if (!confirm("Delete this item?")) return;
              await api.del(patchUrl());
              await this.load();
            },
            { title: "Delete", icon: icons.trash }
          )
        );
        // Extra
        if (typeof this.cfg.extraActions === "function") {
          this.cfg.extraActions(actionCell, item);
        }
        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      // Bind floating add button if configured
      if (this.cfg.addButtonId) {
        const floatingBtn = document.getElementById(this.cfg.addButtonId);
        if (floatingBtn) {
          // Remove existing listeners to avoid duplicates
          const newBtn = floatingBtn.cloneNode(true);
          floatingBtn.parentNode.replaceChild(newBtn, floatingBtn);
          newBtn.addEventListener("click", () => this.openInlineAddRow({}));
        }
      }

      // initialize column resizers (once)
      initColumnResizers(this.cfg.tableId);
    }

    showSkeleton() {
      const tbody = document.querySelector(`#${this.cfg.tableId} tbody`);
      if (!tbody) return;
      tbody.innerHTML = "";
      const cols = this.cfg.columns.length + 1;
      for (let i = 0; i < 4; i++) {
        const tr = document.createElement("tr");
        for (let c = 0; c < cols; c++) {
          const td = document.createElement("td");
          const sk = document.createElement("div");
          sk.className = "ui-skel";
          td.appendChild(sk);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
    }

    openCreateModal(initialData = {}) {
      this.openInlineAddRow(initialData);
    }

    openInlineAddRow(initialData = {}) {
      const tbody = document.querySelector(`#${this.cfg.tableId} tbody`);
      const fields = this.cfg.createFields ?? this.cfg.columns;
      // Remove existing inline form if any
      const existing = tbody.querySelector("tr.__inline_add");
      if (existing) existing.remove();

      // Build a new row with per-column inputs (Excel-like)
      const tr = document.createElement("tr");
      tr.className = "__inline_add";
      // Build input cells aligned to columns
      for (const col of this.cfg.columns) {
        const td = document.createElement("td");
        td.className = "editable";
        const inputTag =
          col.type === "json" ||
          ["from", "dest", "opts", "spec"].includes(col.key)
            ? "textarea"
            : "input";
        const input = document.createElement(inputTag);
        input.className = "form-control";
        if (inputTag === "textarea") input.rows = 4;
        input.name = col.key;
        input.placeholder = placeholderFor(this.cfg.resource, col.key);
        const v = initialData[col.key];
        if (v !== undefined)
          input.value =
            col.type === "json" ? JSON.stringify(v, null, 2) : String(v);
        td.appendChild(input);
        tr.appendChild(td);
      }

      // Actions cell with Save/Cancel
      const actionTd = document.createElement("td");
      actionTd.className = "action-cell";
      const saveBtn = createButton(
        "Save",
        "ui-btn ui-btn-primary ui-btn-sm",
        async () => {
          const payload = {};
          for (const col of this.cfg.columns) {
            const el = tr.querySelector(`[name="${col.key}"]`);
            if (!el) continue;
            const raw = el.value ?? "";
            try {
              if (col.type === "int")
                payload[col.key] = parseInt(String(raw), 10);
              else if (col.type === "json")
                payload[col.key] = raw ? JSON.parse(String(raw)) : {};
              else payload[col.key] = String(raw);
            } catch (e) {
              showToast(`Invalid ${col.key}`);
              return;
            }
          }
          await api.post(this.cfg.endpoint, payload);
          await this.load();
        },
        { title: "Save" }
      );
      const cancelBtn = createButton(
        "Cancel",
        "ui-btn ui-btn-ghost ui-btn-sm",
        () => {
          tr.remove();
        },
        { title: "Cancel" }
      );
      actionTd.appendChild(saveBtn);
      actionTd.appendChild(cancelBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    }
  }

  function placeholderFor(resource, key) {
    const mapAlist = {
      name: "Name",
      endpoint: "Endpoint e.g. http://host:port",
      token: "Alist token",
    };
    const mapJob = {
      name: "Name",
      from: "From (one path per line)",
      dest: "Dest e.g. /data/media/Movies",
      mode: "Mode: alist_url | alist_path | raw_url",
      opts: "Opts (JSON)",
      alist: "Alist index (number)",
      spec: "Spec (cron) or empty",
      concurrency: "Concurrency (number)",
    };
    const m = resource === "job" ? mapJob : mapAlist;
    return m[key] || key;
  }

  // Column resizer init
  function initColumnResizers(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const ths = table.querySelectorAll("thead th");
    ths.forEach((th, idx) => {
      if (th.querySelector(".col-resizer")) return;
      const resizer = document.createElement("div");
      resizer.className = "col-resizer";
      th.appendChild(resizer);

      let startX = 0,
        startW = 0;
      function onMove(e) {
        const dx =
          (e.clientX || (e.touches && e.touches[0]?.clientX) || 0) - startX;
        const newW = Math.max(48, startW + dx);
        th.style.width = newW + "px";
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach((r) => {
          const td = r.querySelectorAll("td")[idx];
          if (td) td.style.width = newW + "px";
        });
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      }
      function onDown(e) {
        startX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        startW = th.getBoundingClientRect().width;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        document.addEventListener("touchmove", onMove, { passive: false });
        document.addEventListener("touchend", onUp);
        e.preventDefault();
      }
      resizer.addEventListener("mousedown", onDown);
      resizer.addEventListener("touchstart", onDown, { passive: false });
    });
  }

  // Managers
  const alistMgr = new ResourceManager({
    tableId: "alistTable",
    addButtonId: "addAlistBtn",
    resource: "alist",
    endpoint: "/api/alist",
    idKey: "name",
    columns: [
      { key: "name", type: "text", label: "名称" },
      { key: "endpoint", type: "text", label: "端点" },
      { key: "token", type: "text", label: "令牌" },
    ],
    createFields: [
      { key: "name", type: "text", label: "Name" },
      { key: "endpoint", type: "text", label: "Endpoint" },
      { key: "token", type: "text", label: "Token" },
    ],
  });

  window.alistMgr = alistMgr;

  const jobMgr = new ResourceManager({
    tableId: "jobTable",
    addButtonId: "addJobBtn",
    resource: "job",
    endpoint: "/api/job",
    idKey: "id",
    columns: [
      { key: "name", type: "text", label: "名称" },
      { key: "from", type: "text", label: "源路径" },
      { key: "dest", type: "text", label: "目标路径" },
      { key: "mode", type: "text", label: "模式" },
      { key: "opts", type: "json", label: "选项" },
      { key: "alist", type: "int", label: "Alist" },
      { key: "spec", type: "text", label: "定时规则" },
      { key: "concurrency", type: "int", label: "并发数" },
    ],
    createFields: [
      { key: "name", type: "text", label: "Name" },
      { key: "from", type: "text", label: "From" },
      { key: "dest", type: "text", label: "Dest" },
      { key: "mode", type: "text", label: "Mode" },
      { key: "opts", type: "json", label: "Opts (JSON)" },
      { key: "alist", type: "int", label: "Alist" },
      { key: "spec", type: "text", label: "Spec (cron)" },
      { key: "concurrency", type: "int", label: "Concurrency" },
    ],
    extraActions: (cell, item) => {
      cell.prepend(
        createButton(
          "",
          "ui-btn ui-btn-success ui-btn-sm ui-icon-btn",
          async () => {
            await api.post(`/api/job/${item.id}`, {});
          },
          { title: "Run", icon: icons.play }
        )
      );
    },
  });

  window.jobMgr = jobMgr;

  // Emby Configuration Management
  async function loadEmbyConfig() {
    try {
      const data = await api.get("/api/emby");
      const emby = data.emby || {};

      // Save to global variable
      currentEmbyConfig = emby;

      document.getElementById("embyAddr").value = emby.addr || "";
      document.getElementById("embyApiKey").value = emby.apiKey || "";

      // Load HTTP Strm rules
      renderHttpStrmTable(emby.httpStrm || []);

      // Load Alist Strm rules
      renderAlistStrmTable(emby.alistStrm || []);
    } catch (error) {
      showToast("加载 Emby 配置失败", "error");
    }
  }

  let currentEmbyConfig = null;

  function renderHttpStrmTable(rules) {
    const tbody = document.querySelector("#httpStrmTable tbody");
    tbody.innerHTML = "";

    if (!rules || rules.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; color: var(--muted);">暂无规则</td></tr>';
      return;
    }

    rules.forEach((rule, index) => {
      const tr = document.createElement("tr");

      const actionsStr =
        rule.actions && rule.actions.length > 0
          ? rule.actions.map((a) => `${a.type}: ${a.args}`).join(", ")
          : "无";

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions-cell";

      const editBtn = createButton(
        "",
        "ui-btn ui-btn-ghost ui-btn-sm ui-icon-btn edit-http-strm",
        null,
        { title: "编辑", icon: icons.edit }
      );
      editBtn.dataset.index = index;

      const deleteBtn = createButton(
        "",
        "ui-btn ui-btn-danger ui-btn-sm ui-icon-btn delete-http-strm",
        null,
        { title: "删除", icon: icons.trash }
      );
      deleteBtn.dataset.index = index;

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);

      tr.innerHTML = `
        <td>${rule.enable ? "✓" : "✗"}</td>
        <td>${rule.match || ""}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${actionsStr}</td>
        <td>${rule.transCode ? "✓" : "✗"}</td>
        <td>${rule.finalURL ? "✓" : "✗"}</td>
      `;
      tr.appendChild(actionsCell);
      tbody.appendChild(tr);
    });
  }

  function renderAlistStrmTable(rules) {
    const tbody = document.querySelector("#alistStrmTable tbody");
    tbody.innerHTML = "";

    if (!rules || rules.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; color: var(--muted);">暂无规则</td></tr>';
      return;
    }

    rules.forEach((rule, index) => {
      const tr = document.createElement("tr");

      const actionsStr = rule.actions
        ? `${rule.actions.type}: ${rule.actions.args}`
        : "无";

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions-cell";

      const editBtn = createButton(
        "",
        "ui-btn ui-btn-ghost ui-btn-sm ui-icon-btn edit-alist-strm",
        null,
        { title: "编辑", icon: icons.edit }
      );
      editBtn.dataset.index = index;

      const deleteBtn = createButton(
        "",
        "ui-btn ui-btn-danger ui-btn-sm ui-icon-btn delete-alist-strm",
        null,
        { title: "删除", icon: icons.trash }
      );
      deleteBtn.dataset.index = index;

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);

      tr.innerHTML = `
        <td>${rule.enable ? "✓" : "✗"}</td>
        <td>${rule.match || ""}</td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${actionsStr}</td>
        <td>${rule.alist !== undefined ? rule.alist : ""}</td>
        <td>${rule.transCode ? "✓" : "✗"}</td>
        <td>${rule.rawURL ? "✓" : "✗"}</td>
      `;
      tr.appendChild(actionsCell);
      tbody.appendChild(tr);
    });
  }

  document
    .getElementById("saveEmbyConfig")
    .addEventListener("click", async () => {
      try {
        const addr = document.getElementById("embyAddr").value;
        const apiKey = document.getElementById("embyApiKey").value;

        // 保留现有的 httpStrm 和 alistStrm
        currentEmbyConfig.addr = addr;
        currentEmbyConfig.apiKey = apiKey;

        await api.patch("/api/emby", {
          emby: currentEmbyConfig,
        });

        showToast("✓ Emby 配置保存成功", "success");
      } catch (error) {
        showToast("✗ 保存失败", "error");
      }
    });

  // HTTP Strm Rule Editor
  function openHttpStrmEditor(index = -1) {
    const isNew = index === -1;
    const rule = isNew
      ? {
          enable: true,
          match: "",
          actions: [],
          transCode: false,
          finalURL: false,
        }
      : { ...currentEmbyConfig.httpStrm[index] };

    const form = document.getElementById("strmRuleForm");

    const actionsHtml =
      rule.actions && rule.actions.length > 0
        ? rule.actions
            .map(
              (a, i) => `
          <div class="action-item" data-index="${i}">
            <input type="text" class="form-control action-type" value="${
              a.type || "replace"
            }" placeholder="replace" style="width: 100px;" />
            <span style="margin: 0 8px;">→</span>
            <input type="text" class="form-control action-args" value="${
              a.args || ""
            }" placeholder="old -> new" style="flex: 1;" />
            <button type="button" class="ui-btn ui-btn-sm ui-btn-danger remove-action" data-index="${i}">删除</button>
          </div>
        `
            )
            .join("")
        : "";

    form.innerHTML = `
      <div class="form-group">
        <label>
          <input type="checkbox" id="httpStrmEnable" ${
            rule.enable ? "checked" : ""
          } />
          启用规则
        </label>
      </div>
      <div class="form-group">
        <label>匹配规则（正则表达式）</label>
        <input type="text" id="httpStrmMatch" class="form-control" value="${
          rule.match || ""
        }" placeholder="/data/media" />
        <small style="color: var(--muted); font-size: 12px;">匹配 strm 文件的本地存储路径</small>
      </div>
      <div class="form-group">
        <label>操作列表</label>
        <div id="httpStrmActionsList" class="actions-list">
          ${actionsHtml}
        </div>
        <button type="button" id="addHttpAction" class="ui-btn ui-btn-sm ui-btn-ghost" style="margin-top: 8px;">+ 添加操作</button>
        <small style="color: var(--muted); font-size: 12px; display: block; margin-top: 8px;">
          示例：type=replace, args=host.docker.internal -> youremby.com
        </small>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="httpStrmTransCode" ${
            rule.transCode ? "checked" : ""
          } />
          开启转码
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="httpStrmFinalURL" ${
            rule.finalURL ? "checked" : ""
          } />
          最终URL（减少重定向次数）
        </label>
      </div>
    `;

    // 添加操作按钮事件
    document.getElementById("addHttpAction").addEventListener("click", () => {
      const list = document.getElementById("httpStrmActionsList");
      const index = list.children.length;
      const div = document.createElement("div");
      div.className = "action-item";
      div.dataset.index = index;
      div.innerHTML = `
        <input type="text" class="form-control action-type" value="replace" placeholder="replace" style="width: 100px;" />
        <span style="margin: 0 8px;">→</span>
        <input type="text" class="form-control action-args" value="" placeholder="old -> new" style="flex: 1;" />
        <button type="button" class="ui-btn ui-btn-sm ui-btn-danger remove-action">删除</button>
      `;
      list.appendChild(div);
    });

    // 删除操作按钮事件
    form.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-action")) {
        e.target.closest(".action-item").remove();
      }
    });

    document.getElementById("strmRuleModalLabel").textContent = isNew
      ? "新增 HTTP Strm 规则"
      : "编辑 HTTP Strm 规则";

    const saveBtn = document.getElementById("saveStrmRuleBtn");
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener("click", async () => {
      const enable = document.getElementById("httpStrmEnable").checked;
      const match = document.getElementById("httpStrmMatch").value.trim();
      const transCode = document.getElementById("httpStrmTransCode").checked;
      const finalURL = document.getElementById("httpStrmFinalURL").checked;

      if (!match) {
        showToast("请填写匹配规则", "error");
        return;
      }

      // 读取操作列表
      const actionItems = document.querySelectorAll(
        "#httpStrmActionsList .action-item"
      );
      const actions = Array.from(actionItems)
        .map((item) => {
          const type =
            item.querySelector(".action-type").value.trim() || "replace";
          const args = item.querySelector(".action-args").value.trim();
          return { type, args };
        })
        .filter((a) => a.args); // 过滤掉空的操作

      const newRule = { enable, match, actions, transCode, finalURL };

      if (isNew) {
        currentEmbyConfig.httpStrm = currentEmbyConfig.httpStrm || [];
        currentEmbyConfig.httpStrm.push(newRule);
      } else {
        currentEmbyConfig.httpStrm[index] = newRule;
      }

      await saveEmbyConfig();
      closeModal("strmRuleModal");
    });

    const cancelBtn = document.getElementById("cancelStrmRuleBtn");
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener("click", () => closeModal("strmRuleModal"));

    openModal("strmRuleModal");
  }

  // Alist Strm Rule Editor
  function openAlistStrmEditor(index = -1) {
    const isNew = index === -1;
    const rule = isNew
      ? {
          enable: true,
          match: "",
          actions: { type: "replace", args: "" },
          alist: 0,
          transCode: false,
          rawURL: false,
        }
      : { ...currentEmbyConfig.alistStrm[index] };

    const form = document.getElementById("strmRuleForm");
    form.innerHTML = `
      <div class="form-group">
        <label>
          <input type="checkbox" id="alistStrmEnable" ${
            rule.enable ? "checked" : ""
          } />
          启用规则
        </label>
      </div>
      <div class="form-group">
        <label>匹配规则（正则表达式）</label>
        <input type="text" id="alistStrmMatch" class="form-control" value="${
          rule.match || ""
        }" placeholder="/data/media" />
      </div>
      <div class="form-group">
        <label>操作（格式：type -> args）</label>
        <input type="text" id="alistStrmActions" class="form-control" value="${
          rule.actions
            ? `${rule.actions.type} -> ${rule.actions.args}`
            : "replace -> "
        }" placeholder="replace -> host.docker.internal -> youremby.com" />
      </div>
      <div class="form-group">
        <label>Alist 索引</label>
        <input type="number" id="alistStrmAlist" class="form-control" value="${
          rule.alist || 0
        }" min="0" />
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="alistStrmTransCode" ${
            rule.transCode ? "checked" : ""
          } />
          开启转码
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="alistStrmRawURL" ${
            rule.rawURL ? "checked" : ""
          } />
          使用原始URL（网盘直链）
        </label>
      </div>
    `;

    document.getElementById("strmRuleModalLabel").textContent = isNew
      ? "新增 Alist Strm 规则"
      : "编辑 Alist Strm 规则";

    const saveBtn = document.getElementById("saveStrmRuleBtn");
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener("click", async () => {
      const enable = document.getElementById("alistStrmEnable").checked;
      const match = document.getElementById("alistStrmMatch").value.trim();
      const actionsText = document
        .getElementById("alistStrmActions")
        .value.trim();
      const alist =
        parseInt(document.getElementById("alistStrmAlist").value) || 0;
      const transCode = document.getElementById("alistStrmTransCode").checked;
      const rawURL = document.getElementById("alistStrmRawURL").checked;

      if (!match) {
        showToast("请填写匹配规则", "error");
        return;
      }

      const parts = actionsText.split("->").map((p) => p.trim());
      const actions = {
        type: parts[0] || "replace",
        args: parts.slice(1).join(" -> "),
      };

      const newRule = { enable, match, actions, alist, transCode, rawURL };

      if (isNew) {
        currentEmbyConfig.alistStrm = currentEmbyConfig.alistStrm || [];
        currentEmbyConfig.alistStrm.push(newRule);
      } else {
        currentEmbyConfig.alistStrm[index] = newRule;
      }

      await saveEmbyConfig();
      closeModal("strmRuleModal");
    });

    const cancelBtn = document.getElementById("cancelStrmRuleBtn");
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener("click", () => closeModal("strmRuleModal"));

    openModal("strmRuleModal");
  }

  async function saveEmbyConfig() {
    try {
      await api.patch("/api/emby", { emby: currentEmbyConfig });
      showToast("✓ 保存成功", "success");
      await loadEmbyConfig();
    } catch (error) {
      showToast("✗ 保存失败", "error");
    }
  }

  // Event Listeners
  document
    .getElementById("addHttpStrmBtn")
    .addEventListener("click", () => openHttpStrmEditor());
  document
    .getElementById("addAlistStrmBtn")
    .addEventListener("click", () => openAlistStrmEditor());

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("edit-http-strm")) {
      const index = parseInt(e.target.dataset.index);
      openHttpStrmEditor(index);
    } else if (e.target.classList.contains("delete-http-strm")) {
      const index = parseInt(e.target.dataset.index);
      if (confirm("确定要删除这条规则吗？")) {
        currentEmbyConfig.httpStrm.splice(index, 1);
        saveEmbyConfig();
      }
    } else if (e.target.classList.contains("edit-alist-strm")) {
      const index = parseInt(e.target.dataset.index);
      openAlistStrmEditor(index);
    } else if (e.target.classList.contains("delete-alist-strm")) {
      const index = parseInt(e.target.dataset.index);
      if (confirm("确定要删除这条规则吗？")) {
        currentEmbyConfig.alistStrm.splice(index, 1);
        saveEmbyConfig();
      }
    }
  });

  // Load Emby config when tab is activated
  const navEmby = document.getElementById("navEmby");
  if (navEmby) {
    navEmby.addEventListener("click", () => {
      setTimeout(loadEmbyConfig, 100);
    });
  }

  // Load Emby config if it's the initial active tab
  try {
    const activeTab = localStorage.getItem("astrm_active_tab");
    if (activeTab === "emby") {
      setTimeout(loadEmbyConfig, 200);
    }
  } catch {}

  // No top Add buttons; use inline add-rows

  // Close buttons (toast)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ui-close]");
    if (!btn) return;
    const type = btn.getAttribute("data-ui-close");
    if (type === "toast") {
      document.getElementById("liveToast").classList.remove("show");
    }
  });

  // Initial load
  Promise.all([alistMgr.load(), jobMgr.load()]).catch(console.error);
});
