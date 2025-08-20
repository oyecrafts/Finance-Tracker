// Finance Tracker v2.1
// - Date filter (exact day)
// - Daily budget tracking
// - Saved categories + CSV import/export retained

const TX_KEY = "transactions-v1";
const BUDGET_KEY = "budget-day-v1"; // new key for daily budget
const CAT_KEY = "categories-v1";

// DOM
const txForm = document.getElementById("txForm");
const txType = document.getElementById("txType");
const txAmount = document.getElementById("txAmount");
const txCategory = document.getElementById("txCategory");
const categoryList = document.getElementById("categoryList");
const txDesc = document.getElementById("txDesc");
const txDate = document.getElementById("txDate");

const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

const sumIncome = document.getElementById("sumIncome");
const sumExpense = document.getElementById("sumExpense");
const sumBalance = document.getElementById("sumBalance");

const dailyBudget = document.getElementById("dailyBudget");
const saveBudgetBtn = document.getElementById("saveBudget");
const budgetNote = document.getElementById("budgetNote");

const searchInput = document.getElementById("search");
const datePicker = document.getElementById("datePicker");
const txTableBody = document.getElementById("txTableBody");
const emptyState = document.getElementById("emptyState");

// State
let transactions = loadJSON(TX_KEY, []);
let budget = loadJSON(BUDGET_KEY, null); // daily number
let categories = initCategories();

// Prefill today's date
const todayISO = new Date().toISOString().slice(0,10);
txDate.valueAsDate = new Date();
datePicker.value = ""; // no filter by default

let byMonthChart, byCategoryChart;

// Submit
txForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(txAmount.value);
  if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");
  const cat = txCategory.value.trim() || "Other";
  const tx = {
    id: crypto.randomUUID(),
    type: txType.value === "income" ? "income" : "expense",
    amount,
    category: cat,
    desc: txDesc.value.trim(),
    dateISO: new Date(txDate.value).toISOString().slice(0,10)
  };
  transactions.push(tx);
  addCategory(cat);
  saveJSON(TX_KEY, transactions);
  txForm.reset();
  txDate.valueAsDate = new Date();
  render();
});

resetBtn.addEventListener("click", () => {
  if (confirm("This will delete ALL transactions, budget, and saved categories. Continue?")) {
    localStorage.removeItem(TX_KEY);
    localStorage.removeItem(BUDGET_KEY);
    localStorage.removeItem(CAT_KEY);
    transactions = [];
    budget = null;
    categories = [];
    dailyBudget.value = "";
    budgetNote.textContent = "";
    render();
  }
});

exportBtn.addEventListener("click", () => {
  const csv = toCSV(transactions);
  downloadFile(csv, "transactions.csv", "text/csv;charset=utf-8;");
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result);
      const rows = fromCSV(text);
      if (!rows.length) return alert("No rows found in CSV.");
      const modeReplace = confirm("OK = Replace existing transactions with CSV. Cancel = Merge CSV into existing.");
      let incoming = normalizeRows(rows);
      incoming.forEach(r => addCategory(r.category));
      if (modeReplace) {
        transactions = incoming;
      } else {
        const map = new Map(transactions.map(t => [t.id, t]));
        for (const r of incoming) map.set(r.id, r);
        transactions = Array.from(map.values());
      }
      saveJSON(TX_KEY, transactions);
      saveJSON(CAT_KEY, categories);
      render();
      alert("Import successful.");
    } catch (err) {
      console.error(err);
      alert("Import failed. Please check your CSV format.");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
});

saveBudgetBtn.addEventListener("click", () => {
  const b = parseFloat(dailyBudget.value);
  if (isNaN(b) || b < 0) return alert("Enter a valid daily budget.");
  budget = b;
  saveJSON(BUDGET_KEY, budget);
  updateBudgetNote();
});

searchInput.addEventListener("input", renderTable);
datePicker.addEventListener("input", render);

