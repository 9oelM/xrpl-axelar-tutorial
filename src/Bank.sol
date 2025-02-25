// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {InterchainTokenExecutable} from "interchain-token-service/executable/InterchainTokenExecutable.sol";
import {InterchainTokenService} from "interchain-token-service/InterchainTokenService.sol";

contract Bank is InterchainTokenExecutable {
    string constant DESTINATION_CHAIN = "xrpl";
    bytes32 constant XRP_AXELAR_TOKEN_ID = 0xbfb47d376947093b7858c1c59a4154dd291d5b2251cb56a6f7159a070f0bd518;
    address constant XRP_ERC20_ADDRESS = 0xD4949664cD82660AaE99bEdc034a0deA8A0bd517;

    bytes32 constant OP_DEPOSIT = keccak256("deposit");
    bytes32 constant OP_WITHDRAW = keccak256("withdraw");

    error InvalidOp(bytes32 op);
    error InvalidTokenId(bytes32 tokenId);
    error InvalidSourceChain(string sourceChain);

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
        (bytes32 op) = abi.decode(data, (bytes32));
        
        if (op == OP_DEPOSIT) {
            deposit();
        } else if (op == OP_WITHDRAW) {
            withdraw();
        } else {
            revert InvalidOp(op);
        }
        // bytes memory num = abi.encodePacked(uint16(0x1234));
        // bytes memory replyData = abi.encodePacked(num, "reply");

        // InterchainTokenService(interchainTokenService).callContractWithInterchainToken(
        //     tokenId,
        //     DESTINATION_CHAIN,
        //     destinationAddress,
        //     amount / 2, // uint256 amount,
        //     replyData, // bytes memory data,
        //     0 // uint256 gasValue
        // );
    }

    function deposit() internal {

    }

    function withdraw() internal {

    }
}
