import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("attendance entry navigation", () => {
  const topActions = readFileSync(new URL("./CalendarTopActions.tsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8");

  test("lives in Calendar Tools instead of the desktop Sidebar", () => {
    expect(topActions).toContain('href="/attendance-grid"');
    expect(topActions).toContain('useTranslations("attendanceGrid")');
    expect(sidebar).not.toContain('href="/attendance-grid"');
  });
});
