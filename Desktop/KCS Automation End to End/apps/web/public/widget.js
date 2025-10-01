(() => {
  if (window.__KCS_WIDGET_LOADED__) {
    return;
  }
  window.__KCS_WIDGET_LOADED__ = true;

  const createIframe = (host, partnerSlug) => {
    const iframe = document.createElement("iframe");
    iframe.src = `${host}/widget?partner=${encodeURIComponent(partnerSlug ?? "demo")}`;
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.minHeight = "1200px";
    iframe.setAttribute("title", "KCS Story Builder");
    return iframe;
  };

  window.KCSWidget = {
    mount: ({ selector, partnerSlug, host = window.location.origin }) => {
      const container = document.querySelector(selector);
      if (!container) {
        throw new Error(`KCSWidget: container not found for selector ${selector}`);
      }

      const iframe = createIframe(host, partnerSlug);
      container.innerHTML = "";
      container.appendChild(iframe);
    }
  };
})();

