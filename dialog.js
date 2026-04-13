function showHelp() {
  document.getElementById('help-modal').classList.add('active');
}

function closeHelp(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('help-modal').classList.remove('active');
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeHelp();
  }
});

window.addEventListener('load', showHelp);
