import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../app/page";

describe("HomePage", () => {
  it("renders the ForeTrade title", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /foretrade/i })).toBeInTheDocument();
  });
});
