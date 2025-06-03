// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Script, console} from "forge-std/Script.sol";
import {Bank} from "../src/Bank.sol";

contract BankScript is Script {
    Bank public bank;

    // https://explorer.testnet.xrplevm.org/address/0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
    address ITS = address(0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C);
    address withdrawRelayer = vm.envAddress("WITHDRAW_RELAYER_ADDRESS");

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        bank = new Bank(ITS, withdrawRelayer);

        vm.stopBroadcast();
    }
}
