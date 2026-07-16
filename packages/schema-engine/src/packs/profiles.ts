/**
 * Versioned Google rich-result profile pack. Encodes the required/recommended
 * properties Google documents for each rich result. DATA, not code: tracking a
 * Google requirement change is an edit here. Each profile applies to one or more
 * schema.org types; an entity matching any `appliesTo` type is evaluated.
 */
import type { ProfilePack, RichResultProfile } from '../types';

const G = 'https://developers.google.com/search/docs/appearance/structured-data';

function req(
  name: string,
  note?: string,
): { name: string; requirement: 'required'; note?: string } {
  return { name, requirement: 'required', ...(note ? { note } : {}) };
}
function rec(
  name: string,
  note?: string,
): { name: string; requirement: 'recommended'; note?: string } {
  return { name, requirement: 'recommended', ...(note ? { note } : {}) };
}

const profiles: RichResultProfile[] = [
  {
    name: 'Article',
    appliesTo: ['Article', 'NewsArticle', 'BlogPosting'],
    docUrl: `${G}/article`,
    properties: [
      req('headline'),
      rec('image', 'A representative image improves eligibility for image-rich treatment.'),
      rec('datePublished'),
      rec('dateModified'),
      rec('author', 'Use a Person or Organization object with a name.'),
      rec('publisher'),
    ],
  },
  {
    name: 'Product',
    appliesTo: ['Product', 'Vehicle', 'Car'],
    docUrl: `${G}/product`,
    properties: [
      req('name'),
      req('image'),
      rec('offers', 'Include an Offer with price and priceCurrency for price treatment.'),
      rec('review'),
      rec('aggregateRating'),
      rec('brand'),
      rec('sku'),
    ],
  },
  {
    name: 'Review',
    appliesTo: ['Review'],
    docUrl: `${G}/review-snippet`,
    properties: [
      req('itemReviewed'),
      req('reviewRating'),
      req('author'),
      rec('datePublished'),
      rec('reviewBody'),
      rec('publisher'),
    ],
  },
  {
    name: 'AggregateRating',
    appliesTo: ['AggregateRating'],
    docUrl: `${G}/review-snippet`,
    properties: [
      req('ratingValue'),
      req('reviewCount', 'reviewCount or ratingCount is required.'),
      rec('bestRating'),
      rec('itemReviewed'),
    ],
  },
  {
    name: 'Breadcrumb',
    appliesTo: ['BreadcrumbList'],
    docUrl: `${G}/breadcrumb`,
    properties: [
      req('itemListElement', 'An ordered list of ListItem with position and name/item.'),
    ],
  },
  {
    name: 'FAQ',
    appliesTo: ['FAQPage'],
    docUrl: `${G}/faqpage`,
    properties: [req('mainEntity', 'One or more Question entities, each with an acceptedAnswer.')],
  },
  {
    name: 'Event',
    appliesTo: ['Event'],
    docUrl: `${G}/event`,
    properties: [
      req('name'),
      req('startDate'),
      req('location', 'A Place (with address) or VirtualLocation (with url).'),
      rec('endDate'),
      rec('offers'),
      rec('performer'),
      rec('image'),
      rec('eventStatus'),
      rec('eventAttendanceMode'),
    ],
  },
  {
    name: 'Video',
    appliesTo: ['VideoObject'],
    docUrl: `${G}/video`,
    properties: [
      req('name'),
      req('thumbnailUrl', 'thumbnailUrl or thumbnail is required.'),
      req('uploadDate'),
      rec('description'),
      rec('duration'),
      rec('contentUrl', 'contentUrl or embedUrl is recommended for playback.'),
    ],
  },
  {
    name: 'JobPosting',
    appliesTo: ['JobPosting'],
    docUrl: `${G}/job-posting`,
    properties: [
      req('title'),
      req('description'),
      req('datePosted'),
      req('hiringOrganization'),
      req('jobLocation', 'Required unless jobLocationType is TELECOMMUTE.'),
      rec('baseSalary'),
      rec('employmentType'),
      rec('validThrough'),
    ],
  },
  {
    name: 'Organization',
    appliesTo: ['Organization', 'LocalBusiness'],
    docUrl: `${G}/organization`,
    properties: [req('name'), rec('url'), rec('logo'), rec('sameAs'), rec('contactPoint')],
  },
  {
    name: 'LocalBusiness',
    appliesTo: ['LocalBusiness'],
    docUrl: `${G}/local-business`,
    properties: [
      req('name'),
      req('address'),
      rec('telephone'),
      rec('openingHoursSpecification'),
      rec('geo'),
      rec('priceRange'),
      rec('aggregateRating'),
    ],
  },
];

export const PROFILE_PACK: ProfilePack = {
  version: '1.0.0',
  profiles,
};
