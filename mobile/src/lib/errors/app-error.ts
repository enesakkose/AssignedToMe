export type AppErrorCode = "api" | "network" | "validation" | "unauthorized" | "unknown";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode = "unknown",
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static fromUnknown(error: unknown) {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, "unknown", undefined, error);
    }

    return new AppError("Something went wrong.", "unknown", undefined, error);
  }
}
