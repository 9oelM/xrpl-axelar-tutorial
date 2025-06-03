import * as xrpl from "xrpl";
import { AbiCoder, id } from "ethers";
import {
  asHexString,
  dropsToEVMSidechainXRPDecimals,
  hex,
  isHexString,
  withoutHexPrefix,
} from "./utils";
import {
  XRPL_MULTISIG_ADDRESS,
  XRPL_RPC_URL,
} from "./constants";
import yargs from "yargs/yargs";
import fs from "fs";
import axios from "axios";

const abiCoder = AbiCoder.defaultAbiCoder();

async function generateWallet() {
  const algorithm = xrpl.ECDSA.secp256k1;
  const user = xrpl.Wallet.generate(algorithm);

  const client = new xrpl.Client(XRPL_RPC_URL);
  await client.connect();

  console.log(`Generating and funding wallet...`);

  await client.fundWallet(user, { amount: "1000" });

  const walletData = {
    address: user.address,
    secret: user.seed!,
  };

  await client.disconnect();

  return walletData;
}

async function loadWallet() {
  if (!fs.existsSync("wallet.json")) {
    console.error("No wallet found. Please generate a wallet first.");
    return;
  }

  const walletData = JSON.parse(fs.readFileSync("wallet.json", "utf-8"));

  if (!walletData.secret) {
    console.error(
      "No secret found in wallet.json. Please generate a wallet again.",
    );
    return;
  }

  try {
    return xrpl.Wallet.fromSeed(walletData.secret, {
      algorithm: xrpl.ECDSA.secp256k1,
    });
  } catch (e) {
    console.error("Error loading wallet from secret:", e);
    return;
  }
}

async function sendOp(
  client: xrpl.Client,
  user: xrpl.Wallet,
  op: {
    type: "deposit" | "donate";
    amountInXRP: string;
    evmDestination: string;
  },
) {
  const amount = xrpl.xrpToDrops(op.amountInXRP);

  const payloadDataHex = abiCoder.encode(["bytes32"], [id(op.type)]);
  const payload = withoutHexPrefix(payloadDataHex);

  const tx: xrpl.Transaction = {
    TransactionType: "Payment",
    Account: user.address,
    Amount: amount,
    Destination: XRPL_MULTISIG_ADDRESS,
    Memos: [
      {
        Memo: {
          MemoType: hex("type"),
          MemoData: hex("interchain_transfer"),
        },
      },
      {
        Memo: {
          MemoType: hex("destination_address"),
          MemoData: asHexString(withoutHexPrefix(op.evmDestination)),
        },
      },
      {
        Memo: {
          MemoType: hex("destination_chain"),
          MemoData: hex("xrpl-evm"),
        },
      },
      {
        Memo: {
          MemoType: hex("gas_fee_amount"),
          MemoData: hex(xrpl.xrpToDrops(`1`)),
        },
      },
      ...(op.type === "donate"
        ? []
        : [{ Memo: { MemoType: hex("payload"), MemoData: payload } }]),
    ],
  };

  console.log(JSON.stringify(tx, null, 2));

  const prepared = await client.autofill(tx);
  const signed = user.sign(prepared);
  const txRes = await client.submitAndWait(signed.tx_blob);
  return txRes;
}

