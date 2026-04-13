if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/label4/service-worker.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, (error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}

// --- i18n ---
const LANG = (navigator.language || '').startsWith('ja') ? 'ja' : 'en';
const I18N = {
  ja: {
    selectPDF: 'PDFファイルを選択してください',
    readError: 'PDFファイルを読み込めませんでした',
    noLabels: '印刷する伝票がありません',
    printConfirm: (pages, labels, saved) =>
      'A4 ' + pages + '枚に ' + labels + '枚の伝票を印刷します。' +
      (saved > 0 ? '\n(' + saved + '枚の用紙を節約!)' : ''),
    saved: (n) => 'A4 ' + n + '枚節約!',
    loaded: (name) => name + ' を読み込みました',
    cleared: 'すべて削除しました',
    removed: 'スロットを削除しました',
    exported: 'PDFをダウンロードしました',
    statsTotal: (n) => '累計 ' + n + '枚印刷',
    statsSaved: (n) => n + '枚節約',
  },
  en: {
    selectPDF: 'Please select a PDF file',
    readError: 'Failed to load PDF',
    noLabels: 'No labels to print',
    printConfirm: (pages, labels, saved) =>
      'Print ' + labels + ' labels on ' + pages + ' A4 sheet(s).' +
      (saved > 0 ? '\n(' + saved + ' sheet(s) saved!)' : ''),
    saved: (n) => n + ' sheet(s) saved!',
    loaded: (name) => 'Loaded ' + name,
    cleared: 'All cleared',
    removed: 'Slot cleared',
    exported: 'PDF downloaded',
    statsTotal: (n) => n + ' labels printed',
    statsSaved: (n) => n + ' sheets saved',
  },
};
function t(key, ...args) {
  const fn = I18N[LANG][key] || I18N.ja[key];
  return typeof fn === 'function' ? fn(...args) : fn;
}

// --- Toast notifications ---
function toast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

// --- Stats (localStorage) ---
function getStats() {
  try {
    return JSON.parse(localStorage.getItem('label4_stats')) || { printed: 0, saved: 0 };
  } catch { return { printed: 0, saved: 0 }; }
}
function saveStats(stats) {
  try { localStorage.setItem('label4_stats', JSON.stringify(stats)); } catch {}
}
function recordPrint(labels, pageCount) {
  const stats = getStats();
  stats.printed += labels;
  stats.saved += (labels - pageCount);
  saveStats(stats);
  updateStatsBadge();
}
function updateStatsBadge() {
  const el = document.getElementById('stats-badge');
  if (!el) return;
  const stats = getStats();
  if (stats.printed > 0) {
    el.textContent = t('statsTotal', stats.printed) + ' / ' + t('statsSaved', stats.saved);
    el.style.display = 'block';
  }
}

// --- Slot swap ---
let swapSource = null;
function initSlotSwap() {
  document.addEventListener('click', (e) => {
    const form = e.target.closest('form.selected');
    if (!form || e.target.closest('.slot-remove') || e.target.closest('label')) return;

    if (!swapSource) {
      swapSource = form;
      form.classList.add('swap-active');
    } else if (swapSource === form) {
      swapSource.classList.remove('swap-active');
      swapSource = null;
    } else {
      // Swap canvases
      const c1 = swapSource.querySelector('canvas');
      const c2 = form.querySelector('canvas');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = c1.width; tempCanvas.height = c1.height;
      tempCanvas.getContext('2d').drawImage(c1, 0, 0);

      const ctx1 = c1.getContext('2d');
      c1.width = c2.width; c1.height = c2.height;
      ctx1.drawImage(c2, 0, 0);

      const ctx2 = c2.getContext('2d');
      c2.width = tempCanvas.width; c2.height = tempCanvas.height;
      ctx2.drawImage(tempCanvas, 0, 0);

      swapSource.classList.remove('swap-active');
      swapSource = null;
      toast(LANG === 'ja' ? '入れ替えました' : 'Swapped');
    }
  });
}
document.addEventListener('DOMContentLoaded', () => {
  initSlotSwap();
  updateStatsBadge();
});

// --- Batch upload ---
function batchUpload() {
  document.getElementById('batch-input').click();
}

function handleBatchFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.type === 'application/pdf');
  if (files.length === 0) return;
  files.forEach((file) => {
    ensureEmptySlot();
    const slot = getEmptySlots()[0];
    if (slot) loadPDFIntoSlot(file, slot);
  });
}

