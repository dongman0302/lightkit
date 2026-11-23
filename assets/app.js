(function () {
  "use strict";

  /* ---------- 标签切换 ---------- */
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  function activatePanel(panelId) {
    tabs.forEach((tab) => {
      const on = tab.dataset.panel === panelId;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", String(on));
    });
    panels.forEach((panel) => {
      const on = panel.id === panelId;
      panel.classList.toggle("is-active", on);
      panel.hidden = !on;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activatePanel(tab.dataset.panel));
  });

  /* ---------- 待办清单 ---------- */
  const STORAGE_KEY = "lightkit.todos.v1";
  const todoForm = document.getElementById("todo-form");
  const todoInput = document.getElementById("todo-input");
  const todoList = document.getElementById("todo-list");
  const todoEmpty = document.getElementById("todo-empty");
  const countAll = document.getElementById("count-all");
  const countActive = document.getElementById("count-active");
  const countDone = document.getElementById("count-done");
  const filterButtons = Array.from(document.querySelectorAll(".chip"));
  const clearDoneBtn = document.getElementById("clear-done");

  let todos = loadTodos();
  let filter = "all";

  function loadTodos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (err) {
      /* 隐私模式等场景下写入失败时保持页面可用 */
    }
  }

  function renderTodos() {
    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    countAll.textContent = String(total);
    countActive.textContent = String(total - done);
    countDone.textContent = String(done);

    const visible = todos.filter((t) => {
      if (filter === "active") return !t.done;
      if (filter === "done") return t.done;
      return true;
    });

    todoList.textContent = "";
    visible.forEach((todo) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.done ? " is-done" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.done;
      checkbox.setAttribute("aria-label", "标记完成");
      checkbox.addEventListener("change", () => {
        todo.done = checkbox.checked;
        saveTodos();
        renderTodos();
      });

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = todo.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "todo-del";
      del.textContent = "×";
      del.setAttribute("aria-label", "删除该待办");
      del.addEventListener("click", () => {
        todos = todos.filter((t) => t.id !== todo.id);
        saveTodos();
        renderTodos();
      });

      li.append(checkbox, text, del);
      todoList.appendChild(li);
    });

    todoEmpty.hidden = visible.length > 0;
    if (visible.length === 0) {
      todoEmpty.textContent =
        total === 0 ? "还没有待办事项，先添加一条吧。" : "当前筛选下没有事项。";
    }

    filterButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });
  }

  todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = todoInput.value.trim();
    if (!text) return;
    todos.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false });
    todoInput.value = "";
    saveTodos();
    renderTodos();
    todoInput.focus();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      renderTodos();
    });
  });

  clearDoneBtn.addEventListener("click", () => {
    todos = todos.filter((t) => !t.done);
    saveTodos();
    renderTodos();
  });

  renderTodos();

  /* ---------- 单位换算 ---------- */
  const CATEGORIES = {
    length: {
      base: "米",
      units: {
        米: 1,
        千米: 1000,
        厘米: 0.01,
        毫米: 0.001,
        英寸: 0.0254,
        英尺: 0.3048,
        码: 0.9144,
        英里: 1609.344,
        里: 500,
        尺: 1 / 3
      }
    },
    weight: {
      base: "千克",
      units: {
        千克: 1,
        克: 0.001,
        毫克: 0.000001,
        吨: 1000,
        斤: 0.5,
        磅: 0.45359237,
        盎司: 0.028349523125
      }
    },
    temperature: {
      base: "摄氏度",
      units: {
        摄氏度: { toBase: (v) => v, fromBase: (v) => v },
        华氏度: { toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
        开尔文: { toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 }
      }
    }
  };

  const unitCategory = document.getElementById("unit-category");
  const unitValue = document.getElementById("unit-value");
  const unitFrom = document.getElementById("unit-from");
  const unitTo = document.getElementById("unit-to");
  const unitResult = document.getElementById("unit-result");
  const unitResultUnit = document.getElementById("unit-result-unit");
  const unitSwap = document.getElementById("unit-swap");

  function fillSelect(select, names, selected) {
    select.textContent = "";
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === selected) option.selected = true;
      select.appendChild(option);
    });
  }

  function initUnitCategory() {
    const key = unitCategory.value;
    const names = Object.keys(CATEGORIES[key].units);
    fillSelect(unitFrom, names, names[0]);
    fillSelect(unitTo, names, names[1] || names[0]);
    convertUnits();
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
      return value.toExponential(6).replace(/\.?0+e/, "e");
    }
    return String(Number(value.toPrecision(10)));
  }

  function convertUnits() {
    const key = unitCategory.value;
    const config = CATEGORIES[key];
    const raw = parseFloat(unitValue.value);
    if (!Number.isFinite(raw)) {
      unitResult.textContent = "—";
      unitResultUnit.textContent = "";
      return;
    }

    const from = config.units[unitFrom.value];
    const to = config.units[unitTo.value];
    let output;

    if (key === "temperature") {
      output = to.fromBase(from.toBase(raw));
    } else {
      output = (raw * from) / to;
    }

    unitResult.textContent = formatNumber(output);
    unitResultUnit.textContent = unitTo.value;
  }

  unitCategory.addEventListener("change", initUnitCategory);
  unitValue.addEventListener("input", convertUnits);
  unitFrom.addEventListener("change", convertUnits);
  unitTo.addEventListener("change", convertUnits);
  unitSwap.addEventListener("click", () => {
    const a = unitFrom.value;
    unitFrom.value = unitTo.value;
    unitTo.value = a;
    convertUnits();
  });

  initUnitCategory();

  /* ---------- 时间戳转换 ---------- */
  const tsInput = document.getElementById("ts-input");
  const tsDateOut = document.getElementById("ts-date-out");
  const tsNowBtn = document.getElementById("ts-now");
  const dtInput = document.getElementById("dt-input");
  const dtTsOut = document.getElementById("dt-ts-out");
  const pad = (n) => String(n).padStart(2, "0");

  function formatLocalDate(date) {
    const offset = -date.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const offsetText = "UTC" + sign + pad(Math.floor(Math.abs(offset) / 60)) + ":" + pad(Math.abs(offset) % 60);
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) +
      ":" + pad(date.getMinutes()) +
      ":" + pad(date.getSeconds()) +
      "  (" + offsetText + ")"
    );
  }

  function parseTimestamp(text) {
    const trimmed = text.trim();
    if (!/^\d{1,13}$/.test(trimmed)) return null;
    const num = Number(trimmed);
    const ms = trimmed.length > 10 ? num : num * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function renderTimestamp() {
    const date = parseTimestamp(tsInput.value);
    tsDateOut.textContent = date ? formatLocalDate(date) : "—";
  }

  function renderTimestampFromDate() {
    if (!dtInput.value) {
      dtTsOut.textContent = "—";
      return;
    }
    const date = new Date(dtInput.value);
    if (Number.isNaN(date.getTime())) {
      dtTsOut.textContent = "—";
      return;
    }
    const seconds = Math.floor(date.getTime() / 1000);
    dtTsOut.textContent = seconds + " 秒 · " + date.getTime() + " 毫秒";
  }

  function fillNow() {
    const now = new Date();
    tsInput.value = String(Math.floor(now.getTime() / 1000));
    dtInput.value =
      now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      "T" + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    renderTimestamp();
    renderTimestampFromDate();
  }

  tsInput.addEventListener("input", renderTimestamp);
  dtInput.addEventListener("input", renderTimestampFromDate);
  tsNowBtn.addEventListener("click", fillNow);

  fillNow();
})();
