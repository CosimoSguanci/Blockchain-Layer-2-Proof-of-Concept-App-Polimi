#!/bin/bash

curl -X POST -H 'Content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1, "method": "get_tx_fee",
    "params": ["Transfer", "0xC8568F373484Cd51FDc1FE3675E46D8C0dc7D246", "ETH"]
    }' \
  https://api.zksync.io/jsrpc



curl -X POST -H 'Content-type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "id":1, "method": "get_tx_fee",
    "params": ["Withdraw", "0xC8568F373484Cd51FDc1FE3675E46D8C0dc7D246", "ETH"]
    }' \
  https://api.zksync.io/jsrpc

