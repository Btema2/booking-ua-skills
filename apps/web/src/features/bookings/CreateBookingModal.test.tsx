import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateBookingModal } from './CreateBookingModal';

describe('CreateBookingModal', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    roomName: 'Переговорка 1',
    dateDisplayStr: 'Понеділок, 10 серпня',
    initialStartISO: '2026-08-10T07:00:00.000Z', // 10:00 Kyiv
    initialEndISO: '2026-08-10T08:00:00.000Z', // 11:00 Kyiv
    viewerZone: 'Europe/Kyiv',
    onSubmit: vi.fn().mockResolvedValue(undefined),
    isSubmitting: false,
    serverFormError: null,
    serverFieldErrors: {},
  };

  it('renders nothing when isOpen is false', () => {
    render(<CreateBookingModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal with room name, date display string, and initial values', () => {
    render(<CreateBookingModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Переговорка 1 · Понеділок, 10 серпня')).toBeTruthy();

    const titleInput = screen.getByLabelText('Назва події') as HTMLInputElement;
    expect(titleInput).toBeTruthy();
    expect(titleInput.value).toBe('');
    expect(titleInput.className).toContain('border-dashed');

    const startSelect = screen.getByLabelText('Початок') as HTMLSelectElement;
    const endSelect = screen.getByLabelText('Кінець') as HTMLSelectElement;
    expect(startSelect.value).toBe('2026-08-10T07:00:00.000Z');
    expect(endSelect.value).toBe('2026-08-10T08:00:00.000Z');
  });

  it('updates end time default to start time + 30 mins when start time is changed', async () => {
    render(<CreateBookingModal {...defaultProps} initialEndISO="" />);

    const startSelect = screen.getByLabelText('Початок') as HTMLSelectElement;
    const endSelect = screen.getByLabelText('Кінець') as HTMLSelectElement;

    // Initially 10:00 start -> 10:30 end because initialEndISO was empty
    expect(startSelect.value).toBe('2026-08-10T07:00:00.000Z');
    expect(endSelect.value).toBe('2026-08-10T07:30:00.000Z');

    // Change start to 12:00 Kyiv (09:00Z)
    fireEvent.change(startSelect, { target: { value: '2026-08-10T09:00:00.000Z' } });

    expect(startSelect.value).toBe('2026-08-10T09:00:00.000Z');
    expect(endSelect.value).toBe('2026-08-10T09:30:00.000Z');
  });

  it('submits form values when title is provided', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateBookingModal {...defaultProps} onSubmit={handleSubmit} />);

    const titleInput = screen.getByLabelText('Назва події');
    fireEvent.change(titleInput, { target: { value: 'Демо сесія' } });

    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Демо сесія',
        startsAt: '2026-08-10T07:00:00.000Z',
        endsAt: '2026-08-10T08:00:00.000Z',
      });
    });
  });

  it('shows a weekly-repeat toggle and occurrence count, and calls onSubmitSeries with the count when checked', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSubmitSeries = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateBookingModal
        {...defaultProps}
        onSubmit={onSubmit}
        onSubmitSeries={onSubmitSeries}
      />,
    );

    const titleInput = screen.getByLabelText('Назва події');
    fireEvent.change(titleInput, { target: { value: 'Щотижневий синк' } });

    const toggleCheckbox = screen.getByLabelText('Повторювати щотижня') as HTMLInputElement;
    fireEvent.click(toggleCheckbox);

    const countInput = screen.getByLabelText('Кількість повторень') as HTMLInputElement;
    fireEvent.change(countInput, { target: { value: '3' } });

    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitSeries).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Щотижневий синк', occurrenceCount: 3 }),
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('defaults to the single-booking submit path when the repeat toggle is off', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSubmitSeries = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateBookingModal
        {...defaultProps}
        onSubmit={onSubmit}
        onSubmitSeries={onSubmitSeries}
      />,
    );

    const titleInput = screen.getByLabelText('Назва події');
    fireEvent.change(titleInput, { target: { value: 'Одноразова подія' } });

    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(onSubmitSeries).not.toHaveBeenCalled();
    });
  });

  it('shows client error when submitting empty title', async () => {
    const handleSubmit = vi.fn();
    render(<CreateBookingModal {...defaultProps} onSubmit={handleSubmit} />);

    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  it('renders serverFormError banner and serverFieldErrors', () => {
    render(
      <CreateBookingModal
        {...defaultProps}
        serverFormError="Слот зайнятий"
        serverFieldErrors={{
          title: 'Некоректна назва',
          time: 'Обраний час недоступний',
        }}
      />,
    );

    expect(screen.getByText('Слот зайнятий')).toBeTruthy();
    expect(screen.getByText('Некоректна назва')).toBeTruthy();
    expect(screen.getByText('Обраний час недоступний')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Повторити' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Закрити' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders submitting state with locked inputs and spinner', () => {
    render(<CreateBookingModal {...defaultProps} isSubmitting={true} />);

    const titleInput = screen.getByLabelText('Назва події') as HTMLInputElement;
    expect(titleInput.disabled).toBe(true);
    expect(titleInput.className).toContain('opacity-55');

    const submitBtn = screen.getByRole('button', { name: /Бронюємо…/ }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.className).toContain('opacity-72');
  });

  it('preserves typed values in fields when server error occurs', () => {
    const { rerender } = render(<CreateBookingModal {...defaultProps} />);

    const titleInput = screen.getByLabelText('Назва події') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Моя подія' } });

    rerender(
      <CreateBookingModal
        {...defaultProps}
        serverFormError="Серверна помилка"
      />,
    );

    expect(titleInput.value).toBe('Моя подія');
    expect(screen.getByText('Серверна помилка')).toBeTruthy();
  });

  it('shows error and blocks submit when selected time range overlaps an existing booking', async () => {
    const handleSubmit = vi.fn();
    const existingBookings = [
      {
        id: 'b-existing-1',
        roomId: 1,
        title: 'Існуюче бронювання',
        startsAt: new Date('2026-08-10T07:30:00.000Z'),
        endsAt: new Date('2026-08-10T08:30:00.000Z'),
        userId: 'user-2',
        userName: 'Олексій',
        seriesId: null,
      },
    ];

    render(
      <CreateBookingModal
        {...defaultProps}
        roomId={1}
        existingBookings={existingBookings}
        initialStartISO="2026-08-10T07:00:00.000Z" // 10:00 Kyiv
        initialEndISO="2026-08-10T08:00:00.000Z" // 11:00 Kyiv — overlaps 10:30-11:30
        onSubmit={handleSubmit}
      />,
    );

    const titleInput = screen.getByLabelText('Назва події');
    fireEvent.change(titleInput, { target: { value: 'Тестова подія' } });

    const submitBtn = screen.getByRole('button', { name: 'Забронювати' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Слот зайнятий')).toBeTruthy();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });
});