// --- PWA install prompt ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwa-banner');
  if (banner && !localStorage.getItem('label4_pwa_dismissed')) {
    banner.classList.add('show');
  }
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  }
  dismissPWA();
}

function dismissPWA() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.remove('show');
  try { localStorage.setItem('label4_pwa_dismissed', '1'); } catch {}
}

// --- Confetti ---
function confetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;pointer-events:none;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#4361ee', '#e63946', '#22c55e', '#f59e0b', '#8b5cf6'];
  const pieces = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 4,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * 360,
      rv: -3 + Math.random() * 6,
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rv;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (frame < 120) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }
  draw();
}

let slotCounter = 4; // for generating unique input IDs

function getLayout() {
  return document.getElementById('content').dataset.layout || '4';
}

function getSlotsPerPage() {
  return getLayout() === '2' ? 2 : 4;
}

// Create a single form slot
function createSlot() {
  slotCounter++;
  const id = 'input-' + slotCounter;
  const form = document.createElement('form');
  form.innerHTML =
    '<canvas width="2480" height="3508"></canvas>' +
    '<button type="button" class="slot-remove" onclick="removeSlot(this)" title="削除">&times;</button>' +
    '<label for="' + id + '">' +
      '<input id="' + id + '" type="file" accept="application/pdf" onchange="inputPDF.call(this)">' +
      '<div class="dropzone">' +
        '<div class="dropzone-inner">' +
          '<i class="fa-solid fa-file-arrow-up"></i>' +
          '<span>PDF</span>' +
        '</div>' +
      '</div>' +
    '</label>';
  return form;
}

// Remove a single slot's content
function removeSlot(btn) {
  const form = btn.closest('form');
  form.classList.remove('selected');
  const input = form.querySelector('input[type="file"]');
  if (input) input.value = '';
  const canvas = form.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 2480;
  canvas.height = 3508;
  updateCounter();
  cleanupEmptyPages();
  toast(t('removed'));
}

// Create a new page with empty slots
function createPage() {
  const page = document.createElement('div');
  page.className = 'print-page';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  page.appendChild(badge);
  const count = getSlotsPerPage();
  for (let i = 0; i < count; i++) {
    page.appendChild(createSlot());
  }
  return page;
}

// Update page number badges
function updatePageNumbers() {
  const pages = document.querySelectorAll('#content .print-page');
  pages.forEach((page, i) => {
    const badge = page.querySelector('.page-badge');
    if (badge) badge.textContent = (i + 1) + ' / ' + pages.length;
  });
}

// Remove empty pages (except the first one)
function cleanupEmptyPages() {
  const pages = Array.from(document.querySelectorAll('#content .print-page'));
  for (let i = pages.length - 1; i >= 1; i--) {
    const hasSelected = pages[i].querySelector('form.selected');
    if (!hasSelected) {
      pages[i].remove();
    }
  }
  updatePageNumbers();
}

// Add a new page to the content area
function addPage() {
  const content = document.getElementById('content');
  content.appendChild(createPage());
  updateCounter();
  updatePageNumbers();
}

// Get all empty (unselected) form slots across all pages
function getEmptySlots() {
  return Array.from(document.querySelectorAll('#content form')).filter(
    (form) => !form.classList.contains('selected')
  );
}

// Ensure there's always at least one empty slot available (auto-add page)
function ensureEmptySlot() {
  if (getEmptySlots().length === 0) {
    addPage();
  }
}

function clearPDF() {
  const content = document.getElementById('content');
  const pages = content.querySelectorAll('.print-page');
  for (let i = 1; i < pages.length; i++) {
    pages[i].remove();
  }
  if (pages[0]) {
    pages[0].querySelectorAll('form').forEach((form) => {
      form.querySelector('input[type="file"]').value = '';
      form.classList.remove('selected');
    });
  }
  document.querySelector('#current-file').textContent = '';
  updateCounter();
  toast(t('cleared'));
}

function printPage() {
  const labels = document.querySelectorAll('form.selected').length;
  if (labels === 0) {
    toast(t('noLabels'), 'error');
    return;
  }
  const pages = document.querySelectorAll('#content .print-page');
  const filledPages = Array.from(pages).filter((p) => p.querySelector('form.selected')).length;
  const saved = labels - filledPages;
  if (confirm(t('printConfirm', filledPages, labels, saved))) {
    recordPrint(labels, filledPages);
    confetti();
    window.print();
  }
}

