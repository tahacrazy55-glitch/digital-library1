const LS_KEYS = {
  BOOKS: "dl_books_v1",
  LOG: "dl_log_v1",
  THEME: "dl_theme_v1",
  AUTH: "dl_auth_v1",
};

const USERS = {
  admin: { password: "admin123", role: "admin", label: "أدمن" },
  user:  { password: "user123",  role: "user",  label: "يوزر" },
};

const $ = (sel) => document.querySelector(sel);

const toast = $("#toast");
const themeBtn = $("#themeBtn");
const resetBtn = $("#resetBtn");
const exportBtn = $("#exportBtn");
const importInput = $("#importInput");

const statsMini = $("#statsMini");

const catalogGrid = $("#catalogGrid");
const searchInput = $("#searchInput");
const categorySelect = $("#categorySelect");
const sortSelect = $("#sortSelect");
const catalogHint = $("#catalogHint");

const adminList = $("#adminList");
const kpis = $("#kpis");
const logEl = $("#log");

const form = $("#bookForm");
const formTitle = $("#formTitle");
const cancelEditBtn = $("#cancelEditBtn");

let books = loadBooks();
let log = loadLog();

/* =========================
   Auth (Login / Roles)
========================= */
function loadAuth(){
  const raw = localStorage.getItem(LS_KEYS.AUTH);
  if(!raw) return null;
  try{
    const a = JSON.parse(raw);
    if(!a || !a.role || !a.username) return null;
    return a;
  }catch{ return null; }
}
function saveAuth(auth){
  localStorage.setItem(LS_KEYS.AUTH, JSON.stringify(auth));
}
function clearAuth(){
  localStorage.removeItem(LS_KEYS.AUTH);
}
function getRole(){
  return loadAuth()?.role || null;
}
function isAdmin(){
  return getRole() === "admin";
}
function canManageBooks(){
  // admin فقط
  return isAdmin();
}

function ensureAuthBtn(){
  const actions = document.querySelector(".actions");
  if(!actions) return;

  let btn = $("#authBtn");
  if(!btn){
    btn = document.createElement("button");
    btn.id = "authBtn";
    btn.className = "btn";
    btn.type = "button";
    actions.insertBefore(btn, actions.firstChild);
  }

  btn.addEventListener("click", () => {
    const auth = loadAuth();
    if(auth){
      // logout
      clearAuth();
      notify("تم تسجيل الخروج");
      // رجّع الواجهة لوضع القفل ثم افتح تسجيل الدخول
      applyRoleUI();
      openLoginModal(true);
      renderAuthBtn();
    }else{
      openLoginModal(false);
    }
  });

  renderAuthBtn();
}

function renderAuthBtn(){
  const btn = $("#authBtn");
  if(!btn) return;
  const auth = loadAuth();
  if(!auth){
    btn.textContent = "تسجيل الدخول";
    btn.classList.remove("danger");
    btn.classList.add("primary");
    return;
  }
  const label = auth.role === "admin" ? "أدمن" : "يوزر";
  btn.textContent = `خروج (${label}: ${auth.username})`;
  btn.classList.remove("primary");
  btn.classList.add("danger");
}

