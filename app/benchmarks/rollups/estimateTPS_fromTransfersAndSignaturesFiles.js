
const { performance } = require('perf_hooks');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {  ethers } = require("ethers");
const zksync = require("zksync");

let syncProvider;
let ethersProvider;
let syncWallet;

var fs = require('fs');
const readline = require('readline');

let NUMBER_OF_TX = 200;


server.listen(3000, async () => {
  console.log('listening on *:3000');
  syncProvider = await zksync.getDefaultProvider("rinkeby");
  ethersProvider = ethers.getDefaultProvider('rinkeby');
  syncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet("<SENDER_PRIVATE_KEY>", ethersProvider), syncProvider);

  let howManyBatch = Math.floor(N / 10);

  let txPromises = [];


  for (let index = 0; index < howManyBatch; index++) {
    let transfers = [];

    const fileStream1 = fs.createReadStream('transfers_' + index); // app/rollups/customer/

    const rl1 = readline.createInterface({
      input: fileStream1,
      crlfDelay: Infinity
    });


    for await (const line of rl1) {
      transfers.push({
        tx: JSON.parse(line)
      });
    }


    let signatures = [];


    const fileStream2 = fs.createReadStream('signatures_' + index); // app/rollups/customer/

    const rl2 = readline.createInterface({
      input: fileStream2,
      crlfDelay: Infinity
    });


    for await (const line of rl2) {
      signatures.push(JSON.parse(line));
    }

    txPromises.push(zksync.wallet.submitSignedTransactionsBatch(syncWallet.provider, transfers, signatures));
  }

  var t0 = performance.now();
  let countSucceededTx = 0;

  try {
    let handles = await Promise.all(txPromises); // might need to try some times because of possible nonce mismatch derived from Promise.all(...)
    await require('util').promisify(setTimeout)(500);

    let receiptPromises = [];

    handles.forEach(h => {
      h.forEach(h2 => {
        receiptPromises.push(h2.awaitReceipt())
      });
    });
    
    let res = await Promise.all(receiptPromises);
    var t1 = performance.now();

    countSucceededTx = res.filter(receipt => receipt && receipt.executed && receipt.success).length;
  } catch (e) {
    console.error(e);
  }

  console.log(NUMBER_OF_TX + " tx took " + (t1 - t0) + " milliseconds.");
  console.log("Success Tx: " + countSucceededTx);
  process.exit(0);
});