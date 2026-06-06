import { useEffect } from 'react';

const BASE_TITLE = 'RobAssister';

export function usePageTitle(
  pageTitle?: string,
  description?: string
) {
  useEffect(() => {
    // Update browser tab title
    document.title = pageTitle
      ? `${pageTitle} — ${BASE_TITLE}`
      : `${BASE_TITLE} — AI Writing Assistant for Students`;

    // Update meta description dynamically
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) {
      metaDesc.setAttribute('content', description);
    }

    // Update OG title
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute(
        'content',
        pageTitle ? `${pageTitle} — ${BASE_TITLE}` : BASE_TITLE
      );
    }

    // Reset to default when component unmounts
    return () => {
      document.title = `${BASE_TITLE} — AI Writing Assistant for Students`;
    };
  }, [pageTitle, description]);
}
