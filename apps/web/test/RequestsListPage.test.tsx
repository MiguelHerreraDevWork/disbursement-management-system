import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestsListPage } from "../src/routes/RequestsListPage";

describe("RequestsListPage", () => {
  it("renders the page heading", () => {
    render(<RequestsListPage />);

    expect(screen.getByRole("heading", { name: /disbursement requests/i })).toBeInTheDocument();
  });
});
