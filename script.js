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
    }).promise.then(function (pdf) {
      pdf.getPage(1).then(function (page) {
        const scale = 300 / 72;
        const viewport = page.getViewport({ scale });

        const canvas = form.querySelector('canvas');
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        page.render({
          canvasContext: context,
          viewport,
        }).promise.then(function () {
          icon.className = 'fa-solid fa-file-arrow-up';
          dropzone.classList.remove('loading');
          form.classList.add('selected');
          document.querySelector('#current-file').textContent = file.name;
          document.querySelector('#file-counter').textContent = document.querySelectorAll('form.selected').length;
        });
      });
    }).catch(function () {
      icon.className = 'fa-solid fa-file-arrow-up';
      dropzone.classList.remove('loading');
      alert('PDFファイルを読み込めませんでした');
    });
  };

  fileReader.readAsArrayBuffer(file);
}
