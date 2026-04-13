self.addEventListener('install', () => {
  console.log('Service worker installed');
});

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('Workbox loaded');
  workbox.routing.registerRoute(
    ({ url }) => url.pathname === '/label4/dialog.js',
    async ({ request }) => {
      const response = await fetch(request);
      const body = await response.text();
      const toIndex = body.indexOf('window.addEventListener');
      return new Response(toIndex === -1 ? body : body.substring(0, toIndex), response);
    }
  );
}
