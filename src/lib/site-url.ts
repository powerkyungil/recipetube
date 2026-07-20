const fallbackSiteUrl = "http://localhost:3000";

/**
 * Returns the one canonical origin used in metadata, robots.txt, and sitemap.xml.
 * Set NEXT_PUBLIC_SITE_URL to the production URL without a trailing slash.
 */
export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) {
    return new URL(fallbackSiteUrl);
  }

  const urlWithProtocol = /^https?:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    return new URL(urlWithProtocol);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}
