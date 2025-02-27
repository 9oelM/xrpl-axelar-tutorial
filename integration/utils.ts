export const hex = (str: string): string => Buffer.from(str).toString("hex");
export const isHexString = (str: string): boolean => /^[a-fA-F0-9]+$/.test(str);

export type HexString = string & { readonly __hexString__: unique symbol };
export const asHexString = (str: string): HexString => {
  if (!isHexString(str)) {
    throw new Error(`Invalid hex string: ${str}`);
  }

  return str as HexString;
};
export const withoutHexPrefix = (hexStr: string): HexString => asHexString(hexStr.startsWith(`0x`) ? hexStr.slice(2) : hexStr);

export const dropsToEVMSidechainXRPDecimals = (drops: bigint) => {
  // 0.000001 XRP = 1 drop = 1000000000000 on EVM Sidechain
  // https://explorer.xrplevm.org/tx/0xfc3e47b3de64fa56d805957b7fe5d26cad5a0ce2fef1c781cc3c98e8f3a0d6d5?tab=logs
  return drops * 1000000000000n;
}
