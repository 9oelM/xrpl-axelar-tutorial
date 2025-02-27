export XRPL_EVM_SIDECHAIN_ITS=0x1a7580C2ef5D485E069B7cf1DF9f6478603024d3
export XRPL_EVM_SIDECHAIN_AXELAR_GATEWAY=0x6850335DA5b6E960eB509B7ec4D159ebA8e89eFd
export XRPL_EVM_SIDECHAIN_RPC_URL="https://rpc.xrplevm.org"
export XRP_TOKEN_ID=0xbfb47d376947093b7858c1c59a4154dd291d5b2251cb56a6f7159a070f0bd518
export XRPL_CHAIN_NAME="xrpl-dev"
export PRIVATE_KEY=0x5bf110d4c1ee2f5ed7d0a17e73e4af13d1e2e30be16a616a3dbabc3c0a98ff08

cast send $XRPL_EVM_SIDECHAIN_ITS "function interchainTransfer(bytes32 tokenId, string destinationChain, bytes destinationAddress, uint256 amount, bytes metadata, uint256 gasValue)" $XRP_TOKEN_ID $XRPL_CHAIN_NAME "0x928846BAF59BD48C28B131855472D04C93BBD0B7" $(cast to-wei 0.001) "0x" 0 --private-key $PRIVATE_KEY --rpc-url $XRPL_EVM_SIDECHAIN_RPC_URL
