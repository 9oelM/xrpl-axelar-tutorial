// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {IInterchainTokenExecutable} from "interchain-token-service/interfaces/IInterchainTokenExecutable.sol";

contract MockInterchainTokenService {
    function execute(
        address interchainTokenExecutable,
        bytes32 commandId,
        string calldata sourceChain,
        bytes memory sourceAddress,
        bytes memory data,
        bytes32 tokenId,
        address token,
        uint256 amount
    ) public {
        IInterchainTokenExecutable(interchainTokenExecutable).executeWithInterchainToken(
            commandId, sourceChain, sourceAddress, data, tokenId, token, amount
        );
    }
}
