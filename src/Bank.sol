// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {InterchainTokenExecutable} from "interchain-token-service/executable/InterchainTokenExecutable.sol";
import {InterchainTokenService} from "interchain-token-service/InterchainTokenService.sol";
import {InvalidOp, InvalidTokenId, InvalidTokenAddress, InvalidSourceChain, InsufficientBalance} from "./Errors.sol";

contract Bank is InterchainTokenExecutable {
    event Deposit(bytes indexed sourceAddress, bytes32 addressHash, uint256 amount);
    event Withdraw(bytes indexed sourceAddress, bytes32 addressHash, uint256 amount);

    string constant XRPL_AXELAR_CHAIN_ID = "xrpl-dev";
    bytes32 constant XRP_AXELAR_TOKEN_ID = 0xbfb47d376947093b7858c1c59a4154dd291d5b2251cb56a6f7159a070f0bd518;
    address constant XRP_ERC20_ADDRESS = 0xD4949664cD82660AaE99bEdc034a0deA8A0bd517;

    bytes32 constant OP_DEPOSIT = keccak256("deposit");
    bytes32 constant OP_WITHDRAW = keccak256("withdraw");
    bytes32 constant OP_DONATE = keccak256("donate");

    mapping(bytes32 => uint256) public balances;

    constructor(address _interchainTokenService) InterchainTokenExecutable(_interchainTokenService) {}

    function _executeWithInterchainToken(
        bytes32 commandId,
        string calldata sourceChain,
        bytes calldata sourceAddress,
        bytes calldata data,
        bytes32 tokenId,
        address token,
        uint256 amount
    ) internal virtual override {
        if (tokenId != XRP_AXELAR_TOKEN_ID) {
            revert InvalidTokenId(tokenId);
        }

        if (token != XRP_ERC20_ADDRESS) {
            revert InvalidTokenAddress(token);
        }

        if (keccak256(abi.encodePacked(sourceChain)) != keccak256(abi.encodePacked(XRPL_AXELAR_CHAIN_ID))) {
            revert InvalidSourceChain(sourceChain);
        }

        (bytes32 op, uint256 requestedAmount) = abi.decode(data, (bytes32, uint256));
        bytes32 addressHash = keccak256(sourceAddress);

        if (op == OP_DEPOSIT) {
            deposit(addressHash, amount);

            emit Deposit(sourceAddress, addressHash, amount);
        } else if (op == OP_WITHDRAW) {
            withdraw(addressHash, requestedAmount);

            emit Withdraw(sourceAddress, addressHash, requestedAmount);
        } else if (op == OP_DONATE) {} else {
            revert InvalidOp(op);
        }
        // InterchainTokenService(interchainTokenService).callContractWithInterchainToken(
        //     tokenId,
        //     DESTINATION_CHAIN,
        //     destinationAddress,
        //     amount / 2, // uint256 amount,
        //     replyData, // bytes memory data,
        //     0 // uint256 gasValue
        // );
    }

    function deposit(bytes32 addressHash, uint256 amount) private {
        balances[addressHash] += amount;
    }

    function withdraw(bytes32 addressHash, uint256 requestedAmount) private {
        uint256 balance = getBalance(addressHash);
        if (balance < requestedAmount) {
            revert InsufficientBalance(addressHash, requestedAmount, balance);
        }
        setBalance(addressHash, balance - requestedAmount);
    }

    function setBalance(bytes32 addressHash, uint256 balance) private {
        balances[addressHash] = balance;
    }

    function getBalance(bytes32 addressHash) public view returns (uint256) {
        return balances[addressHash];
    }
}
