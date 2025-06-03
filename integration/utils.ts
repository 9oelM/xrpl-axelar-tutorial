export const hex = (str: string): string => Buffer.from(str).toString("hex");
export const isHexString = (str: string): boolean => /^[a-fA-F0-9]+$/.test(str);

export type HexString = string & { readonly __hexString__: unique symbol };
export const asHexString = (str: string): HexString => {
  if (!isHexString(str)) {
    throw new Error(`Invalid hex string: ${str}`);
  }

  return str as HexString;
};
export const withoutHexPrefix = (hexStr: string): HexString =>
  asHexString(hexStr.startsWith(`0x`) ? hexStr.slice(2) : hexStr);

