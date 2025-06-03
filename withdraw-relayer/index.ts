import express from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import * as xrpl from 'xrpl';
import { verify } from 'ripple-keypairs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Type-safe configuration
interface Config {
    rpcUrl: string;
    privateKey: string;
    contractAddress: string;
    port: number;
}

function getConfig(): Config {
    const rpcUrl = process.env.WITHDRAW_RELAYER_RPC_URL;
    const privateKey = process.env.WITHDRAW_RELAYER_PRIVATE_KEY;
    const contractAddress = process.env.EVM_BANK_ADDRESS;
    const port = process.env.WITHDRAW_RELAYER_PORT ? parseInt(process.env.WITHDRAW_RELAYER_PORT, 10) : 3000;

    if (!rpcUrl) throw new Error('WITHDRAW_RELAYER_RPC_URL environment variable is required');
    if (!privateKey) throw new Error('WITHDRAW_RELAYER_PRIVATE_KEY environment variable is required');
    if (!contractAddress) throw new Error('EVM_BANK_ADDRESS environment variable is required');

    return {
        rpcUrl,
        privateKey,
        contractAddress,
        port
    };
}

const XRP_EVM_CONTRACT_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

const hex = (str: string): string => Buffer.from(str).toString("hex");

const dropsToEVMSidechainXRPDecimals = (drops: bigint) => {
  // 0.000001 XRP = 1 drop = 1000000000000 on EVM Sidechain
  // https://explorer.xrplevm.org/tx/0xfc3e47b3de64fa56d805957b7fe5d26cad5a0ce2fef1c781cc3c98e8f3a0d6d5?tab=logs
  return drops * 1000000000000n;
};

const config = getConfig();

const app = express();
app.use(express.json());

// Contract ABI - only including the withdraw function
const contractABI = [
    "function withdraw(bytes memory destinationAddress, uint256 requestedAmount) external"
];

const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(config.privateKey, provider);
const contract = new ethers.Contract(
    config.contractAddress,
    contractABI,
    wallet
);

// Initialize XRP ERC20 contract and approve on startup
const xrpContract = new ethers.Contract(
    XRP_EVM_CONTRACT_ADDRESS,
    erc20ABI,
    wallet
);

// Track approval status
let isApprovalComplete = false;
let approvalPromise: Promise<void> | null = null;

// Function to check approval status
async function checkApprovalStatus() {
    try {
        const allowance = await xrpContract.allowance(wallet.address, config.contractAddress);
        return allowance >= ethers.parseEther("100000000");
    } catch (error) {
        console.error("Error checking approval status:", error);
        return false;
    }
}

// Start approval process
console.log("Starting XRP approval process...");
approvalPromise = (async () => {
    try {
        // Check if we already have sufficient allowance
        if (await checkApprovalStatus()) {
            console.log("XRP already approved");
            isApprovalComplete = true;
            return;
        }

        // If not, proceed with approval
        console.log("Approving XRP for gas...");
        const tx = await xrpContract.approve(config.contractAddress, ethers.parseEther("100000000000000"));
        await tx.wait();
        
        // Verify approval was successful
        if (await checkApprovalStatus()) {
            console.log("XRP approval successful");
            isApprovalComplete = true;
        } else {
            throw new Error("Approval transaction completed but allowance not updated");
        }
    } catch (error) {
        console.error("XRP approval failed:", error);
        throw error;
    }
})();

// Endpoint to handle withdraw requests
app.post('/withdraw', async (req, res) => {
    try {
        // Wait for approval if it's not complete
        if (!isApprovalComplete) {
            console.log("Waiting for XRP approval to complete...");
            try {
                await approvalPromise;
            } catch (error) {
                return res.status(500).json({
                    error: 'XRP approval failed',
                    details: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        const { withdrawAccount, publicKey, requestedAmount, timestamp, signature } = req.body;

        if (!withdrawAccount || !publicKey || !requestedAmount || !timestamp || !signature) {
            return res.status(400).json({
                error: 'Missing required parameters: withdrawAccount, publicKey, requestedAmount, timestamp, signature'
            });
        }

        console.log(`Received withdraw request:
            Withdraw Account: ${withdrawAccount}
            Public key: ${publicKey}
            Requested Amount: ${requestedAmount}
            Timestamp: ${timestamp}
            Signature: ${signature}
            `);

        // Validate xrpl address
        if (!xrpl.isValidAddress(withdrawAccount)) {
            return res.status(400).json({
                error: 'Invalid XRP address format'
            });
        }

        // Validate requestedAmount
        if (isNaN(Number(requestedAmount)) || Number(requestedAmount) <= 0) {
            return res.status(400).json({
                error: 'Invalid requestedAmount. It must be a positive number in string format, in the unit of native XRP.'
            });
        }

        // Verify signature
        const payload = {
            withdrawAccount,
            requestedAmount,
            timestamp
        };
        const message = JSON.stringify(payload);
        
        const isValid = verify(hex(message), signature, publicKey);
        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid signature'
            });
        }

        // Check if signature is expired (5 minutes)
        const now = Date.now();
        if (now - timestamp > 5 * 60 * 1000) {
            return res.status(401).json({
                error: 'Signature expired'
            });
        }

        // Convert withdrawAccount to bytes if it's not already
        const withdrawAccountBytes = hex(withdrawAccount);
        
        // Convert requestedAmount to BigNumber
        const amount = dropsToEVMSidechainXRPDecimals(BigInt(xrpl.xrpToDrops(requestedAmount)));

        console.log(`Initiating withdraw transaction:
            Amount in XRP: ${requestedAmount}
            Amount in drops: ${amount}
            Bank contract address: ${config.contractAddress}
            Signer: ${withdrawAccount}
            Withdraw account bytes: ${withdrawAccountBytes}
        `);

        // Call the contract's withdraw function
        const tx = await contract.withdraw(`0x${withdrawAccountBytes}`, amount, {
            value: ethers.parseEther("1") // Send 1 ether as axelar gas fee
        });

        console.log(`Transaction submitted:
            Hash: ${tx.hash}
            From: ${tx.from}
            To: ${tx.to}
            Gas Price: ${tx.gasPrice?.toString()}
            Gas Limit: ${tx.gasLimit?.toString()}`);

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        console.log(`Transaction confirmed:
            Hash: ${receipt.hash}
            Block Number: ${receipt.blockNumber}
            Gas Used: ${receipt.gasUsed?.toString()}
            Check: https://testnet.axelarscan.io/gmp/${receipt.hash}
        `);
        res.json({
            success: true,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString()
        });

    } catch (error) {
        console.error('Error processing withdraw request:', error);
        res.status(500).json({
            error: 'Failed to process withdraw request',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Destination contract address: ${config.contractAddress}`);
    console.log(`RPC URL: ${config.rpcUrl}`);
    console.log(`Relayer public address: ${wallet.address}`);
});
