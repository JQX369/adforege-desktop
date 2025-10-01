import client from "prom-client";

const register = new client.Registry();
register.setDefaultLabels({ service: "kcs-api" });
client.collectDefaultMetrics({ register });

const jobCounter = new client.Counter({
  name: "story_jobs_total",
  help: "Total number of story pipeline jobs processed",
  labelNames: ["job", "status"],
  registers: [register]
});

const jobDuration = new client.Histogram({
  name: "story_jobs_duration_seconds",
  help: "Duration of story pipeline jobs in seconds",
  labelNames: ["job"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// Print pipeline specific metrics
const printCoverGenerationDuration = new client.Histogram({
  name: "print_cover_generation_seconds",
  help: "Duration of cover generation jobs",
  labelNames: ["provider"],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

const printInteriorGenerationDuration = new client.Histogram({
  name: "print_interior_batch_seconds",
  help: "Duration of interior batch generation jobs",
  labelNames: ["page_count"],
  buckets: [10, 30, 60, 120, 300, 600],
  registers: [register]
});

const printCmykConversionDuration = new client.Histogram({
  name: "print_cmyk_conversion_seconds",
  help: "Duration of CMYK conversion jobs",
  labelNames: ["image_count"],
  buckets: [5, 10, 30, 60, 120],
  registers: [register]
});

const printAssemblyDuration = new client.Histogram({
  name: "print_assembly_seconds",
  help: "Duration of book assembly jobs",
  labelNames: ["page_count"],
  buckets: [10, 30, 60, 120, 300],
  registers: [register]
});

const printHandoffCounter = new client.Counter({
  name: "print_handoff_total",
  help: "Total handoff deliveries by status",
  labelNames: ["status", "has_drive", "has_webhook"],
  registers: [register]
});

export const recordJobMetrics = (job: string, status: "success" | "failure", durationMs: number) => {
  jobCounter.labels({ job, status }).inc();
  jobDuration.labels({ job }).observe(durationMs / 1000);
};

export const recordPrintCoverMetrics = (provider: string, durationMs: number) => {
  printCoverGenerationDuration.labels({ provider }).observe(durationMs / 1000);
};

export const recordPrintInteriorMetrics = (pageCount: number, durationMs: number) => {
  printInteriorGenerationDuration.labels({ page_count: pageCount.toString() }).observe(durationMs / 1000);
};

export const recordPrintCmykMetrics = (imageCount: number, durationMs: number) => {
  printCmykConversionDuration.labels({ image_count: imageCount.toString() }).observe(durationMs / 1000);
};

export const recordPrintAssemblyMetrics = (pageCount: number, durationMs: number) => {
  printAssemblyDuration.labels({ page_count: pageCount.toString() }).observe(durationMs / 1000);
};

export const recordPrintHandoffMetrics = (status: string, hasDrive: boolean, hasWebhook: boolean) => {
  printHandoffCounter.labels({
    status,
    has_drive: hasDrive.toString(),
    has_webhook: hasWebhook.toString()
  }).inc();
};

// Image API metrics
const imageApiDuration = new client.Histogram({
  name: "image_api_call_duration_seconds",
  help: "Duration of image API calls",
  labelNames: ["provider", "model", "operation", "status"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

const imageApiCounter = new client.Counter({
  name: "image_api_calls_total",
  help: "Total image API calls",
  labelNames: ["provider", "model", "operation", "status"],
  registers: [register]
});

export const recordImageApiMetrics = (
  provider: string,
  model: string,
  operation: "generate" | "vision",
  status: "success" | "failure",
  durationMs: number
) => {
  imageApiCounter.labels({ provider, model, operation, status }).inc();
  imageApiDuration.labels({ provider, model, operation, status }).observe(durationMs / 1000);
};

export const createCounter = (name: string, help: string) => {
  return new client.Counter({
    name,
    help,
    registers: [register]
  });
};

export const metricsRegister = register;

