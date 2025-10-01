import { Queue, QueueScheduler, Worker } from "bullmq";

export type QueueNames =
  | "brief.extract"
  | "story.reason"
  | "images.analyze_uploads"
  | "story.scene_breakdown"
  | "images.generate_batch"
  | "images.prepress"
  | "covers.compose"
  | "layout.compose_pdf"
  | "print.submit"
  | "print.track";

export const createQueue = (name: QueueNames, connection: { connection: string | URL }) => {
  return new Queue(name, connection);
};

export const createQueueScheduler = (name: QueueNames, connection: { connection: string | URL }) => {
  return new QueueScheduler(name, connection);
};

export const createWorker = <T>(
  name: QueueNames,
  processor: Worker<T>["processor"],
  connection: { connection: string | URL }
) => new Worker<T>(name, processor, connection);