function openLoginModal(force){
  // لو المستخدم مسجل دخول ومش مجبرين => لا تفتح
  if(loadAuth() && !force) return;

  // لو موجودة لا تكرر
  if($("#authModal")) return;

  const overlay = document.createElement("div");
  overlay.id = "authModal";
  overlay.className = "authModal";

  overlay.innerHTML = `
    <div class="authCard" role="dialog" aria-modal="true" aria-label="تسجيل الدخول">
      <div class="authHead">
        <h3>تسجيل الدخول</h3>
        <p class="muted">اختر الحساب: <b>admin</b> أو <b>user</b></p>
      </div>

      <form id="authForm" class="form">
        <div class="field">
          <label>اسم المستخدم</label>
          <input id="authUsername" autocomplete="username" placeholder="admin أو user" required />
        </div>
        <div class="field">
          <label>كلمة المرور</label>
          <input id="authPassword" type="password" autocomplete="current-password" required />
        </div>

        <div class="hint" style="margin-top:10px">
  <div>للدخول ك يوزر:</div>
 
  <div><b>user : اسم المستخدم</b> / user123 : كلمةالمرور</div>
</div>

        <div class="row" style="margin-top:10px">
          <button class="btn primary" type="submit">دخول</button>
          <button id="authCancel" class="btn ghost" type="button">إلغاء</button>
        </div>

       
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("authLocked");

  const cancelBtn = $("#authCancel");
  // لو إجبار (لازم يسجل دخول) نخفي الإلغاء
  if(cancelBtn) cancelBtn.style.display = force ? "none" : "inline-flex";

  $("#authForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = ($("#authUsername")?.value || "").trim();
    const password = ($("#authPassword")?.value || "").trim();

    const u = USERS[username];
    if(!u || u.password !== password){
      notify("بيانات الدخول غير صحيحة");
      return;
    }

    saveAuth({ username, role: u.role, at: new Date().toISOString() });
    notify("تم تسجيل الدخول ✅");
    closeLoginModal();
    renderAuthBtn();
    applyRoleUI();
    rerenderAll();
  });

  // قفل الواجهة: لا نسمح بإغلاق المودال في وضع force
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay && !force) closeLoginModal();
  });
  cancelBtn?.addEventListener("click", () => {
    if(!force) closeLoginModal();
  });

  // فوكس
  setTimeout(() => $("#authUsername")?.focus(), 50);
}

function closeLoginModal(){
  $("#authModal")?.remove();
  document.body.classList.remove("authLocked");
}

function requireAuth(){
  // اجبار تسجيل الدخول لكل الصفحات
  if(!loadAuth()){
    openLoginModal(true);
  }else{
    closeLoginModal();
  }
}

function applyRoleUI(){
  // لوحة التحكم: امنع إضافة كتاب جديد + قائمة الإدارة لليوزر
  const role = getRole();

  // عناصر لوحة التحكم موجودة في dashboard.html :contentReference[oaicite:2]{index=2}
  const adminSectionTitle = Array.from(document.querySelectorAll("h3"))
    .find(h => (h.textContent || "").includes("قائمة الإدارة"));

  if(role === "user"){
    if(formTitle) formTitle.textContent = "إضافة كتاب جديد (غير متاح لليوزر)";
    if(form) form.style.display = "none";               // اخفاء نموذج الإضافة
    if(adminSectionTitle) adminSectionTitle.style.display = "none"; // اخفاء عنوان قائمة الإدارة
    if(adminList) adminList.style.display = "none";     // اخفاء قائمة الإدارة
  }else{
    // admin أو لا شيء
    if(form) form.style.display = "";
    if(adminSectionTitle) adminSectionTitle.style.display = "";
    if(adminList) adminList.style.display = "";
    if(formTitle) formTitle.textContent = $("#bookId")?.value ? "تعديل كتاب" : "إضافة كتاب جديد";
  }
}

/* =========================
   Seed / Storage
========================= */
function seedBooks(){
  return [
    { id: uid(), title:"مقدمة ابن خلدون", author:"ابن خلدون", year:1377, category:"تاريخ", copies:4, available:4, description:"كتاب تأسيسي في الاجتماع والتاريخ." },
    { id: uid(), title:"الأيام", author:"طه حسين", year:1929, category:"أدب", copies:3, available:2, description:"سيرة ذاتية أدبية من روائع الأدب العربي." },
    { id: uid(), title:"أساسيات البرمجة", author:"فريق تدريبي", year:2021, category:"تقنية", copies:5, available:5, description:"مدخل مبسط لمفاهيم البرمجة." },
  ];
}

function loadBooks(){
  const raw = localStorage.getItem(LS_KEYS.BOOKS);
  if(!raw){
    const seeded = seedBooks();
    localStorage.setItem(LS_KEYS.BOOKS, JSON.stringify(seeded));
    return seeded;
  }
  try{
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).map(b => ({
      ...b,
      copies: clampInt(b.copies, 1, 999),
      available: clampInt(b.available ?? b.copies, 0, 999),
    }));
  }catch{
    const seeded = seedBooks();
    localStorage.setItem(LS_KEYS.BOOKS, JSON.stringify(seeded));
    return seeded;
  }
}
function saveBooks(){ localStorage.setItem(LS_KEYS.BOOKS, JSON.stringify(books)); }

function loadLog(){
  const raw = localStorage.getItem(LS_KEYS.LOG);
  if(!raw) return [];
  try{ return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []; }
  catch{ return []; }
}
function pushLog(type, message){
  const entry = { id: uid(), at: new Date().toISOString(), type, message };
  log.unshift(entry);
  log = log.slice(0, 60);
  localStorage.setItem(LS_KEYS.LOG, JSON.stringify(log));
  renderLog();
}

/* Helpers */
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function clampInt(n,min,max){
  const x = Number.parseInt(n,10);
  if(Number.isNaN(x)) return min;
  return Math.min(max, Math.max(min,x));
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function formatDate(iso){
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
function notify(msg){
  if(!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(notify._t);
  notify._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* Theme */
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS_KEYS.THEME, theme);
  if(themeBtn) themeBtn.textContent = theme === "light" ? "🌙" : "☀️";
}
function initTheme(){
  const saved = localStorage.getItem(LS_KEYS.THEME);
  applyTheme(saved === "light" ? "light" : "dark");
}

/* Stats */
function renderStats(){
  const totalBooks = books.length;
  const totalCopies = books.reduce((s,b)=> s + (b.copies||0), 0);
  const totalAvailable = books.reduce((s,b)=> s + (b.available||0), 0);
  const borrowed = totalCopies - totalAvailable;

  if(statsMini){
    statsMini.innerHTML = `
      <div class="stat"><b>${totalBooks}</b><span>عدد العناوين</span></div>
      <div class="stat"><b>${totalCopies}</b><span>إجمالي النسخ</span></div>
      <div class="stat"><b>${borrowed}</b><span>نسخ مُعارة</span></div>
    `;
  }
  if(kpis){
    kpis.innerHTML = `
      <div class="kpi"><b>${totalBooks}</b><span>العناوين</span></div>
      <div class="kpi"><b>${totalCopies}</b><span>النسخ</span></div>
      <div class="kpi"><b>${totalAvailable}</b><span>المتاح</span></div>
      <div class="kpi"><b>${borrowed}</b><span>المُعار</span></div>
    `;
  }
}
function renderLog(){
  if(!logEl) return;
  if(log.length === 0){
    logEl.innerHTML = `<div class="logItem">لا توجد عمليات حتى الآن.</div>`;
    return;
  }
  logEl.innerHTML = log.map(e => `
    <div class="logItem">
      <b>${escapeHtml(e.type)}</b> — ${escapeHtml(e.message)}
      <div class="small">${formatDate(e.at)}</div>
    </div>
  `).join("");
}

/* Catalog */
function getCategories(){
  const set = new Set(books.map(b => (b.category || "").trim()).filter(Boolean));
  return Array.from(set).sort((a,b)=> a.localeCompare(b,"ar"));
}
function renderCategoryOptions(){
  if(!categorySelect) return;
  const cats = getCategories();
  const current = categorySelect.value || "all";
  categorySelect.innerHTML = `<option value="all">الكل</option>` + cats.map(c =>
    `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
  ).join("");
  categorySelect.value = cats.includes(current) ? current : "all";
}
function getFilteredSortedBooks(){
  const q = (searchInput?.value || "").trim().toLowerCase();
  const cat = categorySelect?.value || "all";
  const sort = sortSelect?.value || "titleAsc";

  let list = [...books];
  if(cat !== "all") list = list.filter(b => (b.category||"").trim() === cat);
  if(q) list = list.filter(b =>
    (b.title||"").toLowerCase().includes(q) ||
    (b.author||"").toLowerCase().includes(q)
  );

  const cmpText = (a,b) => String(a).localeCompare(String(b), "ar");
  const cmpNum = (a,b) => (a||0) - (b||0);

  switch(sort){
    case "titleDesc": list.sort((a,b)=> cmpText(b.title,a.title)); break;
    case "yearDesc": list.sort((a,b)=> cmpNum(b.year,a.year)); break;
    case "yearAsc": list.sort((a,b)=> cmpNum(a.year,b.year)); break;
    case "availableDesc": list.sort((a,b)=> cmpNum(b.available,a.available)); break;
    default: list.sort((a,b)=> cmpText(a.title,b.title));
  }
  return list;
}
function availabilityPill(book){
  const a = book.available ?? 0;
  const c = book.copies ?? 0;
  if(a <= 0) return `<span class="pill bad">غير متاح</span>`;
  if(a < Math.ceil(c/2)) return `<span class="pill warn">متاح جزئيًا (${a}/${c})</span>`;
  return `<span class="pill ok">متاح (${a}/${c})</span>`;
}
function renderCatalog(){
  if(!catalogGrid) return;

  const list = getFilteredSortedBooks();
  if(list.length === 0){
    catalogGrid.innerHTML = "";
    if(catalogHint) catalogHint.textContent = "لا توجد نتائج مطابقة. جرّب تغيير البحث أو التصنيف.";
    return;
  }
  if(catalogHint) catalogHint.textContent = "";

  catalogGrid.innerHTML = list.map(b => `
    <article class="book">
      <div class="badges">
        <span class="badge">${escapeHtml(b.category || "غير مصنف")}</span>
        <span class="badge">${escapeHtml(b.year ?? "")}</span>
      </div>
      <div class="title">${escapeHtml(b.title || "")}</div>
      <div class="meta">المؤلف: ${escapeHtml(b.author || "—")}</div>
      <div class="desc">${escapeHtml(b.description || "—")}</div>

      <div class="row">
        ${availabilityPill(b)}
        <div class="row" style="gap:8px">
          <button class="btn" data-action="borrow" data-id="${b.id}">إعارة</button>
          <button class="btn ghost" data-action="return" data-id="${b.id}">إرجاع</button>
        </div>
      </div>
    </article>
  `).join("");
}
function borrowBook(id){
  const b = books.find(x => x.id === id);
  if(!b) return;
  if((b.available ?? 0) <= 0){ notify("لا توجد نسخ متاحة للإعارة."); return; }
  b.available -= 1;
  saveBooks();
  pushLog("إعارة", `تمت إعارة نسخة من: ${b.title}`);
  notify("تمت الإعارة ✅");
  rerenderAll();
}
function returnBook(id){
  const b = books.find(x => x.id === id);
  if(!b) return;
  if((b.available ?? 0) >= (b.copies ?? 0)){ notify("كل النسخ موجودة بالفعل."); return; }
  b.available += 1;
  saveBooks();
  pushLog("إرجاع", `تم إرجاع نسخة إلى: ${b.title}`);
  notify("تم الإرجاع ✅");
  rerenderAll();
}

