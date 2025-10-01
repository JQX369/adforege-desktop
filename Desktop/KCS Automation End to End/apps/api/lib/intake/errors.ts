export class IntakeError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "IntakeError";
  }
}

export class ValidationError extends IntakeError {
  constructor(message: string, public readonly fieldErrors?: Record<string, string[]>) {
    super(message, 400, "invalid_request");
  }
}

export class UnauthorizedError extends IntakeError {
  constructor(message: string) {
    super(message, 401, "unauthorized");
  }
}

export class ConflictError extends IntakeError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}
