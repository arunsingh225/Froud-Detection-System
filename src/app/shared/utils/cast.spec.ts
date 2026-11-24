import { asUnion } from './cast';

describe('asUnion', () => {
  type Tier = 'Low' | 'High';

  it('passes through a provided value', () => {
    expect(asUnion<Tier>('High', 'Low')).toBe('High');
  });

  it('falls back when the value is missing or empty', () => {
    expect(asUnion<Tier>(undefined, 'Low')).toBe('Low');
    expect(asUnion<Tier>(null, 'Low')).toBe('Low');
    expect(asUnion<Tier>('', 'Low')).toBe('Low');
  });

  it('is an unchecked cast: an unexpected server value passes through unchanged', () => {
    expect(asUnion<Tier>('Critical', 'Low') as string).toBe('Critical');
  });
});
