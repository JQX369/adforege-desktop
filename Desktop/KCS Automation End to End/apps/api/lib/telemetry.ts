import { Span, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("kcs-api");

export const withSpan = async <T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> => {
  const span = tracer.startSpan(name);
  try {
    return await fn(span);
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : "Unknown error"
    });
    throw error;
  } finally {
    span.end();
  }
};

