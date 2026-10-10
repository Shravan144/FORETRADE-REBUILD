import { describe, it, expect } from "vitest";

describe("Two-Tower Matchmaking Swipe Physics & State", () => {
  it("calculates correct drag rotation and threshold triggers", () => {
    const calculateRotation = (deltaX: number) => deltaX * 0.05;
    expect(calculateRotation(100)).toBe(5);
    expect(calculateRotation(-100)).toBe(-5);
    expect(calculateRotation(0)).toBe(0);
  });

  it("calculates correct dynamic action stamp opacities", () => {
    const getAcceptOpacity = (deltaX: number) => Math.min(1, Math.max(0, (deltaX - 20) / 75));
    const getPassOpacity = (deltaX: number) => Math.min(1, Math.max(0, (-deltaX - 20) / 75));
    const getBookmarkOpacity = (deltaY: number) => Math.min(1, Math.max(0, (-deltaY - 20) / 60));

    // Under threshold
    expect(getAcceptOpacity(10)).toBe(0);
    expect(getPassOpacity(-10)).toBe(0);
    expect(getBookmarkOpacity(-10)).toBe(0);

    // Half threshold
    expect(getAcceptOpacity(57.5)).toBeCloseTo(0.5, 1);
    expect(getPassOpacity(-57.5)).toBeCloseTo(0.5, 1);

    // Full threshold
    expect(getAcceptOpacity(120)).toBe(1);
    expect(getPassOpacity(-120)).toBe(1);
    expect(getBookmarkOpacity(-90)).toBe(1);
  });

  it("maintains consistent undo stack FIFO order and decrements stats", () => {
    interface HistoryItem {
      buyerId: string;
      decision: "accept" | "pass" | "bookmark";
    }

    let stack: HistoryItem[] = [];
    const stats = { saved: 0, passed: 0, bookmarked: 0 };

    // Swipe 1: right (accept)
    stack = [{ buyerId: "buyer-1", decision: "accept" }, ...stack];
    stats.saved += 1;

    // Swipe 2: up (bookmark)
    stack = [{ buyerId: "buyer-2", decision: "bookmark" }, ...stack];
    stats.bookmarked += 1;

    expect(stack.length).toBe(2);
    expect(stack[0].buyerId).toBe("buyer-2");
    expect(stats.saved).toBe(1);
    expect(stats.bookmarked).toBe(1);

    // Undo Swipe 2
    const [lastItem, ...remaining] = stack;
    stack = remaining;
    if (lastItem.decision === "bookmark") stats.bookmarked -= 1;

    expect(stack.length).toBe(1);
    expect(stack[0].buyerId).toBe("buyer-1");
    expect(stats.bookmarked).toBe(0);
    expect(stats.saved).toBe(1);
  });

  it("evaluates tier classification correctly based on composite compatibility score", () => {
    const getTier = (score: number) => {
      if (score >= 85) return "Strong Match";
      if (score >= 70) return "Good Fit";
      if (score >= 55) return "Potential Prospect";
      return "Low Fit";
    };

    expect(getTier(92.4)).toBe("Strong Match");
    expect(getTier(78.1)).toBe("Good Fit");
    expect(getTier(64.0)).toBe("Potential Prospect");
    expect(getTier(42.5)).toBe("Low Fit");
  });
});
