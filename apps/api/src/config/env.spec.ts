import { loadEnv } from './env';

const validSource = {
  NODE_ENV: 'development',
  PORT: '3000',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'booking',
  POSTGRES_PASSWORD: 'booking',
  POSTGRES_DB: 'booking',
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
    });
  });

  it('throws naming the missing key when POSTGRES_PASSWORD is absent', () => {
    const { POSTGRES_PASSWORD, ...rest } = validSource;
    expect(() => loadEnv(rest)).toThrow(/POSTGRES_PASSWORD/);
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

  it('rejects an empty-string POSTGRES_PORT instead of silently defaulting to 0', () => {
    expect(() => loadEnv({ ...validSource, POSTGRES_PORT: '' })).toThrow(/POSTGRES_PORT/);
  });

  it('rejects a PORT above the valid TCP port range', () => {
    expect(() => loadEnv({ ...validSource, PORT: '99999999' })).toThrow(/PORT/);
  });
});
