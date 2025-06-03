# xrpl-axelar-tutorial

This is a tutorial for using depositing into and withdrawing from a contract on EVM Sidechain by initiating a transaction from XRPL.

## Prerequisites

1. Install [foundry](https://book.getfoundry.sh/getting-started/installation).
1. Install [node.js and npm](https://nodejs.org/en).
1. `forge install`
1. `cd integration && npm i`.
1. `cd withdraw-relayer && npm i`.

## Quickstart workflow

1. Generate EVM wallet address using `cast` installed by `foundryup`.

   ```bash
   cast wallet new

   Successfully created new keypair.
   Address:     0xMY_ADDRESS
   Private key: 0xMY_PRIVATE_KEY
   ```

1. Initialize `.env`:

   ```bash
   cp .env.example .env
   ```

   Get `0xMY_ADDRESS` and `0xMY_PRIVATE_KEY` from the previous step. It will have to look like this:

   ```bash
   DEPLOYER_PRIVATE_KEY=0xMY_PRIVATE_KEY
   EVM_BANK_ADDRESS=leave it empty for now
   WITHDRAW_RELAYER_RPC_URL=https://rpc.testnet.xrplevm.org
   WITHDRAW_RELAYER_ADDRESS=0xMY_ADDRESS
   WITHDRAW_RELAYER_PRIVATE_KEY=0xMY_PRIVATE_KEY
   ```

   Note that `DEPLOYER_PRIVATE_KEY` and `WITHDRAW_RELAYER_PRIVATE_KEY` can be the same.

1. Fund `0xMY_ADDRESS` by using `fund-evm-address` command:

   ```bash
   # run from project root
   npm run fund-evm-address -- --destination 0xMY_ADDRESS

   ...

   Transaction pending. Check:
   - XRPL: https://testnet.xrpl.org/transactions/...
   - Axelar: https://testnet.axelarscan.io/gmp/...
   ```

1. Deploy the Bank contract and get the deployed contract address:

   ```
   ./deploy.sh

   [⠊] Compiling...
   No files changed, compilation skipped
   Script ran successfully.

   ## Setting up 1 EVM.

   ==========================

   Chain 1449000

   Estimated gas price: 400.001 gwei

   Estimated total gas used for script: 1266938

   Estimated amount required: 0.506776466938 ETH

   ==========================
   ⠂ Sequence #1 on 1449000 | Waiting for pending transactions
       ⠐ [Pending] 0x4ff4bba700b33bde95f33203c1d7171da80c0bd58ec66b31625418a8b2847325

   ##### 1449000
   ✅  [Success] Hash: 0x4ff4bba700b33bde95f33203c1d7171da80c0bd58ec66b31625418a8b2847325
   Contract Address: 0xA8a1dC94318F16f50489A19FEBd2D2082360C52f
   Block: 1604588
   Paid: 0.19485497427 ETH (974270 gas * 200.001 gwei)

   ✅ Sequence #1 on 1449000 | Total Paid: 0.19485497427 ETH (974270 gas * avg 200.001 gwei)


   ==========================

   ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
   ##
   Start verification for (1) contracts
   Start verifying contract `0xA8a1dC94318F16f50489A19FEBd2D2082360C52f` deployed on 1449000
   EVM version: cancun
   Compiler version: 0.8.21
   Constructor args: 000000000000000000000000b5fb4be02232b1bba4dc8f81dc24c26980de9e3c00000000000000000000000007c58b4fd9e412847a52446cdf784d78b8abd219

   Submitting verification for [src/Bank.sol:Bank] 0xA8a1dC94318F16f50489A19FEBd2D2082360C52f.
   Submitted contract for verification:
           Response: `OK`
           GUID: `a8a1dc94318f16f50489a19febd2d2082360c52f683f02a2`
           URL: https://explorer.testnet.xrplevm.org/address/0xa8a1dc94318f16f50489a19febd2d2082360c52f
   Contract verification status:
   Response: `OK`
   Details: `Pending in queue`
   Warning: Verification is still pending...; waiting 15 seconds before trying again (7 tries remaining)
   Contract verification status:
   Response: `OK`
   Details: `Pass - Verified`
   Contract successfully verified
   All (1) contracts were verified!
   ```

1. Fill `EVM_BANK_ADDRESS` as the deployed contract address obtained from the previous step.

   ```bash
   DEPLOYER_PRIVATE_KEY=0xMY_PRIVATE_KEY
   EVM_BANK_ADDRESS=0xA8a1dC94318F16f50489A19FEBd2D2082360C52f # get it from the previous step
   WITHDRAW_RELAYER_RPC_URL=https://rpc.testnet.xrplevm.org
   WITHDRAW_RELAYER_ADDRESS=0xMY_ADDRESS
   WITHDRAW_RELAYER_PRIVATE_KEY=0xMY_PRIVATE_KEY
   ```

1. Generate an XRPL wallet for testing

   ```bash
   # run from project root
   npm run generate-wallet
   ```

1. Send cross-chain deposit transaction

   ```bash
   # run from project root
   # deposit 1.13 XRP
   npm run deposit -- --amount 1.13

   ...

   Transaction pending. Check:
   - XRPL: https://testnet.xrpl.org/transactions/...
   - Axelar: https://testnet.axelarscan.io/gmp/...
   ```

1. Launch withdraw relayer server

   ```bash
   # run from project root
   npm run withdraw-relayer

   ...

   Server running on port 3000
   Destination contract address: 0xEVM_BANK_ADDRESS
   RPC URL: https://rpc.testnet.xrplevm.org
   Relayer public address: 0xMY_ADDRESS
   ```

1. Send cross-chain withdraw transaction

   ```bash
   # run from project root
   # withdraw 0.3 XRP
   npm run withdraw -- --amount 0.3
   ```

## Detailed how-to guides

Access [the slides published here](https://www.figma.com/deck/MKVsACmVp2oo9L2InlXTGs/Expanding-XRPL-programmability%3A-hands-on-tutorial-with-Axelar-general-message-passing?node-id=19-45&t=AdpZdEiCn5Rm2BxH-1).
