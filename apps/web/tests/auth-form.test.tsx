import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuthForm } from "../components/auth/auth-form";
describe("AuthForm",()=>{it("submits an email/password registration request",async()=>{const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response());render(<AuthForm mode="register"/>);fireEvent.change(screen.getByLabelText(/email/i),{target:{value:"exporter@example.com"}});fireEvent.change(screen.getByLabelText(/^password/i),{target:{value:"correct horse battery staple"}});fireEvent.click(screen.getByRole("button",{name:/create account/i}));expect(fetchMock).toHaveBeenCalled();fetchMock.mockRestore()})})
