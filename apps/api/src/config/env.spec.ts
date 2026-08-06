import { loadEnv } from './env';

const validSource = {
  NODE_ENV: 'development',
  PORT: '3000',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'booking',
  POSTGRES_PASSWORD: 'booking',
  POSTGRES_DB: 'booking',
  COOKIE_SECURE: 'false',
};

describe('loadEnv', () => {
  it('parses a valid environment, coercing numeric fields', () => {
    const env = loadEnv(validSource);
    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: 5432,
      POSTGRES_USER: 'booking',
      POSTGRES_PASSWORD: 'booking',
      POSTGRES_DB: 'booking',
      COOKIE_SECURE: false,
      NOTIFY_BEFORE_MINUTES: 10,
    });
  });

  it('parses COOKIE_SECURE=false as false rather than a truthy non-empty string', () => {
    expect(loadEnv({ ...validSource, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
  });

  it('parses COOKIE_SECURE=true as true', () => {
    expect(loadEnv({ ...validSource, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('defaults COOKIE_SECURE to false when omitted, so plain-http local runs can log in', () => {
    const { COOKIE_SECURE, ...rest } = validSource;
    expect(loadEnv(rest).COOKIE_SECURE).toBe(false);
  });

  it('treats a blank value as unset, because Compose substitutes an unset ${VAR} that way', () => {
    const blanked = { ...validSource, COOKIE_SECURE: '', NODE_ENV: '', PORT: '' };

    expect(loadEnv(blanked)).toMatchObject({ COOKIE_SECURE: false, NODE_ENV: 'development', PORT: 3000 });
  });

  it('defaults POSTGRES_HOST to localhost when blank, since every field now has a default', () => {
    expect(loadEnv({ ...validSource, POSTGRES_HOST: '' }).POSTGRES_HOST).toBe('localhost');
  });

  it('rejects a COOKIE_SECURE value that is neither true nor false', () => {
    expect(() => loadEnv({ ...validSource, COOKIE_SECURE: 'yes' })).toThrow(/COOKIE_SECURE/);
  });

  it('defaults POSTGRES_PASSWORD to booking when absent', () => {
    const { POSTGRES_PASSWORD, ...rest } = validSource;
    expect(loadEnv(rest).POSTGRES_PASSWORD).toBe('booking');
  });

  it('defaults PORT to 3000 and NODE_ENV to development when omitted', () => {
    const { PORT, NODE_ENV, ...rest } = validSource;
    const env = loadEnv(rest);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects a non-numeric POSTGRES_PORT instead of silently coercing it', () => {
    expect(() => loadEnv({ ...validSource, POSTGRES_PORT: 'abc' })).toThrow(/POSTGRES_PORT/);
  });

  it('falls back to the declared POSTGRES_PORT default when the value is blank, never to 0', () => {
    // z.coerce.number() would read '' as 0; treating blank as unset keeps the
    // documented default instead, which is what Compose's ${VAR} substitution needs.
    expect(loadEnv({ ...validSource, POSTGRES_PORT: '' }).POSTGRES_PORT).toBe(5432);
  });

  it('rejects a PORT above the valid TCP port range', () => {
    expect(() => loadEnv({ ...validSource, PORT: '99999999' })).toThrow(/PORT/);
  });

  it('defaults NOTIFY_BEFORE_MINUTES to 10 when omitted', () => {
    expect(loadEnv(validSource).NOTIFY_BEFORE_MINUTES).toBe(10);
  });

  it('coerces a numeric NOTIFY_BEFORE_MINUTES string', () => {
    expect(loadEnv({ ...validSource, NOTIFY_BEFORE_MINUTES: '5' }).NOTIFY_BEFORE_MINUTES).toBe(5);
  });

  it('rejects a non-positive NOTIFY_BEFORE_MINUTES instead of silently coercing it', () => {
    expect(() => loadEnv({ ...validSource, NOTIFY_BEFORE_MINUTES: '0' })).toThrow(/NOTIFY_BEFORE_MINUTES/);
  });
});
