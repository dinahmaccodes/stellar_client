/**
 * Transform Balances Service
 *
 * This module provides functions for transforming Horizon API account responses
 * into the internal TokenBalanceData format used by the token balance display components.
 *
 * @see .kiro/specs/token-balance-display/design.md
 */

import type { AccountInfo } from "./types";
import type { TokenBalanceData } from "../types/token-balance.types";
import { getTokenIconUrl } from "../utils/get-token-icon-url";

/**
 * Extracts and transforms token balances from a Horizon API account response
 *
 * This function processes the account balances array and converts each balance
 * into the TokenBalanceData format, including:
 * - Native XLM balances (asset_type: "native")
 * - Custom token balances (asset_type: "credit_alphanum4" or "credit_alphanum12")
 *
 * Each balance is enriched with:
 * - Normalized asset code (e.g., "XLM" for native)
 * - Asset issuer (undefined for native XLM)
 * - Icon URL from Stellar Expert
 *
 * @param accountInfo - Account information from StellarService.getAccount()
 * @returns Array of TokenBalanceData objects, one for each balance in the account
 *
 * @example
 * const accountInfo = await stellarService.getAccount(address);
 * const balances = extractBalances(accountInfo);
 * // balances = [
 * //   { assetCode: "XLM", balance: "100.5", iconUrl: "...", assetIssuer: undefined },
 * //   { assetCode: "USDC", balance: "50.25", iconUrl: "...", assetIssuer: "GA..." }
 * // ]
 *
 * **Validates: Requirements 1.2, 1.4**
 */
export function extractBalances(accountInfo: AccountInfo): TokenBalanceData[] {
  return accountInfo.balances.map((balance) => {
    // Determine asset code
    // For native XLM, assetCode is undefined in the API response, so we use "XLM"
    const assetCode = balance.assetCode || "XLM";

    // Asset issuer is undefined for native XLM
    const assetIssuer = balance.assetIssuer;

    // Construct icon URL using the utility function
    const iconUrl = getTokenIconUrl(assetCode, assetIssuer);

    return {
      assetCode,
      assetIssuer,
      balance: balance.balance,
      iconUrl,
    };
  });
}