/* Dashboard Admin */
function renderAdminList(){
  if(!adminList) return;

  // لو يوزر، ما نعرض القائمة أصلاً (حسب المطلوب)
  if(getRole() === "user"){
    adminList.innerHTML = "";
    return;
  }

  if(books.length === 0){
    adminList.innerHTML = `<div class="adminItem">لا توجد كتب. أضف كتابًا من النموذج.</div>`;
    return;
  }
  const list = [...books].sort((a,b)=> String(a.title).localeCompare(String(b.title),"ar"));
  adminList.innerHTML = list.map(b => `
    <div class="adminItem">
      <div>
        <div><b>${escapeHtml(b.title)}</b> <span class="small">— ${escapeHtml(b.author)} (${escapeHtml(b.category)})</span></div>
        <div class="small">نسخ: ${b.copies} | متاح: ${b.available}</div>
      </div>
      <div style="display:flex; gap:8px">
        <button class="btn" data-action="edit" data-id="${b.id}">تعديل</button>
        <button class="btn danger" data-action="delete" data-id="${b.id}">حذف</button>
      </div>
    </div>
  `).join("");
}
function startEdit(id){
  if(!canManageBooks()){
    notify("غير مسموح: هذه العملية للأدمن فقط.");
    return;
  }
  const b = books.find(x => x.id === id);
  if(!b || !form) return;

  $("#bookId").value = b.id;
  $("#title").value = b.title || "";
  $("#author").value = b.author || "";
  $("#year").value = b.year ?? "";
  $("#category").value = b.category || "";
  $("#copies").value = b.copies ?? 1;
  $("#description").value = b.description || "";

  if(formTitle) formTitle.textContent = "تعديل كتاب";
  if(cancelEditBtn) cancelEditBtn.hidden = false;

  pushLog("تعديل", `فتح تعديل: ${b.title}`);
  notify("وضع التعديل ✏️");
}
function cancelEdit(){
  if(!form) return;
  form.reset();
  const idEl = $("#bookId"); if(idEl) idEl.value = "";
  if(formTitle) formTitle.textContent = "إضافة كتاب جديد";
  if(cancelEditBtn) cancelEditBtn.hidden = true;
}
function deleteBook(id){
  if(!canManageBooks()){
    notify("غير مسموح: هذه العملية للأدمن فقط.");
    return;
  }
  const b = books.find(x => x.id === id);
  if(!b) return;
  if(!confirm(`حذف الكتاب: "${b.title}" ؟`)) return;

  books = books.filter(x => x.id !== id);
  saveBooks();
  pushLog("حذف", `تم حذف: ${b.title}`);
  notify("تم الحذف 🗑️");
  cancelEdit();
  rerenderAll();
}
function upsertBook(data){
  if(!canManageBooks()){
    notify("غير مسموح: إضافة/تعديل الكتب للأدمن فقط.");
    return;
  }

  const isEdit = Boolean(data.id);
  const year = clampInt(data.year, 0, 2100);
  const copies = clampInt(data.copies, 1, 999);

  if(isEdit){
    const b = books.find(x => x.id === data.id);
    if(!b) return;

    const borrowed = (b.copies ?? 0) - (b.available ?? 0);
    const newAvailable = Math.max(0, copies - borrowed);

    Object.assign(b, {
      title: data.title.trim(),
      author: data.author.trim(),
      year,
      category: data.category.trim(),
      copies,
      available: newAvailable,
      description: (data.description || "").trim(),
    });

    pushLog("حفظ", `تم تحديث: ${b.title}`);
    notify("تم التحديث ✅");
  }else{
    const newBook = {
      id: uid(),
      title: data.title.trim(),
      author: data.author.trim(),
      year,
      category: data.category.trim(),
      copies,
      available: copies,
      description: (data.description || "").trim(),
    };
    books.unshift(newBook);
    pushLog("إضافة", `تمت إضافة: ${newBook.title}`);
    notify("تمت الإضافة ✅");
  }

  saveBooks();
  rerenderAll();
  cancelEdit();
}

