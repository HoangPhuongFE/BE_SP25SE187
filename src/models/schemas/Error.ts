import HTTP_STATUS from '../../constants/httpStatus'
import { USER_MESSAGE } from '../../constants/message'; // Use named import

type ErrorsType = Record<
  string,
  {
    msg: string
    [key: string]: any
  }
>

export class ErrorWithStatus {
  message: string
  status: number
  constructor({ message, status }: { message: string; status: number }) {
    this.message = message
    this.status = status
  }
}

export class EntityError extends ErrorWithStatus {
  errors: ErrorsType
  constructor({
    message = USER_MESSAGE.VALIDATION_ERROR,
    errors
  }: {
    message?: string
    errors: ErrorsType
  }) {
    super({ message, status: HTTP_STATUS.UNPROCESSABLE_ENTITY })
    this.errors = errors
  }
}

export class CustomError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string) {
      super(message, 400);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string) {
      super(message, 404);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string) {
      super(message, 401);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string) {
      super(message, 403);
  }
}