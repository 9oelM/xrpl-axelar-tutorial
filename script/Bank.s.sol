// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Script, console} from "forge-std/Script.sol";
import {Bank} from "../src/Bank.sol";

contract BankScript is Script {
    Bank public bank;

    address ITS = address(0x1a7580C2ef5D485E069B7cf1DF9f6478603024d3);

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        vm.startBroadcast();

        bank = new Bank(ITS);

        vm.stopBroadcast();
    }
}
