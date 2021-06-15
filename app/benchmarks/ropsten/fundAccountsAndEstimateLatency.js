// Script to generate N accounts and fund them from the main account (to simulate customers)

const { performance } = require('perf_hooks');

let Web3 = require("web3");

let rpc = "<RPC_URL>";

const provider = new Web3.providers.HttpProvider(rpc);
const web3 = new Web3(provider);

var fs = require('fs');
const readline = require('readline');


const NUMBER_OF_TX = 400;


web3.eth.getTransactionCount("<MAIN_ADDRESS>", "pending").then(async value => { // 'pending'
  let nonce = value;

  let pub = "";
  let priv = "";

  for (let i = 0; i < NUMBER_OF_TX; i++) {
    let account = web3.eth.accounts.create();

    pub = pub + account.address + "\n";
    priv = priv + account.privateKey + "\n";
  }

  fs.writeFileSync("public_addresses", pub);
  fs.writeFileSync("private_keys", priv);

  console.log(NUMBER_OF_TX + " accounts created");

  const fileStream = fs.createReadStream('public_addresses'); // app/plasma/customer/ in debug

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let i = 0;
  let latency = 0;
  let n = 0;

  for await (const line of rl) {

    const obj = {
      chainId: "80001",
      nonce: '0x' + ((nonce + i).toString(16)),
      from: "<MAIN_ADDRESS>",
      to: line,
      value: web3.utils.toWei("0.0015", "ether"),
      gas: 50000,
      gasPrice: "5000000000"
    };

    var t0 = performance.now();
    const signedTransaction = await web3.eth.accounts.signTransaction(obj, accountMain.privateKey);

    const receipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);

    if (receipt.status) {
      var t1 = performance.now();
      latency = latency + (t1 - t0);
      n++;
      console.log("Latency for tx " + i + ": " + (t1 - t0));
    }
    else {
      console.error("Tx " + i + " encountered an error");
    }

    i++;

    await require('util').promisify(setTimeout)(500);
  }

  console.log(NUMBER_OF_TX + " accounts funded");
  console.log("Latency = " + (latency / n));
});


