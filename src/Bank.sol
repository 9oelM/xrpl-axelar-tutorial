// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {InterchainTokenExecutable} from "interchain-token-service/executable/InterchainTokenExecutable.sol";
import {InterchainTokenService} from "interchain-token-service/InterchainTokenService.sol";
import {ERC20} from "interchain-token-service/interchain-token/ERC20.sol";
import {
    InvalidOp,
    InvalidTokenId,
    InvalidTokenAddress,
    InvalidSourceChain,
    InsufficientBalance,
    InvalidWithdrawRelayer,
    TakeGasFailed
} from "./Errors.sol";

contract Bank is InterchainTokenExecutable {
    event Deposit(bytes indexed sourceAddress, bytes32 addressHash, uint256 amount);
    event Withdraw(bytes indexed sourceAddress, bytes32 addressHash, uint256 amount);

    string constant XRPL_AXELAR_CHAIN_ID = "xrpl";
    // https://explorer.testnet.xrplevm.org/tx/0x79113007ca4591f019e41829a714425c7c8905815c207f93db166348da359add?tab=logs
    bytes32 constant XRP_AXELAR_TOKEN_ID = 0xba5a21ca88ef6bba2bfff5088994f90e1077e2a1cc3dcc38bd261f00fce2824f;
    // https://explorer.testnet.xrplevm.org/token/0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
    address constant XRP_ERC20_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    bytes32 constant OP_DEPOSIT = keccak256("deposit");

    mapping(bytes32 => uint256) public balances;
    address public withdrawRelayer;

    modifier onlyWithdrawRelayer() {
        if (msg.sender != withdrawRelayer) {
            revert InvalidWithdrawRelayer(msg.sender);
        }
        _;
    }

    constructor(address _interchainTokenService, address _withdrawRelayer)
        InterchainTokenExecutable(_interchainTokenService)
    {
        if (_withdrawRelayer == address(0)) {
            revert InvalidWithdrawRelayer(_withdrawRelayer);
        }
        withdrawRelayer = _withdrawRelayer;
    }

    function _executeWithInterchainToken(
        bytes32 _commandId,
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

        (bytes32 op) = abi.decode(data, (bytes32));
        bytes32 addressHash = keccak256(sourceAddress);

        if (op == OP_DEPOSIT) {
            deposit(addressHash, amount);

            emit Deposit(sourceAddress, addressHash, amount);
        } else {
            revert InvalidOp(op);
        }
    }

    function deposit(bytes32 addressHash, uint256 amount) private {
        balances[addressHash] += amount;
    }

    function setBalance(bytes32 addressHash, uint256 balance) private {
        balances[addressHash] = balance;
    }

    function withdraw(bytes memory destinationAddress, uint256 requestedAmount) external onlyWithdrawRelayer {
        bytes32 addressHash = keccak256(destinationAddress);

        uint256 balance = getBalance(addressHash);
        if (balance < requestedAmount) {
            revert InsufficientBalance(addressHash, requestedAmount, balance);
        }
        setBalance(addressHash, balance - requestedAmount);

        // take gas from the relayer
        bool success = ERC20(XRP_ERC20_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            1 ether // 1 XRP for axelar gas
        );

        if (!success) {
            revert TakeGasFailed();
        }

        InterchainTokenService(interchainTokenService).interchainTransfer(
            // bytes32 tokenId,
            XRP_AXELAR_TOKEN_ID,
            // string calldata destinationChain,
            XRPL_AXELAR_CHAIN_ID,
            // bytes calldata destinationAddress,
            destinationAddress,
            // uint256 amount,
            requestedAmount,
            // bytes calldata metadata,
            "",
            // uint256 gasValue
            1 ether // 1 XRP
        );

        emit Withdraw(destinationAddress, addressHash, requestedAmount);
    }

    function getBalance(bytes32 addressHash) public view returns (uint256) {
        return balances[addressHash];
    }
}
