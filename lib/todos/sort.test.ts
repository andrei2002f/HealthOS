import { describe, it, expect } from "vitest";
import { compareTodos, isOverdue, sortTodos, type SortableTodo } from "./sort";

const TODAY = "2026-06-22";

function todo(partial: Partial<SortableTodo>): SortableTodo {
  return {
    dueDate: null,
    priority: "medium",
    completedAt: null,
    createdAt: "2026-06-01T10:00:00Z",
    ...partial,
  };
}

describe("isOverdue", () => {
  it("is true for an active task due before today", () => {
    expect(isOverdue(todo({ dueDate: "2026-06-21" }), TODAY)).toBe(true);
  });

  it("is false for a task due today", () => {
    expect(isOverdue(todo({ dueDate: TODAY }), TODAY)).toBe(false);
  });

  it("is false without a due date", () => {
    expect(isOverdue(todo({ dueDate: null }), TODAY)).toBe(false);
  });

  it("is false for a completed task even if past due", () => {
    expect(
      isOverdue(
        todo({ dueDate: "2026-06-01", completedAt: "2026-06-02T00:00:00Z" }),
        TODAY,
      ),
    ).toBe(false);
  });
});

describe("compareTodos", () => {
  it("puts active before completed", () => {
    const active = todo({});
    const done = todo({ completedAt: "2026-06-20T00:00:00Z" });
    expect(compareTodos(active, done, TODAY)).toBeLessThan(0);
    expect(compareTodos(done, active, TODAY)).toBeGreaterThan(0);
  });

  it("puts overdue before non-overdue active tasks", () => {
    const overdue = todo({ dueDate: "2026-06-20", priority: "low" });
    const upcoming = todo({ dueDate: "2026-06-30", priority: "high" });
    expect(compareTodos(overdue, upcoming, TODAY)).toBeLessThan(0);
  });

  it("orders by priority when overdue status is equal", () => {
    const high = todo({ priority: "high" });
    const low = todo({ priority: "low" });
    expect(compareTodos(high, low, TODAY)).toBeLessThan(0);
  });

  it("orders by due date ascending with nulls last at equal priority", () => {
    const soon = todo({ dueDate: "2026-06-25" });
    const noDate = todo({ dueDate: null });
    expect(compareTodos(soon, noDate, TODAY)).toBeLessThan(0);
  });

  it("orders completed tasks most-recently-completed first", () => {
    const older = todo({ completedAt: "2026-06-10T00:00:00Z" });
    const newer = todo({ completedAt: "2026-06-20T00:00:00Z" });
    expect(compareTodos(newer, older, TODAY)).toBeLessThan(0);
  });
});

describe("sortTodos", () => {
  it("produces overdue → priority → completed ordering", () => {
    const overdue = todo({ dueDate: "2026-06-20", priority: "low" });
    const highActive = todo({ priority: "high" });
    const lowActive = todo({ priority: "low" });
    const done = todo({ completedAt: "2026-06-21T00:00:00Z" });

    const sorted = sortTodos([done, lowActive, highActive, overdue], TODAY);
    expect(sorted).toEqual([overdue, highActive, lowActive, done]);
  });
});