// PDF Export using jsPDF
function exportPDF() {
  const labels = document.querySelectorAll('form.selected').length;
  if (labels === 0) {
    toast(t('noLabels'), 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pages = Array.from(document.querySelectorAll('#content .print-page')).filter(
    (p) => p.querySelector('form.selected')
  );
  const layout = getLayout();
  const slotsPerPage = layout === '2' ? 2 : 4;

  // A4 dimensions in mm
  const W = 210, H = 297;
  const cols = layout === '2' ? 1 : 2;
  const rows = 2;
  const slotW = W / cols;
  const slotH = H / rows;

  pages.forEach((page, pi) => {
    if (pi > 0) doc.addPage();
    const forms = Array.from(page.querySelectorAll('form'));
    forms.forEach((form, fi) => {
      if (fi >= slotsPerPage || !form.classList.contains('selected')) return;
      const canvas = form.querySelector('canvas');
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const col = fi % cols;
      const row = Math.floor(fi / cols);
      doc.addImage(imgData, 'JPEG', col * slotW, row * slotH, slotW, slotH);
    });
  });

  const filledPages = pages.length;
  const saved = labels - filledPages;
  recordPrint(labels, filledPages);
  doc.save('label4-' + new Date().toISOString().slice(0, 10) + '.pdf');
  confetti();
  toast(t('exported'), 'success');
}

function updateCounter() {
  const selected = document.querySelectorAll('form.selected').length;
  document.querySelector('#file-counter').textContent = selected;
  updateSavedCounter(selected);
  updatePageNumbers();
}

// Paper saving counter
function updateSavedCounter(labelCount) {
  const el = document.getElementById('saved-counter');
  if (!el) return;
  const layout = getLayout();
  const perPage = layout === '2' ? 2 : 4;
  if (labelCount <= 1) {
    el.textContent = '';
    return;
  }
  const pagesNeeded = Math.ceil(labelCount / perPage);
  const saved = labelCount - pagesNeeded;
  if (saved > 0) {
    el.textContent = 'A4 ' + saved + '枚節約!';
  } else {
    el.textContent = '';
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  // Ctrl/Cmd + P: print
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    printPage();
  }
  // Ctrl/Cmd + N: add page
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    addPage();
  }
  // Ctrl/Cmd + L: toggle layout
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    toggleLayout();
  }
  // Ctrl/Cmd + Delete/Backspace: clear all
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    clearPDF();
  }
});

// Layout toggle: 2-up / 4-up
function toggleLayout() {
  const content = document.getElementById('content');
  const current = content.dataset.layout;
  const next = current === '4' ? '2' : '4';
  content.dataset.layout = next;

  const icon = document.querySelector('#layout-toggle i');
  icon.className = next === '4'
    ? 'fa-solid fa-table-cells'
    : 'fa-solid fa-table-cells-large';

  // Rebuild pages to match new slot count
  rebuildPages();
}

// Rebuild pages when layout changes
function rebuildPages() {
  const content = document.getElementById('content');
  // Collect all forms with data (selected ones)
  const filledForms = Array.from(content.querySelectorAll('form.selected'));
  const canvasData = filledForms.map((form) => {
    const canvas = form.querySelector('canvas');
    return { width: canvas.width, height: canvas.height, canvas };
  });

  // Clear all pages
  content.innerHTML = '';

  // Create first page
  content.appendChild(createPage());

  // Re-place filled canvases into new pages
  const slotsPerPage = getSlotsPerPage();
  canvasData.forEach((data, i) => {
    const pageIndex = Math.floor(i / slotsPerPage);
    while (content.children.length <= pageIndex) {
      content.appendChild(createPage());
    }
    const page = content.children[pageIndex];
    const targetForm = page.querySelectorAll('form')[i % slotsPerPage];
    const targetCanvas = targetForm.querySelector('canvas');
    const ctx = targetCanvas.getContext('2d');
    targetCanvas.width = data.width;
    targetCanvas.height = data.height;
    ctx.drawImage(data.canvas, 0, 0);
    targetForm.classList.add('selected');
  });

  updateCounter();
}

// Render a single PDF page into a form slot
function renderPage(page, form) {
  return new Promise((resolve) => {
    const scale = 300 / 72;
    const viewport = page.getViewport({ scale });
    const canvas = form.querySelector('canvas');
    const context = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    page.render({
      canvasContext: context,
      viewport,
    }).promise.then(resolve);
  });
}