/* Import / Export / Reset */
function exportJSON(){
  const payload = { exportedAt: new Date().toISOString(), books, log };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "digital-library-export.json";
  a.click();
  URL.revokeObjectURL(a.href);
  pushLog("تصدير", "تم تصدير البيانات");
  notify("تم التصدير 📦");
}
async function importJSON(file){
  try{
    const text = await file.text();
    const payload = JSON.parse(text);
    if(!payload || !Array.isArray(payload.books)) throw new Error("invalid");

    books = payload.books.map(b => ({
      id: String(b.id || uid()),
      title: String(b.title || "").trim(),
      author: String(b.author || "").trim(),
      year: clampInt(b.year, 0, 2100),
      category: String(b.category || "غير مصنف").trim(),
      copies: clampInt(b.copies, 1, 999),
      available: clampInt(b.available ?? b.copies, 0, 999),
      description: String(b.description || "").trim(),
    }));

    log = Array.isArray(payload.log) ? payload.log.slice(0, 80) : log;

    saveBooks();
    localStorage.setItem(LS_KEYS.LOG, JSON.stringify(log));
    pushLog("استيراد", "تم استيراد البيانات");
    notify("تم الاستيراد ✅");
    rerenderAll();
  }catch{
    notify("فشل الاستيراد. تأكد من JSON صالح.");
  }finally{
    if(importInput) importInput.value = "";
  }
}
function resetAll(){
  if(!confirm("سيتم حذف كل البيانات وإعادة ضبط النظام. متأكد؟")) return;
  localStorage.removeItem(LS_KEYS.BOOKS);
  localStorage.removeItem(LS_KEYS.LOG);
  books = loadBooks();
  log = loadLog();
  pushLog("إعادة ضبط", "تمت إعادة ضبط النظام");
  notify("تمت إعادة الضبط 🔄");
  cancelEdit();
  rerenderAll();
}