async function withdraw(xrpAmount: string, xrplAccount: string) {
    try {
        const response = await axios.post('http://localhost:3000/withdraw', {
            sourceAddress: xrplAccount,
            requestedAmount: xrpAmount
        });

        if (response.data.success) {
            console.log(`Withdraw transaction submitted successfully:
- Transaction Hash: ${response.data.transactionHash}
- Block Number: ${response.data.blockNumber}
- Gas Used: ${response.data.gasUsed}`);
        } else {
            console.error('Withdraw request failed:', response.data.error);
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error('Error communicating with withdraw relayer:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
        }
    }
}

async function run(action: string, amount: string, evmDestination: string) {
  const client = new xrpl.Client(XRPL_RPC_URL);
  await client.connect();

  const user = await loadWallet();

  if (!user) {
    await client.disconnect();

    console.error("Error loading wallet.");
    return;
  }

  if (action === "deposit" || action === "donate") {
    const result = await sendOp(client, user, {
      type: action,
      amountInXRP: amount,
      evmDestination,
    });

    await client.disconnect();
    return result;
  } else {
    throw "Invalid action. Please choose deposit, donate, or withdraw.";
  }
}

const argv = yargs(process.argv.slice(2))
  .command("generate", "Generate a new wallet and fund it", {}, async () => {
    try {
      const walletData = await generateWallet();
      fs.writeFileSync("wallet.json", JSON.stringify(walletData, null, 2));
      console.log("Wallet generated and funded. Secret stored in wallet.json.");
      console.log(
        `Check: https://devnet.xrpl.org/accounts/${walletData.address}`,
      );
    } catch (error) {
      console.error("Error generating wallet:", error);
    }
  })
  .command("fund-withdraw-relayer", `Fund withdraw relayer`, (yargs) => {
    return yargs.option("destination", {
      type: "string",
      demandOption: true,
      describe: "EVM destination address to fund the withdraw relayer",
    });
  })
  .command("deposit", "Deposit XRP into the Bank contract", (yargs) => {
    return yargs.option("amount", {
      type: "number",
      demandOption: true,
      describe: "Amount in XRP for deposit. e.g., 0.1 for 0.1 XRP",
    }).option("destination", {
      type: "string",
      demandOption: true,
      describe: "EVM destination address to deposit to",
    });
  })
  .command("withdraw", "Withdraw from the Bank contract", (yargs) => {
    return yargs.option("amount", {
      type: "number",
      demandOption: true,
      describe: "Amount in XRP for withdrawal. e.g., 0.1 for 0.1 XRP",
    }).option("account", {
      type: "string",
      describe: "XRPL account address to withdraw to. Defaults to the address in ./wallet.json. e.g., rEcqMLjKftZWTyYpGzj1jQkBefsMWcxENP",
    });
  })
  .help().argv;

async function cli() {
  const parsed = await argv;

  if (parsed._.length === 0) {
    console.log(`No command provided. Use --help for usage.`);
    return;
  }
  
  switch (parsed._[0]) {
    case 'deposit': {
        const evmDestination = parsed.destination as string;

        if (!isHexString(withoutHexPrefix(evmDestination))) {
            console.error("Invalid EVM destination address: ", evmDestination);
            return;
        }

        const xrpAmount = parsed.amount as string;

        console.log(`Preparing deposit tx...`);

        const result = await run(`deposit`, xrpAmount, evmDestination);

        if (!result) {
            console.error("Error executing transaction.");
            return;
        }

        if (!result.result.meta || typeof result.result.meta === "string") {
            console.error("Error getting transaction metadata.");
            return;
        }

        if (result.result.meta.TransactionResult !== "tesSUCCESS") {
            console.error(
                "Transaction failed:",
                result.result.meta.TransactionResult,
            );
            return;
        }

        console.log(`Transaction successful. Check: 
- XRPL: https://testnet.xrpl.org/transactions/${result.result.hash}
- Axelar: https://testnet.axelarscan.io/gmp/${result.result.hash}`);
        break;
    }
    case 'fund-withdraw-relayer': {
        const evmDestination = parsed.destination as string;

        if (!isHexString(withoutHexPrefix(evmDestination))) {
            console.error("Invalid EVM destination address: ", evmDestination);
            return;
        }

        console.log(`Funding withdraw relayer...`);

        const result = await run("donate", `50`, evmDestination);

        if (!result) {
            console.error("Error executing transaction.");
            return;
        }

        if (!result.result.meta || typeof result.result.meta === "string") {
            console.error("Error getting transaction metadata.");
            return;
        }

        if (result.result.meta.TransactionResult !== "tesSUCCESS") {
            console.error(
                "Transaction failed:",
                result.result.meta.TransactionResult,
            );
            return;
        }

        console.log(`Transaction successful. Check:
- XRPL: https://testnet.xrpl.org/transactions/${result.result.hash}
- Axelar: https://testnet.axelarscan.io/gmp/${result.result.hash}`);
        break;
    }
    case 'withdraw': {
        let xrplAccount = parsed.account as string;
        const xrpAmount = parsed.amount as string;

        if (!xrpAmount) {
            console.error("Amount is required");
            return;
        }

        if (!xrplAccount) {
            console.log("No account specified, using wallet from wallet.json...");
            const wallet = await loadWallet();
            if (!wallet) {
                console.error("No wallet found in wallet.json. Please generate a wallet first or specify an account.");
                return;
            }
            xrplAccount = wallet.address;
            console.log(`Using account: ${xrplAccount}`);
        }

        console.log(`Preparing withdraw request...`);
        await withdraw(xrpAmount, xrplAccount);
        break;
    }
    default:
        console.error("Unknown command:", parsed._[0]);
        break;
  }
}

cli();
