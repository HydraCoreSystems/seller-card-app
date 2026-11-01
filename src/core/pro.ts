/**
 * The checkout chain is a Pro feature. A free seller sees it explained in plain words and never
 * sees it broken or half working: the chain's screens, fields and lines simply aren't there until
 * Pro is on. The free tier is exactly as strong as it was before the chain.
 */

export const PRO_TITLE = 'Checkout, from the sale to the shipping label';

export const PRO_POINTS = [
  'A buyer contact deadline in your announcement, printed as a real clock time.',
  'One short checkout form for your winners, in your own Google account.',
  'Form responses matched to your winners by Facebook name. A name that matches nobody is flagged for you, never guessed at.',
  'A rundown that follows each winner from won, to form in, to paid, to shipped.',
  'A packing list you can print, from your paid buyers.',
  'A label file for Pirate Ship’s batch upload, for paid buyers only.',
] as const;

export const PRO_PRIVACY =
  'No account with us, no server of ours, and no buyer data on our side. Your form, your sheet and your files stay on your phone and in your own Google account.';

/** Said wherever Pro is switched on in this test build, so nobody thinks money changed hands. */
export const PRO_TEST_NOTE = 'This is a test build. There is no payment yet, so this switch just turns the checkout chain on for you to try.';
