import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalendarLogo } from './CalendarLogo';

describe('CalendarLogo', () => {
  it('renders SVG with correct attributes and orange fill', () => {
    const { container } = render(<CalendarLogo className="custom-class" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.getAttribute('class')).toContain('custom-class');

    const rect = svg?.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('#B2622D');
  });
});