// Storage utils
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// Categories
function initCategories() {
  const saved = loadJSON(CAT_KEY, []);
  const existing = Array.from(new Set((transactions || []).map(t => t.category).filter(Boolean)));
  const merged = uniq([...saved, ...existing]).sort(ciCompare);
  saveJSON(CAT_KEY, merged);
  renderCategoryList(merged);
  return merged;
}
function addCategory(cat) {
  if (!cat) return;
  if (!categories.includes(cat)) {
    categories.push(cat);
    categories = uniq(categories).sort(ciCompare);
    saveJSON(CAT_KEY, categories);
    renderCategoryList(categories);
  }
}
function renderCategoryList(list) {
  categoryList.innerHTML = "";
  list.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    categoryList.appendChild(opt);
  });
}

// Render
function render() {
  renderSummary();
  renderTable();
  renderCharts();
  if (budget != null) dailyBudget.value = budget;
  updateBudgetNote();
  renderCategoryList(categories);
}

function renderSummary() {
  const income = sum(transactions.filter(t => t.type === "income").map(t => t.amount));
  const expense = sum(transactions.filter(t => t.type === "expense").map(t => t.amount));
  const balance = income - expense;
  sumIncome.textContent = formatCurrency(income);
  sumExpense.textContent = formatCurrency(expense);
  sumBalance.textContent = formatCurrency(balance);
}