/* Wire events safely */
function wireEvents(){
  if(themeBtn){
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }
  if(resetBtn) resetBtn.addEventListener("click", resetAll);

  if(searchInput) searchInput.addEventListener("input", renderCatalog);
  if(categorySelect) categorySelect.addEventListener("change", renderCatalog);
  if(sortSelect) sortSelect.addEventListener("change", renderCatalog);

  if(catalogGrid){
    catalogGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if(action === "borrow") borrowBook(id);
      if(action === "return") returnBook(id);
    });
  }

  if(adminList){
    adminList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if(!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if(action === "edit") startEdit(id);
      if(action === "delete") deleteBook(id);
    });
  }

  if(form){
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        id: $("#bookId")?.value || "",
        title: $("#title")?.value || "",
        author: $("#author")?.value || "",
        year: $("#year")?.value || "",
        category: $("#category")?.value || "",
        copies: $("#copies")?.value || "1",
        description: $("#description")?.value || "",
      };
      if(!data.title.trim() || !data.author.trim() || !String(data.year).trim() || !data.category.trim()){
        notify("فضلاً املأ الحقول المطلوبة.");
        return;
      }
      upsertBook(data);
    });
  }

  if(cancelEditBtn) cancelEditBtn.addEventListener("click", cancelEdit);

  if(exportBtn) exportBtn.addEventListener("click", exportJSON);
  if(importInput){
    importInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if(file) importJSON(file);
    });
  }
}

function rerenderAll(){
  renderStats();
  renderLog();
  renderCategoryOptions();
  renderCatalog();
  renderAdminList();
}

/* Boot */
initTheme();
ensureAuthBtn();
requireAuth();
applyRoleUI();
wireEvents();
rerenderAll();
