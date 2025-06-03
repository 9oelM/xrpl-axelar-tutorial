import express from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

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
    const contractAddress = process.env.WITHDRAW_RELAYER_DESTINATION_CONTRACT_ADDRESS;
    const port = process.env.WITHDRAW_RELAYER_PORT ? parseInt(process.env.WITHDRAW_RELAYER_PORT, 10) : 3000;

    if (!rpcUrl) throw new Error('WITHDRAW_RELAYER_RPC_URL environment variable is required');
    if (!privateKey) throw new Error('WITHDRAW_RELAYER_PRIVATE_KEY environment variable is required');
    if (!contractAddress) throw new Error('WITHDRAW_RELAYER_DESTINATION_CONTRACT_ADDRESS environment variable is required');

    return {
        rpcUrl,
        privateKey,
        contractAddress,
        port
    };
}

const config = getConfig();

const app = express();
app.use(express.json());

// Contract ABI - only including the withdraw function
const contractABI = [
    "function withdraw(bytes memory sourceAddress, uint256 requestedAmount) external"
];

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(config.privateKey, provider);
const contract = new ethers.Contract(
    config.contractAddress,
    contractABI,
    wallet
);

// Endpoint to handle withdraw requests
app.post('/withdraw', async (req, res) => {
    try {
        const { sourceAddress, requestedAmount } = req.body;

        if (!sourceAddress || !requestedAmount) {
            return res.status(400).json({
                error: 'Missing required parameters: sourceAddress and requestedAmount'
            });
        }

        // Convert sourceAddress to bytes if it's not already
        const sourceAddressBytes = ethers.toUtf8Bytes(sourceAddress);
        
        // Convert requestedAmount to BigNumber
        const amount = ethers.parseUnits(requestedAmount.toString(), 18);

        console.log(`Initiating withdraw transaction:
            Source Address: ${sourceAddress}
            Amount: ${requestedAmount}
            Contract Address: ${config.contractAddress}`);

        // Call the contract's withdraw function
        const tx = await contract.withdraw(sourceAddressBytes, amount);
        
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
            Gas Used: ${receipt.gasUsed?.toString()}`);

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