function renderTable() {
  const query = searchInput.value.trim().toLowerCase();
  const pickedDate = datePicker.value; // yyyy-mm-dd or ""
  const filtered = transactions
    .filter(t => !pickedDate || t.dateISO === pickedDate)
    .filter(t => !query || `${t.category} ${t.desc}`.toLowerCase().includes(query))
    .sort((a,b) => b.dateISO.localeCompare(a.dateISO));

  txTableBody.innerHTML = "";
  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  } else {
    emptyState.style.display = "none";
  }

  for (const t of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.dateISO}</td>
      <td><span class="badge ${t.type}">${t.type}</span></td>
      <td>${escapeHTML(t.category)}</td>
      <td>${escapeHTML(t.desc || "")}</td>
      <td class="right">${t.amount.toFixed(2)}</td>
      <td class="right">
        <button class="small secondary" data-edit="${t.id}">Edit</button>
        <button class="small danger" data-del="${t.id}">Delete</button>
      </td>
    `;
    txTableBody.appendChild(tr);
  }

  // Actions
  txTableBody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      transactions = transactions.filter(t => t.id !== id);
      saveJSON(TX_KEY, transactions);
      render();
    });
  });

  txTableBody.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const t = transactions.find(x => x.id === id);
      if (!t) return;
      const newAmount = prompt("Amount (£):", t.amount);
      const newCategory = prompt("Category:", t.category);
      const newDesc = prompt("Description:", t.desc || "");
      const newDate = prompt("Date (yyyy-mm-dd):", t.dateISO);
      const newType = prompt("Type (income/expense):", t.type);
      if (!newAmount || !newDate || !newType) return;
      const a = parseFloat(newAmount);
      if (isNaN(a) || a <= 0) return alert("Invalid amount.");
      Object.assign(t, {
        amount: a,
        category: newCategory || t.category,
        desc: newDesc || "",
        dateISO: newDate,
        type: newType === "income" ? "income" : "expense"
      });
      addCategory(t.category);
      saveJSON(TX_KEY, transactions);
      render();
    });
  });
}

function renderCharts() {
  const monthAgg = aggregateByMonth(transactions);
  const catAgg = aggregateByCategoryForDate(transactions, datePicker.value);

  if (byMonthChart) byMonthChart.destroy();
  if (byCategoryChart) byCategoryChart.destroy();

  const ctx1 = document.getElementById("byMonthChart").getContext("2d");
  byMonthChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: monthAgg.labels,
      datasets: [
        { label: "Income", data: monthAgg.income, tension: .25 },
        { label: "Expense", data: monthAgg.expense, tension: .25 }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
  });

  const ctx2 = document.getElementById("byCategoryChart").getContext("2d");
  byCategoryChart = new Chart(ctx2, {
    type: "pie",
    data: { labels: catAgg.labels, datasets: [{ label: "Spend by Category", data: catAgg.values }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

// Budget note for DAY
function updateBudgetNote() {
  const day = datePicker.value || todayISO;
  const dayExpenses = transactions
    .filter(t => t.type === "expense" && t.dateISO === day)
    .reduce((acc, t) => acc + t.amount, 0);

  if (budget != null) {
    const remaining = budget - dayExpenses;
    const over = remaining < 0;
    budgetNote.textContent = over
      ? `You are £${Math.abs(remaining).toFixed(2)} OVER your daily budget for ${day}.`
      : `You have £${remaining.toFixed(2)} remaining in your daily budget for ${day}.`;
    budgetNote.style.color = over ? "#ff5577" : "#5bd69a";
  } else {
    budgetNote.textContent = "Set a daily budget to track remaining spend.";
    budgetNote.style.color = "var(--muted)";
  }
}

// Utilities
function sum(arr) { return arr.reduce((a,b) => a + b, 0); }
function formatCurrency(n) {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n); }
  catch { return "£" + n.toFixed(2); }
}
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function uniq(arr){ return Array.from(new Set(arr)); }
function ciCompare(a,b){ return a.toLowerCase().localeCompare(b.toLowerCase()); }

function toCSV(rows) {
  const header = ["id","type","amount","category","desc","dateISO"];
  const data = [header.join(",")];
  for (const r of rows) {
    const row = header.map(h => csvEscape(String(r[h] ?? ""))).join(",");
    data.push(row);
  }
  return data.join("\n");
}
function fromCSV(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i=1; i<lines.length; i++){
    const cells = parseCSVLine(lines[i]);
    const obj = {};
    header.forEach((h, j) => obj[h] = cells[j] ?? "");
    rows.push(obj);
  }
  return rows;
}
function csvEscape(s){
  if (/[",\n]/.test(s)){ return '"' + s.replace(/"/g, '""') + '"'; }
  return s;
}
function parseCSVLine(line){
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i=0; i<line.length; i++){
    const ch = line[i];
    if (inQuotes){
      if (ch === '"'){
        if (line[i+1] === '"'){ cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"'){ inQuotes = true; }
      else if (ch === ','){ out.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}
function normalizeRows(rows){
  const norm = [];
  for (const r of rows){
    const id = r.id && String(r.id).trim() ? String(r.id) : crypto.randomUUID();
    const type = String(r.type || "").toLowerCase() === "income" ? "income" : "expense";
    const amount = parseFloat(r.amount);
    if (isNaN(amount) || amount <= 0) continue;
    const category = String(r.category || "Other").trim();
    const desc = String(r.desc || "").trim();
    let dateISO = String(r.dateISO || r.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)){
      const d = new Date(dateISO);
      if (!isNaN(d)) dateISO = d.toISOString().slice(0,10);
      else dateISO = new Date().toISOString().slice(0,10);
    }
    norm.push({ id, type, amount, category, desc, dateISO });
  }
  return norm;
}

function downloadFile(content, filename, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function aggregateByMonth(rows) {
  const map = new Map(); // yyyy-mm -> {income, expense}
  for (const r of rows) {
    const key = r.dateISO.slice(0,7);
    if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
    map.get(key)[r.type] += r.amount;
  }
  const labels = Array.from(map.keys()).sort();
  const income = labels.map(k => map.get(k).income);
  const expense = labels.map(k => map.get(k).expense);
  return { labels, income, expense };
}
function aggregateByCategoryForDate(rows, dateFilter) {
  const map = new Map(); // category -> expense only for selected day or all if none
  for (const r of rows) {
    if (r.type !== "expense") continue;
    if (dateFilter && r.dateISO !== dateFilter) continue;
    const k = r.category || "Other";
    map.set(k, (map.get(k) || 0) + r.amount);
  }
  const labels = Array.from(map.keys()).sort();
  const values = labels.map(k => map.get(k));
  return { labels, values };
}

// Initial render
render();
