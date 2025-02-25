// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

error InvalidOp(bytes32 op);
error InvalidTokenId(bytes32 tokenId);
error InvalidTokenAddress(address token);
error InvalidSourceChain(string sourceChain);
error InsufficientBalance(bytes32 addressHash, uint256 requestedAmount, uint256 currentBalance);
