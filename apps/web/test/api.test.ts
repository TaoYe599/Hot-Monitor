import { describe, expect, it } from "vitest";

import { splitLines } from "../src/lib/api.js";

describe("splitLines", () => {
  it("splits by newline", () => {
    expect(splitLines("line1\nline2\nline3")).toEqual(["line1", "line2", "line3"]);
  });

  it("splits by carriage return + newline", () => {
    expect(splitLines("line1\r\nline2")).toEqual(["line1", "line2"]);
  });

  it("splits by comma", () => {
    expect(splitLines("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(splitLines("  a  ,  b  ")).toEqual(["a", "b"]);
  });

  it("filters empty strings", () => {
    expect(splitLines("a,,b")).toEqual(["a", "b"]);
  });

  it("handles mixed separators", () => {
    expect(splitLines("a\nb,c")).toEqual(["a", "b", "c"]);
  });
});
