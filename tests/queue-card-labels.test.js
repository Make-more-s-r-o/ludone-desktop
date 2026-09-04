import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error JSX produkčního rendereru při testu transformuje Vite.
import { QueueCard } from "../src/features/queue/QueueCard.jsx";

beforeEach(() => {
  vi.stubGlobal("React", React);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function items(state, count) {
  return Array.from({ length: count }, () => ({
    state,
    requiresHumanAction: false,
    sizeBytes: 1,
    nextAttemptAt: null,
    lastFailureReason: null,
  }));
}

function renderQueueCard(count) {
  const markup = renderToStaticMarkup(React.createElement(QueueCard, {
    items: [
      ...items("ceka", count),
      ...items("odesila", count),
      ...items("selhalo", count),
    ],
  }));
  return new JSDOM(markup).window.document;
}

describe("skloňování v panelové kartě fronty", () => {
  it.each([
    {
      count: 1,
      waiting: "1 čeká na odeslání",
      sending: "1 se odesílá",
      failed: "1 selhalo",
    },
    {
      count: 2,
      waiting: "2 čekají na odeslání",
      sending: "2 se odesílají",
      failed: "2 selhaly",
    },
    {
      count: 4,
      waiting: "4 čekají na odeslání",
      sending: "4 se odesílají",
      failed: "4 selhaly",
    },
    {
      count: 5,
      waiting: "5 čeká na odeslání",
      sending: "5 se odesílá",
      failed: "5 selhalo",
    },
    {
      count: 16,
      waiting: "16 čeká na odeslání",
      sending: "16 se odesílá",
      failed: "16 selhalo",
    },
  ])("zachová dnešní tvary pro $count", ({ count, waiting, sending, failed }) => {
    const document = renderQueueCard(count);

    expect(document.querySelector(".queue-card__summary strong")?.textContent).toBe(waiting);
    expect(document.querySelector(".queue-card__secondary strong")?.textContent).toBe(sending);
    expect(document.querySelector(".queue-card__failed strong")?.textContent).toBe(failed);
  });
});
