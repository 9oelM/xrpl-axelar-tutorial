// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Test} from "forge-std/Test.sol";
import {Bank} from "../src/Bank.sol";
import {ERC20} from "interchain-token-service/interchain-token/ERC20.sol";
import {InterchainTokenService} from "interchain-token-service/InterchainTokenService.sol";

contract ForkTest is Test {
    Bank public bank;
    InterchainTokenService public interchainTokenService;
    address public withdrawRelayer;

    // The XRPL address that already has a deposit
    bytes constant XRPL_ADDRESS_BYTES = hex"72684d79767a37427247746d524c344b616b4b504861373953776847576b79675958";
    address constant XRP_ERC20_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    function setUp() public {
        // Fork the testnet
        vm.createSelectFork("https://rpc.testnet.xrplevm.org");

        // Set up withdraw relayer
        withdrawRelayer = address(0x07c58B4FD9E412847a52446CDF784d78B8aBd219);

        // Deployed Bank contract
        bank = Bank(address(0x2653cec7c7ED57c0aeC8EB2CbA80176170C99ce1));
    }

    function testBalance() public view {
        bytes32 addressHash = (keccak256(XRPL_ADDRESS_BYTES));

        // Get the balance of the XRPL address
        uint256 balance = bank.balances(addressHash);

        // Check if the balance is greater than zero
        assertGt(balance, 0);
    }

    // Due to the way EVM Sidechain works, these will fail because balanceOf returns 0 on the forked environment
    // but these tests may be useful for debugging

    // function testBankERC20Balance() public view {
    //     uint256 balance = ERC20(XRP_ERC20_ADDRESS).balanceOf(address(bank));
    //     assertGt(balance, 0);
    // }

    // function testRelayerERC20Balance() public view {
    //     uint256 balance = ERC20(XRP_ERC20_ADDRESS).balanceOf(withdrawRelayer);
    //     assertGt(balance, 0);
    // }

    // function testWithdraw() public {
    //     bytes32 addressHash = keccak256(XRPL_ADDRESS_BYTES);

    //     // Get current balance
    //     uint256 currentBalance = bank.getBalance(addressHash);

    //     // Test withdrawal
    //     uint256 withdrawAmount = 0.01 ether;

    //     // Call withdraw as the withdrawRelayer
    //     vm.prank(withdrawRelayer);
    //     // 1 XRP for axelar gas
    //     bank.withdraw(XRPL_ADDRESS_BYTES, withdrawAmount);

    //     // Verify balance was reduced
    //     assertEq(bank.getBalance(addressHash), currentBalance - withdrawAmount);
    // }
}
