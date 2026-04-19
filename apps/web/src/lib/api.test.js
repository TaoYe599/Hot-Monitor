import { describe, expect, it } from "vitest";
import { splitLines } from "./api";
describe("splitLines", () => {
    it("splits newline and comma separated values", () => {
        expect(splitLines("a@example.com\nb@example.com, c@example.com")).toEqual([
            "a@example.com",
            "b@example.com",
            "c@example.com",
        ]);
    });
});
