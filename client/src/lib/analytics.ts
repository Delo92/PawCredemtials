declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
}

export function trackPageView(path: string, title?: string) {
  if (window.gtag) {
    window.gtag('config', 'G-CP63092WYN', {
      page_path: path,
      page_title: title,
    });
  }
}
