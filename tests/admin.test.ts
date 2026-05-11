import { describe, it, expect, beforeEach } from "vitest";
import { isAdminAuthorized } from "@/lib/admin";

describe("isAdminAuthorized", () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = "secret-key";
  });

  it("accepts the correct Bearer token", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer secret-key" } });
    expect(isAdminAuthorized(req)).toBe(true);
  });

  it("rejects a wrong token", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer wrong" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects a missing header", () => {
    const req = new Request("http://x");
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects a non-Bearer scheme", () => {
    const req = new Request("http://x", { headers: { Authorization: "Basic secret-key" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("uses constant-time comparison", () => {
    process.env.ADMIN_KEY = "a";
    const req = new Request("http://x", { headers: { Authorization: "Bearer ab" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects double-space between Bearer and token", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer  secret-key" } });
    expect(isAdminAuthorized(req)).toBe(false);
  });

  it("rejects an empty token after Bearer", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer " } });
    expect(isAdminAuthorized(req)).toBe(false);
  });
});
