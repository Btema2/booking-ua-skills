import { BadRequestException, ConflictException, HttpStatus, UnauthorizedException } from '@nestjs/common';

const EMAIL_TAKEN_MESSAGE = 'Користувач з таким email вже існує';
// Identical for an unknown email and a wrong password, so the endpoint never
// discloses which addresses are registered.
const INVALID_CREDENTIALS_MESSAGE = 'Невірний email або пароль';
const AUTHENTICATION_REQUIRED_MESSAGE = 'Необхідна автентифікація';
const INVALID_OR_EXPIRED_TOKEN_MESSAGE = 'Токен підтвердження недійсний або прострочений';

// The payloads are built explicitly rather than from the exception's default
// shape, because the client contract fixes them at `{ statusCode, message }`.
export function emailAlreadyRegistered(): ConflictException {
  return new ConflictException({ statusCode: HttpStatus.CONFLICT, message: EMAIL_TAKEN_MESSAGE });
}

export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: HttpStatus.UNAUTHORIZED,
    message: INVALID_CREDENTIALS_MESSAGE,
  });
}

export function authenticationRequired(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: HttpStatus.UNAUTHORIZED,
    message: AUTHENTICATION_REQUIRED_MESSAGE,
  });
}

export function invalidOrExpiredVerificationToken(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    message: INVALID_OR_EXPIRED_TOKEN_MESSAGE,
  });
}

