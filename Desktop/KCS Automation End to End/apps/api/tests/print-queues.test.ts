import { describe, expect, it, vi } from "vitest";

vi.mock("bullmq", () => {
  class Queue {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    add() {
      return Promise.resolve();
    }
  }

  class QueueScheduler {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
  }

  return { Queue, QueueScheduler };
});

const { queueNames, queues, schedulers } = await import("../lib/queues");

const expectedPhase6Queues = {
  storyCover: "story.cover",
  storyInterior: "story.interior",
  storyCmyk: "story.cmyk",
  storyAssembly: "story.assembly",
  storyHandoff: "story.handoff"
} as const;

describe("print pipeline queue wiring", () => {
  it("exposes queue names for each Phase 6 step", () => {
    for (const [key, name] of Object.entries(expectedPhase6Queues)) {
      expect(queueNames[key as keyof typeof expectedPhase6Queues]).toBe(name);
    }
  });

  it("instantiates BullMQ queues for Phase 6", () => {
    for (const [key, name] of Object.entries(expectedPhase6Queues)) {
      const queue = queues[key as keyof typeof expectedPhase6Queues];
      expect(queue).toBeDefined();
      expect(queue.name).toBe(name);
    }
  });

  it("registers queue schedulers for Phase 6", () => {
    for (const [key, name] of Object.entries(expectedPhase6Queues)) {
      const scheduler = schedulers[key as keyof typeof expectedPhase6Queues];
      expect(scheduler).toBeDefined();
      expect(scheduler.name).toBe(name);
    }
  });
});



