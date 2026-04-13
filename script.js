if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/label4/service-worker.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, (error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
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

// Create a new page with empty slots
function createPage() {
  const page = document.createElement('div');
  page.className = 'print-page';
  const count = getSlotsPerPage();
  for (let i = 0; i < count; i++) {
    page.appendChild(createSlot());
  }
  return page;
}

// Add a new page to the content area
function addPage() {
  const content = document.getElementById('content');
  content.appendChild(createPage());
  updateCounter();
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
  // Remove all pages except the first
  const pages = content.querySelectorAll('.print-page');
  for (let i = 1; i < pages.length; i++) {
    pages[i].remove();
  }
  // Reset first page slots
  if (pages[0]) {
    pages[0].querySelectorAll('form').forEach((form) => {
      form.querySelector('input[type="file"]').value = '';
      form.classList.remove('selected');
    });
  }
  updateCounter();
}

function printPage() {
  window.print();
}

function updateCounter() {
  const selected = document.querySelectorAll('form.selected').length;
  document.querySelector('#file-counter').textContent = selected;
}

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
    alert('PDFファイルを選択してください');
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
    }).catch(function () {
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      alert('PDFファイルを読み込めませんでした');
    });
  };

  fileReader.readAsArrayBuffer(file);
}
