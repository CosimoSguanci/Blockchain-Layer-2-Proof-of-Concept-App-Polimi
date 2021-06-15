var schedule = require('node-schedule');
const { performance } = require('perf_hooks');
const BigNumber = require("bignumber.js");

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

//const uuidv4 = require('uuid/v4');

let Web3 = require("web3");
const sendSignedTransactionBatched = require("./functions/sendSignedTransactionBatched");
const getTransactionBatched = require("./functions/getTransactionBatched");
const getTransactionReceiptBatched = require("./functions/getTransactionReceiptBatched");

const tokenTransferHexSignature = "0xa9059cbb";

let rpc = "<RPC_URL>"; // ROPSTEN
const provider = new Web3.providers.HttpProvider(rpc);
const web3 = new Web3(provider);

let submittedSignedTransactions = [];
let mapSocketTransaction = {};
let lock = false;
let receiptJob;

const NUMBER_OF_TX = 400;
const NUMBER_OF_TX_PER_BATCH = 100; 

const decodeTokenPayment = (data, to) => {
  try {

    let res = {};

    res.method = data.substr(0, 10);
    res.token = to;
    res.to = '0x' + data.substr(10 + 24, 40);
    res.amount = new BigNumber('0x' + data.substr(10 + 64, 64)).div(new BigNumber(10).pow(18)).toString();

    return res;

  } catch (ex) {
    return null;
  }
}


app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', async (socket) => {
  console.log('a customer connected');

  const destinationAddress = "<DESTINATION_ADDRESS>";
  const tokenAddress = "<TOKEN_ADDRESS>"; // if token payment
  const amount = "0.00001";
  const randomStringToInsertInPayment = ""; //uuidv4(); // should be used to "authenticate" the payment

  socket.emit('paymentReq', JSON.stringify({ amount, randomStringToInsertInPayment, tokenAddress, destinationAddress }));

  socket.on('submitTransaction', async (rawTransaction) => {

    if (!lock) {
      // For simplicity we are not handling new transactios if we are processing previous batches
      submittedSignedTransactions.push(rawTransaction);
      mapSocketTransaction[rawTransaction] = socket;
    }


    if (submittedSignedTransactions.length >= NUMBER_OF_TX && !lock) {
      lock = true;

      let howManyBatches = Math.floor(NUMBER_OF_TX / NUMBER_OF_TX_PER_BATCH); 

      let signedTxArrays = []; // array of arrays of signed txs

      let index = 0;

      for (let i = 0; i < howManyBatches; i++) {
        let signedTxArray = [];

        for (let j = 0; j < 100; j++) {
          signedTxArray.push(submittedSignedTransactions[j + index]);
        }

        signedTxArrays.push(signedTxArray)

        index += 100;

      }


      //var t0 = performance.now();

      let arrayOfArraysOfHashes = [];

      for (let i = 0; i < howManyBatches; i++) {
        let hashes = await sendSignedTransactionBatched(web3, signedTxArrays[i]);
        console.log("Transactions Batch #" + i + " Sent");
        arrayOfArraysOfHashes.push(hashes);
      }

      let arrayOfArraysOfReceipts = [];

      for (let i = 0; i < howManyBatches; i++) {
        let receipts = await getTransactionReceiptBatched(arrayOfArraysOfHashes[i].map(hashObj => hashObj.hash), web3);
        arrayOfArraysOfReceipts.push(receipts);
      }


      let notCompletedTx = 0;

      arrayOfArraysOfReceipts.forEach(arrayOfReceipts => {
        notCompletedTx += arrayOfReceipts.filter(r => r.receipt == null).length
      });


      if (notCompletedTx > 0) {
        receiptJob = schedule.scheduleJob('*/1 * * * * *', async function () { // every 1 second

          let arrayOfArraysOfReceipts = [];

          for (let i = 0; i < howManyBatches; i++) {
            let receipts = await getTransactionReceiptBatched(arrayOfArraysOfHashes[i].map(hashObj => hashObj.hash), web3);
            arrayOfArraysOfReceipts.push(receipts);
          }


          notCompletedTx = 0;

          arrayOfArraysOfReceipts.forEach(arrayOfReceipts => {
            notCompletedTx += arrayOfReceipts.filter(r => r.receipt == null).length
          });


          if (notCompletedTx == 0) {
            receiptJob.cancel();

            //var t1 = performance.now();

            //console.log(NUMBER_OF_TX + " tx took " + (t1 - t0) + " milliseconds.");

            let i = 0;
            submittedSignedTransactions.forEach(rawTx => {
              // here we're assuming that order of txs in submittedSignedTransactions and arrays of hashes/receipt is preserved
              let success = arrayOfArraysOfReceipts.flat()[i].status;
              let txHash = arrayOfArraysOfHashes.flat()[i].hash;

              if (success) {
                mapSocketTransaction[rawTx].emit("paymentCompleted", txHash);
              }
              else {
                mapSocketTransaction[rawTx].emit("paymentError", txHash);
              }
            });


            submittedSignedTransactions = [];
            mapSocketTransaction = {};
            lock = false;
          }
        });

      }
      else {

        submittedSignedTransactions.forEach(rawTx => {
          let success = arrayOfArraysOfReceipts.flat()[i].status;
          let txHash = arrayOfArraysOfHashes.flat()[i].hash;

          if (success) {
            mapSocketTransaction[rawTx].emit("paymentCompleted", txHash);
          }
          else {
            mapSocketTransaction[rawTx].emit("paymentError", txHash);
          }
        });

        submittedSignedTransactions = [];
        mapSocketTransaction = {};
        lock = false;
      }

      // Note: payments should also be checked for correctness, as an example:

      //       if(receipt) { 
      //     const decodedData = decodeTokenPayment(receipt.input, receipt.to); // receipt is the output of web3,js getTransaction(txHash)

      //     if(decodedData.method === tokenTransferHexSignature 
      //     && decodedData.token.toLowerCase() === "<TOKEN_ADDRESS>".toLowerCase() 
      //     && decodedData.to.toLowerCase() === "<DESTINATION_ADDRESS>".toLowerCase() 
      //     && decodedData.amount >= amountOfTokenToBePayed) {

      //       //console.log('payment ' + receipt.hash + ' confirmed');

      //     }
      //     else {
      //       //console.log('something went wrong with payment ' + receipt.hash);
      //     }
      // }


    }

  });
});

server.listen(3000, async () => {
  console.log('Supermarket listening on *:3000');
});