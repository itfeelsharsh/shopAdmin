// This optional code is used to register a service worker.
// register() is not called by default.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // (e.g. if a CDN is used to serve assets).
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service worker.'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      // 1. Check for immediate waiting service worker to prevent frozen states
      if (registration.waiting && config && config.onUpdate) {
        config.onUpdate(registration);
      }

      // 2. Schedule periodic background checks (Every 5 minutes)
      const CHECK_INTERVAL = 5 * 60 * 1000;
      let checkIntervalId = setInterval(() => {
        if (navigator.onLine) {
          registration.update().catch(err => {
            console.info('Service Worker periodic update check failed:', err);
          });
        }
      }, CHECK_INTERVAL);

      // 3. Monitor visibility/tab-focus changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(err => {
            console.info('Service Worker visibility update check failed:', err);
          });
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 4. Hook into SPA Client-Side Navigations (Throttled to 10 seconds)
      let lastRouteCheck = 0;
      const ROUTE_CHECK_THROTTLE = 10000; // 10s

      const triggerThrottledUpdate = () => {
        const now = Date.now();
        if (now - lastRouteCheck > ROUTE_CHECK_THROTTLE && navigator.onLine) {
          lastRouteCheck = now;
          registration.update().catch(err => {
            console.info('Service Worker route transition update check failed:', err);
          });
        }
      };

      // Wrap original history methods
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function(...args) {
        originalPushState.apply(this, args);
        triggerThrottledUpdate();
      };

      window.history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        triggerThrottledUpdate();
      };

      window.addEventListener('popstate', triggerThrottledUpdate);
      window.addEventListener('hashchange', triggerThrottledUpdate);

      // 5. Clean up listeners if the window closes (optional)
      window.addEventListener('unload', () => {
        clearInterval(checkIntervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('popstate', triggerThrottledUpdate);
        window.removeEventListener('hashchange', triggerThrottledUpdate);
      });

      // Original update hooks remain unchanged to process state changes
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;
        
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New service worker version is installed - caching is enabled');
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Service worker installed - caching is enabled');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
