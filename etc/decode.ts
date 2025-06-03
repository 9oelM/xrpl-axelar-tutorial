const a = [
  {
    Memo: {
      MemoType: "74797065",
      MemoData: "696e746572636861696e5f7472616e73666572",
    },
  },
  {
    Memo: {
      MemoType: "64657374696e6174696f6e5f61646472657373",
      MemoData: "86283a5fEF518F0C18c99eCAB3D74697c886C099",
    },
  },
  {
    Memo: {
      MemoType: "64657374696e6174696f6e5f636861696e",
      MemoData: "7872706c2d65766d",
    },
  },
  {
    Memo: {
      MemoType: "6761735f6665655f616d6f756e74",
      MemoData: "31303030303030",
    },
  },
];

const b = [
  {
    Memo: {
      MemoData: "696E746572636861696E5F7472616E73666572",
      MemoType: "74797065",
    },
  },
  {
    Memo: {
      MemoData:
        "33346563633461363835303734353932616565666330356362303630366137653266323966306430",
      MemoType: "64657374696E6174696F6E5F61646472657373",
    },
  },
  {
    Memo: {
      MemoData: "7872706C2D65766D",
      MemoType: "64657374696E6174696F6E5F636861696E",
    },
  },
  {
    Memo: {
      MemoData: "31373030303030",
      MemoType: "6761735F6665655F616D6F756E74",
    },
  },
];

const hexToHuman = (hex: string) => {
  return Buffer.from(hex, "hex").toString("utf-8");
};

console.log(a.map((memo) => hexToHuman(memo.Memo.MemoData)));
console.log(b.map((memo) => hexToHuman(memo.Memo.MemoData)));
