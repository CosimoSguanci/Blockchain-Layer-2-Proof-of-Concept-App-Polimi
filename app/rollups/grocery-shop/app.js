const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
//const uuidv4 = require('uuid/v4');

const { BigNumber, ethers } = require("ethers");


let submittedSignedTransactions = [];
let sockets = [];
let signatures = [];
let transfers = [];
let lock = false;
const zksync = require("zksync");

let syncProvider;
let syncWallet;

let NUMBER_OF_TX = 200;


app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', async (socket) => {
  console.log('a customer connected');

  const destinationAddress = "<DESTINATION_ADDRESS>";
  const amount = "0.0001";
  const randomStringToInsertInPayment = ""; //uuidv4(); // used to "authenticate" the payment

  socket.emit('paymentReq', JSON.stringify({ randomStringToInsertInPayment, amount, destinationAddress }));

  socket.on('submitTransaction', async (transfer) => {

    if (!lock) {
      // For simplicity we are not handling new transactios if we are processing previous batches
      submittedSignedTransactions.push(JSON.parse(transfer));
      sockets.push(socket);
    }

    if (submittedSignedTransactions.length >= NUMBER_OF_TX && !lock) {
      lock = true;


      let t = [];
      for (let i = 0; i < NUMBER_OF_TX + 1; i++) {
        t.push("Transfer");
      }

      let a = [];
      for (let i = 0; i < NUMBER_OF_TX + 1; i++) {
        a.push("<DESTINATION_ADDRESS>");
      }

      let batchfee = await syncProvider.getTransactionsBatchFee(t, a, "ETH");

      // the shop add its tx to pay for batch fee
      let n = await syncWallet.getNonce();

      const transfer = await syncWallet.getTransfer({
        to: "<DESTINATION_ADDRESS>",
        token: "ETH",
        amount: zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.0001")),
        nonce: n,
        fee: BigNumber.from(batchfee),
        validFrom: 0,
        validUntil: zksync.utils.MAX_TIMESTAMP
      });


      const messagePart = syncWallet.getTransferEthMessagePart(transfer);

      let messages = [];

      messages.push(`From: ${syncWallet.address().toLowerCase()}\n${messagePart}\nNonce: ${n}`);

      transfers.push({ tx: transfer });

      submittedSignedTransactions.slice(0, NUMBER_OF_TX).forEach(obj => {
        transfers.push({ tx: obj.tx });
        messages.push(obj.message);
      });


      const messageToBeSigned = messages.join('\n\n');


      signatures = new Array(NUMBER_OF_TX + 1);
      signatures[0] = await syncWallet.ethMessageSigner.getEthMessageSignature(messageToBeSigned);

      for (let j = 1; j < signatures.length; j++) {
        signatures[j] = null;
      }

      let index = 1;

      sockets.slice(0, NUMBER_OF_TX).forEach(s => {
        s.emit("messageToBeSigned", JSON.stringify({ messageToBeSigned, index }));
        index++;
      });
    }
  });

  socket.on('submitSignature', async (signatureObj) => {

    signatureObj = JSON.parse(signatureObj);

    signatures[signatureObj.index] = signatureObj.signature;

    if (signatures.filter(s => s == null).length === 0) {
      var t0 = performance.now();
      let handles = await zksync.wallet.submitSignedTransactionsBatch(syncWallet.provider, transfers, signatures);
      await Promise.all(handles.map((handle) => handle.awaitReceipt()));
      var t1 = performance.now();
      console.log(NUMBER_OF_TX + " tx took " + (t1 - t0) + " milliseconds.");

      for (let i = 0; i < NUMBER_OF_TX; i++) {
        sockets[i].emit("paymentCompleted", "");
      }

      submittedSignedTransactions = [];
      sockets = [];
      lock = false;


    }
  });
});

server.listen(3000, async () => {
  console.log('Supermarket listening on *:3000');
});