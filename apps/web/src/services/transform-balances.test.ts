/**
 * Unit tests for transform-balances service
 */

import { extractBalances } from "./transform-balances";
import type { AccountInfo } from "./types";

describe("extractBalances", () => {
  it("should extract native XLM balance", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [
        {
          balance: "100.5000000",
          assetType: "native",
        },
      ],
    };

    const result = extractBalances(accountInfo);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      assetCode: "XLM",
      assetIssuer: undefined,
      balance: "100.5000000",
      iconUrl: "https://stellar.expert/explorer/public/asset/XLM",
    });
  });

  it("should extract custom token balance", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [
        {
          balance: "50.2500000",
          assetType: "credit_alphanum4",
          assetCode: "USDC",
          assetIssuer:
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      ],
    };

    const result = extractBalances(accountInfo);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      balance: "50.2500000",
      iconUrl:
        "https://stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });
  });

  it("should extract both native XLM and custom tokens", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [
        {
          balance: "100.5000000",
          assetType: "native",
        },
        {
          balance: "50.2500000",
          assetType: "credit_alphanum4",
          assetCode: "USDC",
          assetIssuer:
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        {
          balance: "25.1234567",
          assetType: "credit_alphanum12",
          assetCode: "LONGASSETNAME",
          assetIssuer: "GBTEST456",
        },
      ],
    };

    const result = extractBalances(accountInfo);

    expect(result).toHaveLength(3);

    // Verify XLM
    expect(result[0]).toEqual({
      assetCode: "XLM",
      assetIssuer: undefined,
      balance: "100.5000000",
      iconUrl: "https://stellar.expert/explorer/public/asset/XLM",
    });

    // Verify USDC
    expect(result[1]).toEqual({
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      balance: "50.2500000",
      iconUrl:
        "https://stellar.expert/explorer/public/asset/USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    });

    // Verify LONGASSETNAME
    expect(result[2]).toEqual({
      assetCode: "LONGASSETNAME",
      assetIssuer: "GBTEST456",
      balance: "25.1234567",
      iconUrl:
        "https://stellar.expert/explorer/public/asset/LONGASSETNAME-GBTEST456",
    });
  });

  it("should handle empty balance array", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [],
    };

    const result = extractBalances(accountInfo);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it("should handle account with only custom tokens (no XLM)", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [
        {
          balance: "50.2500000",
          assetType: "credit_alphanum4",
          assetCode: "USDC",
          assetIssuer:
            "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
        {
          balance: "75.0000000",
          assetType: "credit_alphanum4",
          assetCode: "EURC",
          assetIssuer: "GBTEST789",
        },
      ],
    };

    const result = extractBalances(accountInfo);

    expect(result).toHaveLength(2);
    expect(result[0].assetCode).toBe("USDC");
    expect(result[1].assetCode).toBe("EURC");
    // Verify no XLM in results
    expect(result.find((b) => b.assetCode === "XLM")).toBeUndefined();
  });

  it("should preserve exact balance strings without modification", () => {
    const accountInfo: AccountInfo = {
      accountId: "GTEST123",
      sequence: "123456",
      balances: [
        {
          balance: "0.0000001",
          assetType: "native",
        },
        {
          balance: "999999999.9999999",
          assetType: "credit_alphanum4",
          assetCode: "TEST",
          assetIssuer: "GTEST",
        },
      ],
    };

    const result = extractBalances(accountInfo);

    expect(result[0].balance).toBe("0.0000001");
    expect(result[1].balance).toBe("999999999.9999999");
  });
});
