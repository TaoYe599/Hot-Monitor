import { describe, expect, it } from "vitest";

import { parseDuckDuckGoResults } from "./sources.js";

describe("parseDuckDuckGoResults", () => {
  it("extracts titles, links, and snippets", () => {
    const html = `
      <div class="result">
        <div class="result__title">
          <a class="result__a" href="https://example.com/post">OpenAI update</a>
        </div>
        <div class="result__snippet">Latest model release details.</div>
      </div>
    `;

    expect(parseDuckDuckGoResults(html)).toEqual([
      {
        title: "OpenAI update",
        url: "https://example.com/post",
        snippet: "Latest model release details.",
      },
    ]);
  });
});
