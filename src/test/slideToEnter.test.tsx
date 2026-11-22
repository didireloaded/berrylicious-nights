import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SlideToEnter, type SlideToEnterHandle } from "@/components/SlideToEnter";

describe("SlideToEnter", () => {
  it("renders accessible slider semantics with default Slide to Enter label", () => {
    const onComplete = vi.fn();
    render(<SlideToEnter onComplete={onComplete} />);

    const slider = screen.getByRole("slider", { name: /slide to enter/i });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Slide to Enter")).toBeInTheDocument();
  });

  it("completes once on keyboard Enter or ArrowRight", () => {
    const onComplete = vi.fn();
    render(<SlideToEnter onComplete={onComplete} completedLabel="Opening Butcher Block…" />);

    const slider = screen.getByRole("slider", { name: /slide to enter/i });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Opening Butcher Block…")).toBeInTheDocument();

    // Subsequent key presses do not double-trigger
    fireEvent.keyDown(slider, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("supports programmatic slide completion via ref handle and respects disabled", () => {
    const onComplete = vi.fn();
    const ref = createRef<SlideToEnterHandle>();
    render(<SlideToEnter ref={ref} onComplete={onComplete} />);

    act(() => {
      ref.current?.triggerSlideComplete();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "100");
  });

  it("ignores keyboard triggers when disabled", () => {
    const onComplete = vi.fn();
    render(<SlideToEnter disabled onComplete={onComplete} />);

    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Enter" });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
