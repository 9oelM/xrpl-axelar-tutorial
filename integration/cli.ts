import * as xrpl from "xrpl";
import { AbiCoder, id } from "ethers";
import {
  asHexString,
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
import dotenv from 'dotenv';
import path from 'path';
import { sign } from "ripple-keypairs"

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Type-safe configuration
interface Config {
  rpcUrl: string;
  bankAddress: string;
}

function getConfig(): Config {
  const rpcUrl = process.env.WITHDRAW_RELAYER_RPC_URL;
  const bankAddress = process.env.EVM_BANK_ADDRESS;

  if (!rpcUrl) throw new Error('WITHDRAW_RELAYER_RPC_URL environment variable is required');
  if (!bankAddress) throw new Error('EVM_BANK_ADDRESS environment variable is required');

  return {
      rpcUrl,
      bankAddress,
  };
}

const config = getConfig();

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
          MemoData: hex(asHexString(withoutHexPrefix(op.evmDestination))),
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

async function withdraw(xrpAmount: string) {
    try {
        // Load wallet to sign the request
        const wallet = await loadWallet();
        if (!wallet) {
            console.error("No wallet found in wallet.json. Please generate a wallet first.");
            return;
        }

        // Create payload to sign
        const payload = {
            withdrawAccount: wallet.address,
            requestedAmount: xrpAmount,
            timestamp: Date.now()
        };

        // Sign the payload
        const message = JSON.stringify(payload);
        const signature = sign(message, wallet.privateKey);

        const response = await axios.post('http://localhost:3000/withdraw', {
            ...payload,
            signature,
            signer: wallet.address
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

  if (action === "deposit") {
    const result = await sendOp(client, user, {
      type: action,
      amountInXRP: amount,
      evmDestination,
    });

    await client.disconnect();
    return result;
  } else if (action === "donate") {
    const wallet = await generateWallet();
    const fundedUser = xrpl.Wallet.fromSeed(wallet.secret, {
      algorithm: xrpl.ECDSA.secp256k1,
    });
    const result = await sendOp(client, fundedUser, {
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
    
  })
  .command("fund-evm-address", `Fund any EVM address on EVM sidechain`, (yargs) => {
    return yargs.option("destination", {
      type: "string",
      demandOption: true,
      describe: "EVM destination address to fund",
    });
  })
  .command("deposit", "Deposit XRP into the Bank contract", (yargs) => {
    return yargs.option("amount", {
      type: "number",
      demandOption: true,
      describe: "Amount in XRP for deposit. e.g., 0.1 for 0.1 XRP",
    })
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
        const evmDestination = config.bankAddress;

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

        console.log(`Transaction pending. Check: 
- XRPL: https://testnet.xrpl.org/transactions/${result.result.hash}
- Axelar: https://testnet.axelarscan.io/gmp/${result.result.hash}`);
        break;
    }
    case 'fund-evm-address': {
        const evmDestination = parsed.destination as string;

        if (!isHexString(withoutHexPrefix(evmDestination))) {
            console.error("Invalid EVM destination address: ", evmDestination);
            return;
        }

        console.log(`Funding an EVM address...`);

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

        console.log(`Transaction pending. Check:
- XRPL: https://testnet.xrpl.org/transactions/${result.result.hash}
- Axelar: https://testnet.axelarscan.io/gmp/${result.result.hash}`);
        break;
    }
    case 'withdraw': {
        const xrpAmount = parsed.amount as string;

        if (!xrpAmount) {
            console.error("Amount is required");
            return;
        }

        console.log(`Preparing withdraw request...`);
        await withdraw(xrpAmount);
        break;
    }
    case 'generate': {
      try {
        const walletData = await generateWallet();
        fs.writeFileSync("wallet.json", JSON.stringify(walletData, null, 2));
        console.log("Wallet generated and funded. Secret stored in wallet.json.");
        console.log(
          `Check: https://testnet.xrpl.org/accounts/${walletData.address}`,
        );
      } catch (error) {
        console.error("Error generating wallet:", error);
      }   
      break;
    }
    default:
        console.error("Unknown command:", parsed._[0]);
        break;
  }
}

cli();
