import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterInput } from '@booking/core';
import { TextField } from '../../components/TextField';
import { FormError } from '../../components/FormError';
import { AuthCard, AuthFooterLink, AuthSubmitButton } from './AuthCard';
import { useRegisterMutation } from './useAuthMutations';
import { useAuthFormErrors } from './useAuthFormErrors';

const REGISTER_FIELDS = [
  { name: 'name', label: 'Імʼя', type: 'text', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Пароль', type: 'password', autoComplete: 'new-password' },
] as const;

const REGISTER_FIELD_NAMES = REGISTER_FIELDS.map((field) => field.name);

function RegisterForm() {
  const registerUser = useRegisterMutation();
  const { formError, clearFormError, reportFailure } = useAuthFormErrors(REGISTER_FIELD_NAMES);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  // `mutateAsync` + catch keeps the typed values in place: nothing resets.
  const onSubmit = handleSubmit(async (values) => {
    clearFormError();
    try {
      await registerUser.mutateAsync(values);
    } catch (error) {
      reportFailure(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <FormError message={formError} />
      {REGISTER_FIELDS.map(({ name, ...field }) => (
        <TextField
          key={name}
          {...field}
          error={errors[name]?.message}
          registration={register(name)}
        />
      ))}
      <AuthSubmitButton
        pending={registerUser.isPending}
        label="Зареєструватися"
        pendingLabel="Реєструємо…"
      />
    </form>
  );
}

export function RegisterPage() {
  return (
    <AuthCard
      title="Реєстрація"
      footer={<AuthFooterLink question="Вже маєте акаунт?" to="/login" label="Увійти" />}
    >
      <RegisterForm />
    </AuthCard>
  );
}
