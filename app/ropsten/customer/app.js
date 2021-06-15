const socketIoClient = require("socket.io-client");

const GROCERY_SHOP_URL = "<GROCERY_SHOP_URL>";
let Web3 = require("web3");

let rpc = "<RPC_URL>"; // ROPSTEN

const provider = new Web3.providers.HttpProvider(rpc);
const web3 = new Web3(provider);

var fs = require('fs');
const readline = require('readline');

const NUMBER_OF_TX = 400;


(async function () {

  let privateKeys = [];
  const fileStream2 = fs.createReadStream('private_keys');

  const rl2 = readline.createInterface({
    input: fileStream2,
    crlfDelay: Infinity
  });


  for await (const line of rl2) {
    privateKeys.push(line);
  }


  for (let i = 0; i < NUMBER_OF_TX; i++) {
    const socket = socketIoClient(GROCERY_SHOP_URL); // connect to grocery shop

    let account = web3.eth.accounts.privateKeyToAccount(privateKeys[i]);

    socket.on('paymentReq', async (req) => {
      // req = payment invoice

      let reqObj = JSON.parse(req);

      const obj = {
        chainId: "80001",
        from: account.address,
        to: reqObj.destinationAddress,
        value: web3.utils.toWei(reqObj.amount, "ether"),
        gas: 50000,
        gasPrice: "5500000000"
      };

      await require('util').promisify(setTimeout)(500);

      const signedTransaction = await web3.eth.accounts.signTransaction(obj, account.privateKey);

      socket.emit('submitTransaction', signedTransaction.rawTransaction);
    });


    socket.on('paymentCompleted', async (txHash) => {
      console.log('Payment ' + txHash + ' Done');
    });

    socket.on('paymentError', async (txHash) => {
      console.log('Payment ' + txHash + ' encountered an error');
    });
  }

})();

