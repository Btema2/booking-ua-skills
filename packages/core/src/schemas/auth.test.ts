import { describe, expect, it } from 'vitest';
import { LoginSchema, PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, RegisterSchema } from './auth';

function messagesFor(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('RegisterSchema', () => {
  it('trims and lowercases the email so differently-cased addresses collide', () => {
    const parsed = RegisterSchema.parse({ name: '  Іван  ', email: '  IVAN@X.com ', password: 'correct horse' });

    expect(parsed).toEqual({ name: 'Іван', email: 'ivan@x.com', password: 'correct horse' });
  });

  it('leaves the password untouched — trimming it would silently change credentials', () => {
    const parsed = RegisterSchema.parse({ name: 'Іван', email: 'ivan@x.com', password: '  spaced  ' });

    expect(parsed.password).toBe('  spaced  ');
  });

  it(`rejects a password one character below ${PASSWORD_MIN_LENGTH} in Ukrainian`, () => {
    const result = RegisterSchema.safeParse({ name: 'Іван', email: 'ivan@x.com', password: '1234567' });

    expect(result.success).toBe(false);
    expect(messagesFor(result).password).toBe('Пароль має містити щонайменше 8 символів');
  });

  it('reports every invalid field at once, keyed by field name', () => {
    const result = RegisterSchema.safeParse({ name: '   ', email: 'not-an-email', password: 'short' });

    expect(messagesFor(result)).toEqual({
      name: "Вкажіть ім'я",
      email: 'Некоректний email',
      password: 'Пароль має містити щонайменше 8 символів',
    });
  });

  describe(`the ${PASSWORD_MAX_BYTES}-byte bcrypt ceiling`, () => {
    // 'п' is two bytes in UTF-8, so these are well inside any character-count
    // limit while being far past what bcrypt will actually read.
    const overLongCyrillic = 'п'.repeat(40);

    it('rejects a Cyrillic password that fits in characters but not in bytes', () => {
      expect(overLongCyrillic.length).toBeLessThanOrEqual(PASSWORD_MAX_BYTES);
      expect(new TextEncoder().encode(overLongCyrillic).length).toBeGreaterThan(PASSWORD_MAX_BYTES);

      const result = RegisterSchema.safeParse({ name: 'Іван', email: 'ivan@x.com', password: overLongCyrillic });

      expect(result.success).toBe(false);
      expect(messagesFor(result).password).toBe('Пароль задовгий — спробуйте коротший');
    });

    it('accepts a password sitting exactly on the byte limit', () => {
      const exact = 'п'.repeat(PASSWORD_MAX_BYTES / 2);

      expect(RegisterSchema.safeParse({ name: 'Іван', email: 'ivan@x.com', password: exact }).success).toBe(true);
    });
  });
});

describe('LoginSchema', () => {
  it('normalises the email the same way, so login accepts any casing', () => {
    expect(LoginSchema.parse({ email: ' Ivan@X.CO ', password: 'x' })).toEqual({
      email: 'ivan@x.co',
      password: 'x',
    });
  });

  it('applies no strength rules, so a rule change never locks out an existing account', () => {
    expect(LoginSchema.safeParse({ email: 'ivan@x.com', password: 'a' }).success).toBe(true);
  });

  it('still requires a password to be present', () => {
    const result = LoginSchema.safeParse({ email: 'ivan@x.com', password: '' });

    expect(messagesFor(result).password).toBe('Вкажіть пароль');
  });
});
