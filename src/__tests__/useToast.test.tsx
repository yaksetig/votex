/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { toast, useToast } from "@/hooks/use-toast";

function visibleTitles(toasts: ReturnType<typeof useToast>["toasts"]) {
  return toasts.filter((t) => t.open).map((t) => String(t.title));
}

describe("toast store", () => {
  afterEach(() => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.dismiss());
  });

  it("keeps destructive toasts until dismissed and lets callers override", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ variant: "destructive", title: "Vote failed" });
      toast({ variant: "destructive", title: "Short", duration: 3000 });
    });
    const byTitle = Object.fromEntries(result.current.toasts.map((t) => [String(t.title), t.duration]));
    expect(byTitle["Vote failed"]).toBe(Infinity);
    expect(byTitle.Short).toBe(3000);
  });

  it("replaces an earlier toast that shares the same key", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ key: "vote", variant: "destructive", title: "Vote failed" });
    });
    expect(visibleTitles(result.current.toasts)).toEqual(["Vote failed"]);
    act(() => {
      toast({ key: "vote", title: "Ballot recorded" });
    });
    expect(visibleTitles(result.current.toasts)).toEqual(["Ballot recorded"]);
  });

  it("shows at most two toasts at once", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "One" });
      toast({ title: "Two" });
      toast({ title: "Three" });
    });
    expect(visibleTitles(result.current.toasts)).toEqual(["Three", "Two"]);
  });
});
