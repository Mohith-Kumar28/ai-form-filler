import { pricing, site } from './site'

export type MetaTag = {
  title?: string
  charSet?: string
  name?: string
  property?: string
  content?: string
  httpEquiv?: string
}

export function buildMeta({
  title,
  description,
  path,
  ogImage,
  noindex = false,
}: {
  title: string
  description: string
  path: string
  ogImage?: string
  noindex?: boolean
}): MetaTag[] {
  const url = `${site.domain}${path}`
  const image = ogImage ? `${site.domain}${ogImage}` : `${site.domain}${site.ogImage}`

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: image },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: site.name },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
    { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow' },
  ]
}

export function canonicalLink(path: string) {
  return { rel: 'canonical', href: `${site.domain}${path}` } as const
}

export function jsonLd(json: Record<string, unknown>) {
  return {
    type: 'application/ld+json',
    children: JSON.stringify(json),
  } as const
}

/**
 * Structured data for the extension itself, on every page.
 *
 * The offer is derived from `pricing` rather than written out, because this schema said
 * `price: '0'` — which Google is entitled to surface as a "Free" rich result. That was true while
 * there was a free tier and became a false claim to search users the moment there wasn't. Deriving
 * it means the claim cannot outlive the plan it describes.
 *
 * `AggregateOffer` rather than `Offer`: there are two plans at different prices, and stating one of
 * them as *the* price is the same class of mistake in a smaller size.
 */
export function softwareAppSchema() {
  const prices = pricing.map((plan) => plan.price)

  return jsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: String(Math.min(...prices)),
      highPrice: String(Math.max(...prices)),
      priceCurrency: 'USD',
      offerCount: prices.length,
    },
    description: site.description,
    url: site.domain,
  })
}