// Drag & drop support
function initDragDrop() {
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf'
    );
    if (files.length === 0) return;

    files.forEach((file) => {
      const emptySlots = getEmptySlots();
      if (emptySlots.length === 0) {
        addPage();
      }
      const slot = getEmptySlots()[0];
      if (slot) {
        loadPDFIntoSlot(file, slot);
      }
    });
  });

  // Visual feedback on dropzones
  document.addEventListener('dragenter', () => {
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      document.body.classList.remove('dragging');
    }
  });
  document.addEventListener('drop', () => {
    document.body.classList.remove('dragging');
  });
}

// Load a PDF file into a specific form slot
function loadPDFIntoSlot(file, form) {
  const dropzone = form.querySelector('.dropzone');
  const icon = form.querySelector('.dropzone-inner i');

  form.classList.remove('selected');
  dropzone.classList.add('loading');
  icon.className = 'fa-solid fa-spinner fa-spin';

  const fileReader = new FileReader();
  fileReader.onload = function () {
    const pdfData = new Uint8Array(this.result);

    pdfjsLib.getDocument({
      data: pdfData,
      cMapUrl: '/label4/web/cmaps/',
      cMapPacked: true
    }).promise.then(async function (pdf) {
      const totalPages = pdf.numPages;

      const page1 = await pdf.getPage(1);
      await renderPage(page1, form);
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      form.classList.add('selected');

      for (let i = 2; i <= totalPages; i++) {
        ensureEmptySlot();
        const emptySlots = getEmptySlots();
        if (emptySlots.length === 0) break;

        const targetForm = emptySlots[0];
        const targetDropzone = targetForm.querySelector('.dropzone');
        const targetIcon = targetForm.querySelector('.dropzone-inner i');
        targetDropzone.classList.add('loading');
        targetIcon.className = 'fa-solid fa-spinner fa-spin';

        const page = await pdf.getPage(i);
        await renderPage(page, targetForm);
        targetIcon.className = 'fa-solid fa-file-arrow-up';
        targetDropzone.classList.remove('loading');
        targetForm.classList.add('selected');
      }

      document.querySelector('#current-file').textContent = file.name;
      updateCounter();
      toast(t('loaded', file.name), 'success');
    }).catch(function () {
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
    });
  };

  fileReader.readAsArrayBuffer(file);
}

// Initialize drag & drop on page load
document.addEventListener('DOMContentLoaded', initDragDrop);

function inputPDF() {
  const { form } = this;
  const dropzone = form.querySelector('.dropzone');
  const icon = form.querySelector('.dropzone-inner i');
  const file = this.files[0];

  if (!file || file.type !== 'application/pdf') {
    toast(t('selectPDF'), 'error');
    return;
  }

  form.classList.remove('selected');
  dropzone.classList.add('loading');
  icon.className = 'fa-solid fa-spinner fa-spin';

  const fileReader = new FileReader();
  fileReader.onload = function () {
    const pdfData = new Uint8Array(this.result);

    pdfjsLib.getDocument({
      data: pdfData,
      cMapUrl: '/label4/web/cmaps/',
      cMapPacked: true
    }).promise.then(async function (pdf) {
      const totalPages = pdf.numPages;

      // Page 1 goes into the clicked form
      const page1 = await pdf.getPage(1);
      await renderPage(page1, form);
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      form.classList.add('selected');

      // Remaining pages auto-fill into empty slots, adding pages as needed
      for (let i = 2; i <= totalPages; i++) {
        ensureEmptySlot();
        const emptySlots = getEmptySlots();
        if (emptySlots.length === 0) break;

        const targetForm = emptySlots[0];
        const targetDropzone = targetForm.querySelector('.dropzone');
        const targetIcon = targetForm.querySelector('.dropzone-inner i');

        targetDropzone.classList.add('loading');
        targetIcon.className = 'fa-solid fa-spinner fa-spin';

        const page = await pdf.getPage(i);
        await renderPage(page, targetForm);

        targetIcon.className = 'fa-solid fa-file-arrow-up';
        targetDropzone.classList.remove('loading');
        targetForm.classList.add('selected');
      }

      document.querySelector('#current-file').textContent = file.name;
      updateCounter();
      toast(t('loaded', file.name), 'success');
    }).catch(function () {
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      toast(t('readError'), 'error');
    });
  };

  fileReader.readAsArrayBuffer(file);
}
