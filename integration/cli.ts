import * as xrpl from "xrpl";
import { AbiCoder, id } from "ethers";
import { asHexString, hex, withoutHexPrefix } from "./utils";
import { EVM_DESTINATION, XRPL_MULTISIG_ADDRESS, XRPL_RPC_URL } from "./constants";
import yargs from "yargs/yargs";
import fs from "fs";

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

  fs.writeFileSync("wallet.json", JSON.stringify(walletData, null, 2));
  console.log("Wallet generated and funded. Secret stored in wallet.json.");
  console.log(`Check: https://devnet.xrpl.org/accounts/${walletData.address}`);

  await client.disconnect();
}

async function loadWallet() {
  if (!fs.existsSync("wallet.json")) {
    console.error("No wallet found. Please generate a wallet first.");
    return;
  }

  const walletData = JSON.parse(fs.readFileSync("wallet.json", "utf-8"));

  if (!walletData.secret) {
    console.error("No secret found in wallet.json. Please generate a wallet again.");
    return;
  }

  try {
    return xrpl.Wallet.fromSeed(walletData.secret, {
      algorithm: xrpl.ECDSA.secp256k1
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
    type: "deposit" | "donate"
    amountInDrops: bigint
  } | {
    type: "withdraw"
    requestedAmountInDrops: bigint
  }
) {
  const amount = op.type === `withdraw` ? "1" : op.amountInDrops.toString();
  const requestedAmount = op.type === `withdraw` ? op.requestedAmountInDrops : 0;
  
  const payloadDataHex = abiCoder.encode(
    ["bytes32", "uint256"],
    [id(op.type), requestedAmount]
  );
  const payload = withoutHexPrefix(payloadDataHex);

  const depositTx: xrpl.Transaction = {
    TransactionType: "Payment",
    Account: user.address,
    Amount: amount,
    Destination: XRPL_MULTISIG_ADDRESS,
    Memos: [
      { Memo: { MemoType: hex("destination_address"), MemoData: asHexString(EVM_DESTINATION) } },
      { Memo: { MemoType: hex("destination_chain"), MemoData: hex("xrpl-evm-devnet") } },
      { Memo: { MemoType: hex("gas_fee_amount"), MemoData: "00" } },
      { Memo: { MemoType: hex("payload"), MemoData: payload } }
    ],
  };

  const prepared = await client.autofill(depositTx);
  const signed = user.sign(prepared);
  const txRes = await client.submitAndWait(signed.tx_blob);
  return txRes;
}

async function run(action: string, amount: bigint) {
  const client = new xrpl.Client(XRPL_RPC_URL);
  await client.connect();

  const user = await loadWallet();

  if (!user) {
    await client.disconnect();

    console.error("Error loading wallet.");
    return;
  }

  if (action === "withdraw") {
    const result = await sendOp(client, user, { type: "withdraw", requestedAmountInDrops: amount });

    await client.disconnect();
    return  result;
  } else if (action === "deposit" || action === "donate") {
    const result = await sendOp(client, user, { type: action, amountInDrops: amount });

    await client.disconnect();
    return result;
  } else {
    throw("Invalid action. Please choose deposit, donate, or withdraw.");
  }
}

const argv = yargs(process.argv.slice(2))
  .command('generate', 'Generate a new wallet and fund it', {}, () => {
    generateWallet().catch(console.error);
  })
  .command('execute', 'Execute a transaction', (yargs) => {
    return yargs
      .option("action", {
        alias: "a",
        type: "string",
        demandOption: true,
        describe: "Action to perform: deposit, donate, or withdraw"
      })
      .option("amount", {
        type: "number",
        demandOption: true,
        describe: "Amount in drops for deposit, donate, or withdraw",
      })
  })
  .help()
  .argv;

async function cli() {
  const parsed = await argv;

  if (parsed._.length === 0) {
    console.log(`No command provided. Use --help for usage.`);
    return;
  }

  if (parsed._[0] === `execute`) {
    const action = parsed.action as string;
    
    console.log(`Preparing ${action}...`)

    const result = await run(action, BigInt(parsed.amount as number));

    if (!result) {
      console.error("Error executing transaction.");
      return
    }

    if (!result.result.meta || typeof result.result.meta === "string") {
      console.error("Error getting transaction metadata.");
      return
    }

    if (result.result.meta.TransactionResult !== "tesSUCCESS") {
      console.error("Transaction failed:", result.result.meta.TransactionResult);
      return
    }

    console.log(`Transaction successful. Check: 
- XRPL: https://devnet.xrpl.org/transactions/${result.result.hash}
- Axelar: https://devnet-amplifier.axelarscan.io/gmp/${result.result.hash}`);
  }
}

cli();
