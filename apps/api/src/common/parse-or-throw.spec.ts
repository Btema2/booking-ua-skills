import { LoginSchema, RegisterSchema } from '@booking/core';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { parseOrThrow } from './parse-or-throw';

function captureBody(schema: z.ZodType, payload: unknown): unknown {
  try {
    parseOrThrow(schema, payload);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('expected parseOrThrow to reject the payload');
}

describe('parseOrThrow', () => {
  it('returns the parsed value when the payload is valid', () => {
    expect(parseOrThrow(LoginSchema, { email: 'ivan@x.com', password: 'secret' })).toEqual({
      email: 'ivan@x.com',
      password: 'secret',
    });
  });

  it('maps a multi-field failure to { statusCode, errors: { field: [message] } }', () => {
    const body = captureBody(RegisterSchema, { name: '', email: 'not-an-email', password: 'short' });

    expect(body).toEqual({
      statusCode: 400,
      errors: {
        name: ["Вкажіть ім'я"],
        email: ['Некоректний email'],
        password: ['Пароль має містити щонайменше 8 символів'],
      },
    });
  });

  it('reports a 7-character password under `password` with a Ukrainian message', () => {
    const body = captureBody(RegisterSchema, {
      name: 'Іван',
      email: 'ivan@x.com',
      password: '1234567',
    }) as { statusCode: number; errors: Record<string, string[]> };

    expect(body.statusCode).toBe(400);
    expect(body.errors.password).toEqual(['Пароль має містити щонайменше 8 символів']);
    expect(body.errors.email).toBeUndefined();
  });

  it('collects every message for a field instead of keeping only the first', () => {
    const schema = z.object({
      password: z.string().min(8, { error: 'закоротко' }).regex(/\d/, { error: 'потрібна цифра' }),
    });

    expect(captureBody(schema, { password: 'abc' })).toEqual({
      statusCode: 400,
      errors: { password: ['закоротко', 'потрібна цифра'] },
    });
  });

  it('files a pathless issue under _form so the body is never an empty errors object', () => {
    expect(captureBody(RegisterSchema, 'not an object')).toEqual({
      statusCode: 400,
      errors: { _form: [expect.any(String)] },
    });
  });
});
