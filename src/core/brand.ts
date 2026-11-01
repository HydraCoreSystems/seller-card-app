// Change the product name here and every card, photo and screen follows.
export const APP_NAME = 'SprigList';
export const MAKER_NAME = 'Gathering Moss';

/** The origin line. Always present on every card and every stamped photo. */
export const ORIGIN_LINE = `Made with ${APP_NAME} by ${MAKER_NAME}`;

// The room's words, built into every template so a seller sounds like the room without
// choosing them. A sale event is a Grower Showcase; a post for a plant is a Market Listing.
// The Commons only terms live in formats/commons.ts.
export const SHOWCASE = 'Grower Showcase';
export const MARKET_LISTING = 'Market Listing';

/** The SprigList: Feature Suggestions form. Suggestions go to the team for the weekly read. */
export const SUGGESTIONS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeqyTCBVGbXSpM6xs7R93fhsWX29JUXmnaTcKU3zAJbwRqD-A/viewform';

/**
 * The template Google Form a seller makes their own copy of: its link ending in /copy. Left blank
 * until the template form is published. While it is blank, the app walks the seller through making
 * the form by hand from the field list instead, which makes the same form.
 */
export const CHECKOUT_FORM_TEMPLATE_URL = '';
