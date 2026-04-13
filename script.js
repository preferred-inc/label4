if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/label4/service-worker.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, (error) => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}

function clearPDF() {
  document.querySelectorAll('#content form input[type="file"]').forEach((target) => {
    target.value = '';
    target.form.classList.remove('selected');
  });

  document.querySelector('#current-file').textContent = '';
  document.querySelector('#file-counter').textContent = '0';
}

function printPage() {
  window.print();
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

// Get all empty (unselected) form slots
function getEmptySlots() {
  return Array.from(document.querySelectorAll('#content form')).filter(
    (form) => !form.classList.contains('selected')
  );
}

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

      // Remaining pages auto-fill into empty slots
      if (totalPages > 1) {
        const emptySlots = getEmptySlots();
        const pagesToFill = Math.min(totalPages - 1, emptySlots.length);

        for (let i = 0; i < pagesToFill; i++) {
          const pageNum = i + 2;
          const targetForm = emptySlots[i];
          const targetDropzone = targetForm.querySelector('.dropzone');
          const targetIcon = targetForm.querySelector('.dropzone-inner i');

          targetDropzone.classList.add('loading');
          targetIcon.className = 'fa-solid fa-spinner fa-spin';

          const page = await pdf.getPage(pageNum);
          await renderPage(page, targetForm);

          targetIcon.className = 'fa-solid fa-file-arrow-up';
          targetDropzone.classList.remove('loading');
          targetForm.classList.add('selected');
        }
      }

      document.querySelector('#current-file').textContent = file.name;
      document.querySelector('#file-counter').textContent = document.querySelectorAll('form.selected').length;
    }).catch(function () {
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      alert('PDFファイルを読み込めませんでした');
    });
  };

  fileReader.readAsArrayBuffer(file);
}
