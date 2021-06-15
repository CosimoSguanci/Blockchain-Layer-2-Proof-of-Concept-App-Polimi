const lnService = require('ln-service');
const { performance } = require('perf_hooks');
const readline = require('readline');
const fs = require("fs");

const { lnd } = lnService.authenticatedLndGrpc({
  cert: '',
  macaroon: '',
  socket: '127.0.0.1:10009',
});

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const NUMBER_OF_TX = 800;
let txCompleted = 0;
let latency = 0;

server.listen(3000, async () => {
  console.log('LN benchmark server listening on *:3000');

  const fileStream1 = fs.createReadStream('invoices');

  /*
  Invoice are generated in the following way from the supermarket node: 
  
  let invoices = "";
  for(let i = 0; i < NUMBER_OF_TX; i++) {
    const invoice = (await lnService.createInvoice({ lnd, tokens: 1 }));
    invoices = invoices + invoice.request + "\n";
  }
  fs.writeFileSync("invoices", invoices);

  */

  const rl = readline.createInterface({
    input: fileStream1,
    crlfDelay: Infinity
  });

  var t0 = performance.now();

  for await (const line of rl) {

    var tl0 = performance.now();

    lnService.pay({ lnd, request: line }, (err, payment) => {
      if (err) {
        console.error(err);
      }
      else {
        var tl1 = performance.now();
        latency = latency + (tl1 - tl0);

        console.log('Payment Done ' + (txCompleted));

        txCompleted++;

        if (txCompleted == NUMBER_OF_TX) {
          var t1 = performance.now();
          console.log(NUMBER_OF_TX + " tx took " + (t1 - t0) + " milliseconds.");
          console.log("average tx latency: " + (latency / NUMBER_OF_TX));
          process.exit(0);
        }
      }
    });
  }

});
