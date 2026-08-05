import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WeekGridEmpty, WeekGridError, WeekGridLoading } from './WeekGridStates';

describe('WeekGridLoading', () => {
  afterEach(cleanup);

  it('renders a status region with aria-busy and skeleton placeholders without a spinner', () => {
    render(<WeekGridLoading />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Завантажуємо розклад…')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('WeekGridEmpty', () => {
  afterEach(cleanup);

  it('renders empty schedule messages and 5 day columns by default', () => {
    render(<WeekGridEmpty />);

    expect(screen.getByRole('heading', { level: 3, name: 'Цього тижня все вільно' })).toBeTruthy();
    expect(screen.getByText('Жодного бронювання — оберіть будь-який слот')).toBeTruthy();

    expect(screen.getByText('Пн')).toBeTruthy();
    expect(screen.getByText('Вт')).toBeTruthy();
    expect(screen.getByText('Ср')).toBeTruthy();
    expect(screen.getByText('Чт')).toBeTruthy();
    expect(screen.getByText('Пт')).toBeTruthy();
  });

  it('supports custom daysCount', () => {
    render(<WeekGridEmpty daysCount={7} />);

    expect(screen.getByText('Сб')).toBeTruthy();
    expect(screen.getByText('Нд')).toBeTruthy();
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
    expect(screen.getByText('Пн')).toBeTruthy();
  });
});
