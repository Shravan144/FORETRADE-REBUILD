import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuthForm } from "../components/auth/auth-form";

describe("AuthForm", () => {
  it("submits an email/password registration request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", email: "exporter@example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<AuthForm mode="register" />);

    const fullNameInput = screen.getByLabelText(/full name/i);
    fireEvent.change(fullNameInput, { target: { value: "Test Exporter" } });

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "exporter@example.com" } });

    const passwordInput = screen.getByLabelText(/^password/i);
    fireEvent.change(passwordInput, { target: { value: "correct horse battery staple" } });

    const submitBtn = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(submitBtn);

    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
