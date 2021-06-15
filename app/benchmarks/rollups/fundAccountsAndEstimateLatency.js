
const { performance } = require('perf_hooks');

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

let Web3 = require("web3");

let rpc = "<RPC_URL>";
const provider = new Web3.providers.HttpProvider(rpc);
const web3 = new Web3(provider);

const zksync = require("zksync");
var fs = require('fs');
const readline = require('readline');

let NUMBER_OF_TX = 200;

server.listen(3000, async () => {
  console.log('listening on *:3000');

  let pub = "";
  let priv = "";

  for (let i = 0; i < NUMBER_OF_TX; i++) {
    let account = web3.eth.accounts.create();

    pub = pub + account.address + "\n";
    priv = priv + account.privateKey + "\n";
  }

  fs.writeFileSync("public_addresses", pub);
  fs.writeFileSync("private_keys", priv);


  const syncProvider = await zksync.getDefaultProvider("rinkeby");
  let provider = ethers.getDefaultProvider('rinkeby');

  // Derive zksync.Signer from ethereum wallet.
  const syncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet("<SENDER_PRIVATE_KEY>", provider), syncProvider);

  if (!(await syncWallet.isSigningKeySet())) {
    if ((await syncWallet.getAccountId()) == undefined) {
      throw new Error("Unknown account");
    }

    // As any other kind of transaction, `ChangePubKey` transaction requires fee.
    // User doesn't have (but can) to specify the fee amount. If omitted, library will query zkSync node for
    // the lowest possible amount.
    const changePubkey = await syncWallet.setSigningKey({
      feeToken: "ETH",
      ethAuthType: "ECDSA",
    });

    // Wait until the tx is committed
    await changePubkey.awaitReceipt();
  }

  const fileStream1 = fs.createReadStream('public_addresses');

  const rl1 = readline.createInterface({
    input: fileStream1,
    crlfDelay: Infinity
  });


  let i = 0;
  let latency = 0;


  for await (const line of rl1) {
    try {
      const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.0001"));

      var t0 = performance.now();

      const transfer = await syncWallet.syncTransfer({
        to: line,
        token: "ETH",
        amount,
      });

      const transferReceipt = await transfer.awaitReceipt();

      var t1 = performance.now();
      latency = latency + (t1 - t0);
      console.log(i + " Transfer Done");
      i++;
      await require('util').promisify(setTimeout)(500);
    } catch (e) {
      console.error(e);
    }
  }

  console.log("Avg Latency: " + latency / i);

});