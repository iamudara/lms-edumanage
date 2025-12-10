/**
 * AdminJS Custom Loading Feedback
 * Intercepts network requests to show a global loading state during mutations.
 */
(function() {
  // 1. Inject CSS for the loader
  const style = document.createElement('style');
  style.textContent = `
    .admin-global-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(2px);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    
    .admin-global-loader.visible {
      opacity: 1;
      pointer-events: all;
    }

    .admin-loader-spinner {
      width: 48px;
      height: 48px;
      border: 5px solid #E2E8F0;
      border-bottom-color: #4B6BFB; /* Primary color */
      border-radius: 50%;
      display: inline-block;
      box-sizing: border-box;
      animation: adminRotation 1s linear infinite;
      margin-bottom: 1rem;
    }

    .admin-loader-text {
      font-family: 'Inter', sans-serif;
      color: #1F2937;
      font-weight: 600;
      font-size: 1.125rem;
    }

    @keyframes adminRotation {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Dark mode support if applicable */
    @media (prefers-color-scheme: dark) {
      .admin-global-loader {
        background: rgba(17, 24, 39, 0.8);
      }
      .admin-loader-spinner {
        border-color: #374151;
        border-bottom-color: #60A5FA;
      }
      .admin-loader-text {
        color: #F3F4F6;
      }
    }
  `;
  document.head.appendChild(style);

  // 2. Create Loader Elements
  const loaderContainer = document.createElement('div');
  loaderContainer.className = 'admin-global-loader';
  loaderContainer.innerHTML = `
    <div class="admin-loader-spinner"></div>
    <div class="admin-loader-text">Processing...</div>
  `;
  document.body.appendChild(loaderContainer);

  // 3. Request Tracking State
  let activeMutations = 0;
  let timerId = null;

  function showLoader() {
    activeMutations++;
    loaderContainer.classList.add('visible');
    
    // Safety timeout: forced hide after 10s to prevent indefinite locking
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      activeMutations = 0;
      hideLoader(true);
    }, 10000);
  }

  function hideLoader(force = false) {
    if (activeMutations > 0) activeMutations--;
    if (activeMutations === 0 || force) {
      loaderContainer.classList.remove('visible');
      if (timerId) clearTimeout(timerId);
    }
  }

  // 4. Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [resource, config] = args;
    const method = config?.method?.toUpperCase() || 'GET';
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    
    // Check if it's an API call (usually to /admin/api/...)
    const url = resource instanceof Request ? resource.url : resource;
    const isApiCall = url.includes('/admin'); // Broad check for admin related changes

    if (isMutation && isApiCall) {
      showLoader();
      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } catch (error) {
        throw error;
      } finally {
        hideLoader();
      }
    } else {
      return originalFetch.apply(this, args);
    }
  };

  // 5. Intercept XMLHttpRequest (Axios uses this often)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method ? method.toUpperCase() : 'GET';
    this._url = url;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(this._method);
    const isApiCall = this._url && this._url.toString().includes('/admin');

    if (isMutation && isApiCall) {
      showLoader();
      
      this.addEventListener('loadend', () => {
        hideLoader();
      });
    }

    return originalSend.apply(this, args);
  };
  
  console.log('AdminJS Custom Loader Initialized');
})();
