import { hashPassword, verifyPassword } from "../security/password";
import { passwordSchema } from "../schemas/auth";

describe("password hashing", () => {
  it("hashes and verifies correctly", async () => {
    const hash = await hashPassword("Sup3rSecretPassphrase!");
    expect(hash).not.toContain("Sup3rSecretPassphrase");
    expect(await verifyPassword(hash, "Sup3rSecretPassphrase!")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Sup3rSecretPassphrase!");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("fails closed on a malformed hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(
      false,
    );
  });
});

describe("password policy schema", () => {
  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("Short1").success).toBe(false);
  });

  it("rejects passwords missing character variety", () => {
    expect(passwordSchema.safeParse("alllowercase12").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE12").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigitsHereAtAll").success).toBe(false);
  });

  it("accepts a compliant password", () => {
    expect(passwordSchema.safeParse("ValidPassphrase123").success).toBe(true);
  });
});
