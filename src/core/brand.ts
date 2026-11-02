// Change the product name here and every card, photo and screen follows.
export const APP_NAME = 'Skrybix';
export const MAKER_NAME = 'Gathering Moss';

/** The name every build shows. The closed test's old name ended when Skrybix went to production. */
export const appName = (): string => APP_NAME;

/** The origin line. Always present on every card and every stamped photo. */
export const originLine = (): string => `Made with ${appName()} by ${MAKER_NAME}`;

// The room's words, built into every template so a seller sounds like the room without
// choosing them. A sale event is a Grower Showcase; a post for a plant is a Market Listing.
// The Commons only terms live in formats/commons.ts.
export const SHOWCASE = 'Grower Showcase';
export const MARKET_LISTING = 'Market Listing';

/** The Feature Suggestions form. Suggestions go to the team for the weekly read. Its own title still says SprigList, and the link stays exactly as it is. */
export const SUGGESTIONS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeqyTCBVGbXSpM6xs7R93fhsWX29JUXmnaTcKU3zAJbwRqD-A/viewform';

/**
 * The template Google Form a seller makes their own copy of: its copy link, which Google opens as a
 * "Make a copy" page. The setup always sends the seller here. There is no build it by hand route.
 */
export const CHECKOUT_FORM_TEMPLATE_URL = 'https://docs.google.com/forms/d/1EsRdlHm6XPlchFB5IQdq4W9vTPNzuGH3LMaRjmP9zoE/copy';

/** Where the privacy policy is hosted. The paywall links to it, next to the subscription terms. */
export const PRIVACY_URL = 'https://gatheringmoss.shop/pages/skrybix-privacy-policy';
