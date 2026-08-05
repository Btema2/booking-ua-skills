import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { mapApiErrorToForm } from './errorMapping';

describe('mapApiErrorToForm', () => {
  it('maps 409 status to formError "Слот зайнятий"', () => {
    const apiErr = new ApiError(409, 'Conflict');
    const result = mapApiErrorToForm(apiErr);
    expect(result).toEqual({
      fieldErrors: {},
      formError: 'Слот зайнятий',
    });

    const rawErr = { statusCode: 409 };
    expect(mapApiErrorToForm(rawErr)).toEqual({
      fieldErrors: {},
      formError: 'Слот зайнятий',
    });
  });

  it('maps title field error from 400 response', () => {
    const apiErr = new ApiError(400, 'Bad Request', {
      title: ['Назва обовʼязкова'],
    });
    const result = mapApiErrorToForm(apiErr);
    expect(result).toEqual({
      fieldErrors: {
        title: 'Назва обовʼязкова',
      },
      formError: null,
    });
  });

  it('maps time-related field errors (startsAt, endsAt, duration, time, alignment, officeHours, past) to fieldErrors.time', () => {
    const keys = ['startsAt', 'endsAt', 'duration', 'time', 'alignment', 'officeHours', 'past'] as const;

    for (const key of keys) {
      const apiErr = new ApiError(400, 'Bad Request', {
        [key]: [`Помилка для ${key}`],
      });
      const result = mapApiErrorToForm(apiErr);
      expect(result).toEqual({
        fieldErrors: {
          time: `Помилка для ${key}`,
        },
        formError: null,
      });
    }
  });

  it('maps both title and time field errors simultaneously', () => {
    const apiErr = new ApiError(400, 'Bad Request', {
      title: ['Назва занадто довга'],
      startsAt: ['Неможливо забронювати у минулому'],
    });
    const result = mapApiErrorToForm(apiErr);
    expect(result).toEqual({
      fieldErrors: {
        title: 'Назва занадто довга',
        time: 'Неможливо забронювати у минулому',
      },
      formError: null,
    });
  });

  it('maps raw 400 object response with errors field', () => {
    const rawErr = {
      statusCode: 400,
      errors: {
        title: ['Заголовок занадто короткий'],
        duration: ['Тривалість має бути кратна 30 хв'],
      },
    };
    const result = mapApiErrorToForm(rawErr);
    expect(result).toEqual({
      fieldErrors: {
        title: 'Заголовок занадто короткий',
        time: 'Тривалість має бути кратна 30 хв',
      },
      formError: null,
    });
  });

  it('fallback for other statuses (e.g. 500) or generic errors is "Бронювання не збережено"', () => {
    const serverErr = new ApiError(500, 'Internal Server Error');
    expect(mapApiErrorToForm(serverErr)).toEqual({
      fieldErrors: {},
      formError: 'Бронювання не збережено',
    });

    const unknownErr = new Error('Random error');
    expect(mapApiErrorToForm(unknownErr)).toEqual({
      fieldErrors: {},
      formError: 'Бронювання не збережено',
    });

    const empty400 = new ApiError(400, 'Bad Request');
    expect(mapApiErrorToForm(empty400)).toEqual({
      fieldErrors: {},
      formError: 'Бронювання не збережено',
    });
  });
});
