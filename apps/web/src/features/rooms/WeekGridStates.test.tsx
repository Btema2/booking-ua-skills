// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DefaultFallbackGrid, SkeletonBar, WeekGridError, WeekGridLoading } from './WeekGridStates';

describe('SkeletonBar', () => {
  afterEach(cleanup);

  it('renders SkeletonBar with provided rounding classes instead of forcing rounded-full', () => {
    const { container } = render(<SkeletonBar className="h-4 w-12 rounded-[var(--block-radius)]" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('rounded-[var(--block-radius)]');
    expect(span?.className).not.toContain('rounded-full');
  });
});

describe('WeekGridLoading', () => {
  afterEach(cleanup);

  it('renders a status region with aria-busy and skeleton placeholders without a spinner', () => {
    render(<WeekGridLoading />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Завантажуємо розклад…')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('renders static time labels (09:00 to 18:00) in time gutter', () => {
    render(<WeekGridLoading daysCount={7} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('12:00')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
  });

  it('renders Ukrainian day headers (ПН to НД) in loading skeleton', () => {
    render(<WeekGridLoading daysCount={7} />);
    expect(screen.getByText('ПН')).toBeTruthy();
    expect(screen.getByText('ВТ')).toBeTruthy();
    expect(screen.getByText('НД')).toBeTruthy();
  });
});

describe('WeekGridError', () => {
  afterEach(cleanup);

  it('renders error banner with retry button and applies opacity/grayscale to grid', () => {
    const onRetryMock = vi.fn();
    render(
      <WeekGridError onRetry={onRetryMock}>
        <div data-testid="test-grid">Grid content</div>
      </WeekGridError>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(screen.getByText('Розклад може бути застарілим')).toBeTruthy();

    const retryBtn = screen.getByRole('button', { name: 'Оновити зараз' });
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);

    const gridWrapper = screen.getByTestId('test-grid').parentElement;
    expect(gridWrapper?.className).toContain('opacity-45');
    expect(gridWrapper?.className).toContain('grayscale-[35%]');
  });

  it('renders default fallback grid when no children are passed', () => {
    render(<WeekGridError />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('ПН')).toBeTruthy();
  });

  it('does not render misleading "everything is free" messaging in the error backdrop', () => {
    render(
      <WeekGridError>
        <DefaultFallbackGrid daysCount={7} />
      </WeekGridError>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Розклад може бути застарілим')).toBeTruthy();
    expect(screen.queryByText('Цього тижня все вільно')).toBeNull();
    expect(screen.queryByText('Жодного бронювання — оберіть будь-який слот')).toBeNull();
  });
});
