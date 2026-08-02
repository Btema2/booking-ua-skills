import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@booking/core';
import { TextField } from '../../components/TextField';
import { FormError } from '../../components/FormError';
import { AuthCard, AuthFooterLink, AuthSubmitButton } from './AuthCard';
import { useLoginMutation } from './useAuthMutations';
import { useAuthFormErrors } from './useAuthFormErrors';

const LOGIN_FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Пароль', type: 'password', autoComplete: 'current-password' },
] as const;

const LOGIN_FIELD_NAMES = LOGIN_FIELDS.map((field) => field.name);

function LoginForm() {
  const login = useLoginMutation();
  const { formError, clearFormError, reportFailure } = useAuthFormErrors(LOGIN_FIELD_NAMES);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // `mutateAsync` + catch keeps the typed values in place: nothing resets.
  const onSubmit = handleSubmit(async (values) => {
    clearFormError();
    try {
      await login.mutateAsync(values);
    } catch (error) {
      reportFailure(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <FormError message={formError} />
      {LOGIN_FIELDS.map(({ name, ...field }) => (
        <TextField
          key={name}
          {...field}
          error={errors[name]?.message}
          registration={register(name)}
        />
      ))}
      <AuthSubmitButton pending={login.isPending} label="Увійти" pendingLabel="Входимо…" />
    </form>
  );
}

export function LoginPage() {
  return (
    <AuthCard
      title="Вхід"
      footer={<AuthFooterLink question="Немає акаунта?" to="/register" label="Зареєструватися" />}
    >
      <LoginForm />
    </AuthCard>
  );
}
