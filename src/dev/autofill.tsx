import type { ReactNode } from 'react';
import { DEFAULT_BRAND_COLOR } from '../theme-palette';

type Scenario = 'organization' | 'found' | 'lost';
type Values = Record<string, string | number | boolean | null>;
const values: Record<Scenario, Values> = {
  organization: { name: 'Northside Community Center', organizationType: 'Community center', phone: '(555) 010-2040', email: 'hello@example.test', primaryColor: DEFAULT_BRAND_COLOR },
  found: { name: 'Blue insulated water bottle', categoryId: 'drinkware', description: 'Blue stainless-steel bottle with a small star sticker on the base.', color: 'Blue', brand: 'HydroPeak', foundLocation: 'East Gymnasium', finderName: 'Taylor Reed', finderContact: 'taylor@example.test', staffNotes: 'Found near the west entrance.' },
  lost: { name: 'Blue stainless-steel water bottle', categoryId: 'drinkware', description: 'Blue bottle with a small star sticker on the base.', color: 'Blue', brand: 'HydroPeak', lastLocation: 'East Gymnasium', claimantName: 'Taylor Reed', contact: 'taylor@example.test', notes: 'Similar item was logged for staff review.' },
};
export default function DevAutofill({ scenario, onFill }: { scenario: Scenario; onFill: (values: Values) => void }): ReactNode {
  return <div className="dev-autofill"><span>DEVELOPMENT ONLY</span><button type="button" className="button button-secondary button-small" onClick={() => onFill({ ...values[scenario], ...(scenario === 'found' || scenario === 'lost' ? { [scenario === 'found' ? 'foundAt' : 'lostAt']: new Date().toISOString().slice(0, 16) } : {}) })}>Autofill Test Data</button></div>;
}
