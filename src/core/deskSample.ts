import type { BackupData } from './backup';
import { sampleData } from './demo';
import type { CheckoutResponse } from './types';

/** Made up data for looking at the computer version before signing in: the sample showcase, with a checkout form from its paid buyer. */
export function sampleDesk(now = new Date()): BackupData {
  const s = sampleData(now);
  const form: CheckoutResponse = {
    row: 1,
    timestamp: '',
    saleName: '',
    facebookName: 'Jada Winslow',
    email: '',
    shipToName: 'Jada Winslow',
    street: '12 Maple Court',
    city: 'Dayton',
    state: 'OH',
    zip: '45402',
    pickup: false,
    paymentMethod: 'Venmo',
    note: '',
  };
  return {
    ...s,
    templates: [],
    sales: s.sales.map((sale) => ({ ...sale, checkout: { responses: [form], importedMs: now.getTime() } })),
  };
}
