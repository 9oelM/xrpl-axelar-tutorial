// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Test, console} from "forge-std/Test.sol";
import {Bank} from "../src/Bank.sol";
import {InsufficientBalance} from "../src/Errors.sol";
import {MockInterchainTokenService} from "./MockInterchainTokenService.sol";

contract BankTest is Test {
    Bank public bank;
    MockInterchainTokenService public mockInterchainTokenService;

    bytes32 constant OP_DEPOSIT = keccak256("deposit");
    bytes32 constant OP_WITHDRAW = keccak256("withdraw");
    bytes32 constant OP_DONATE = keccak256("donate");

    bytes32 constant XRP_AXELAR_TOKEN_ID = 0xbfb47d376947093b7858c1c59a4154dd291d5b2251cb56a6f7159a070f0bd518;
    bytes mockSourceAddress = abi.encode(address(0xFFB77e97b05DE4a520a0186B6b61a0D5ff6E238f));
    bytes32 addressHash = keccak256(mockSourceAddress);

    function setUp() public {
        mockInterchainTokenService = new MockInterchainTokenService();
        bank = new Bank(address(mockInterchainTokenService));
    }

    function packData(bytes32 op, uint256 requestedAmount) public pure returns (bytes memory) {
        return abi.encodePacked(op, requestedAmount);
    }

    function deposit(uint256 amount) public {
        mockInterchainTokenService.execute(
            // address interchainTokenExecutable,
            address(bank),
            // bytes32 commandId,
            bytes32(0x6808f26e03dc149ca262b571b95e4c866d7a2604b77bc5c795ed26c2ac414e5f),
            // string calldata sourceChain,
            "xrpl-dev",
            // bytes calldata sourceAddress,
            mockSourceAddress,
            // bytes calldata data,
            packData(OP_DEPOSIT, 0),
            // bytes32 tokenId,
            XRP_AXELAR_TOKEN_ID,
            // address token,
            address(0xD4949664cD82660AaE99bEdc034a0deA8A0bd517),
            // uint256 amount
            amount
        );
    }

    function withdraw(uint256 requestedAmount) public {
        mockInterchainTokenService.execute(
            // address interchainTokenExecutable,
            address(bank),
            // bytes32 commandId,
            bytes32(0x6808f26e03dc149ca262b571b95e4c866d7a2604b77bc5c795ed26c2ac414e5f),
            // string calldata sourceChain,
            "xrpl-dev",
            // bytes calldata sourceAddress,
            mockSourceAddress,
            // bytes calldata data,
            packData(OP_WITHDRAW, requestedAmount),
            // bytes32 tokenId,
            XRP_AXELAR_TOKEN_ID,
            // address token,
            address(0xD4949664cD82660AaE99bEdc034a0deA8A0bd517),
            // uint256 amount
            0
        );
    }

    function test_can_deposit() public {
        deposit(101);

        assertEq(bank.getBalance(addressHash), 101);
    }

    function test_can_withdraw() public {
        uint256 depositAmount = 555;
        uint256 withdrawAmount = 100;

        deposit(depositAmount);

        withdraw(withdrawAmount);

        assertEq(bank.getBalance(addressHash), depositAmount - withdrawAmount);
    }

    function test_cannot_withdraw_more_than_balance() public {
        uint256 depositAmount = 555;
        uint256 withdrawAmount = 556;

        deposit(depositAmount);

        vm.expectRevert(
            abi.encodeWithSelector(InsufficientBalance.selector, addressHash, withdrawAmount, depositAmount)
        );
        withdraw(withdrawAmount);

        assertEq(bank.getBalance(addressHash), depositAmount);
    }
}
