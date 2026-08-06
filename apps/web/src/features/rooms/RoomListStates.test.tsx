// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoomListLoading } from './RoomListStates';

describe('RoomListLoading', () => {
  it('renders status region with skeleton list items matching room cards', () => {
    render(<RoomListLoading />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(screen.getByText('Завантажуємо переговорні…')).toBeTruthy();
    const listItems = screen.getAllByRole('listitem', { hidden: true });
    expect(listItems.length).toBe(2);
  });
});
