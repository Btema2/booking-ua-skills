import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt silently truncates past 72 *bytes*, which would make two different
// passwords interchangeable. Measured in bytes rather than characters because in
// UTF-8 a Cyrillic letter costs two — a 40-character Ukrainian passphrase is
// already over the limit, and a length check would wave it through.
export const PASSWORD_MAX_BYTES = 72;
export const NAME_MAX_LENGTH = 100;

// TextEncoder rather than Buffer: this package is bundled into the browser too.
const utf8 = new TextEncoder();

// Normalising here (not at the call site) is what makes `IVAN@x.com` and
// ` ivan@x.com ` collide on the users_email_key unique index.
export const EmailSchema = z
  .string({ error: 'Вкажіть email' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Некоректний email' }));

export const PasswordSchema = z
  .string({ error: 'Вкажіть пароль' })
  .min(PASSWORD_MIN_LENGTH, { error: `Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів` })
  .refine((value) => utf8.encode(value).length <= PASSWORD_MAX_BYTES, {
    error: 'Пароль задовгий — спробуйте коротший',
  });

export const NameSchema = z
  .string({ error: "Вкажіть ім'я" })
  .trim()
  .min(1, { error: "Вкажіть ім'я" })
  .max(NAME_MAX_LENGTH, { error: `Ім'я має містити не більше ${NAME_MAX_LENGTH} символів` });

export const RegisterSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// Login deliberately does not reuse PasswordSchema: rejecting a stored password
// that predates a rule change would lock the user out with a confusing message.
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string({ error: 'Вкажіть пароль' }).min(1, { error: 'Вкажіть пароль' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PublicUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
});

export type PublicUser = z.infer<typeof PublicUserSchema>;
