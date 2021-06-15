const lnService = require('ln-service');

const { lnd } = lnService.authenticatedLndGrpc({
  cert: '',
  macaroon: '',
  socket: '127.0.0.1:10009',
});

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let NUMBER_OF_TX = 200;
let processedTx = 0;

let sockets = [];

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', async (socket) => {
  console.log('a customer connected');

  //let paymentAmount = getRandomInt(1, 100000); // number of satoshi for the invoice

  sockets.push(socket);

  if (sockets.length == NUMBER_OF_TX) { // TODO: processing customers as soon as they connect, or like this?

    sockets.forEach(async s => {
      const invoice = (await lnService.createInvoice({ lnd, tokens: 1 })); // 1 satoshi to preserve channels capacity for the 'benchmark'

      const paymentId = invoice.id;
      const paymentRequest = invoice.request;

      s.emit('paymentReq', paymentRequest);


      s.on('paymentDone', async (msg) => {

        // checking if the payment was successful
        const paymentDetails = await lnService.getInvoice({ lnd, id: paymentId });

        if (paymentDetails.is_confirmed) {
          console.log('payment ' + paymentId + ' confirmed');
        }
        else {
          console.log('something went wrong with payment ' + paymentId);
        }

        processedTx++;

        if(processedTx === NUMBER_OF_TX) {
          // Not accepting incoming connections while processing payments
          sockets = [];
        }
      });
    });
  }
});


server.listen(3000, async () => {
  console.log('Supermarket listening on *:3000');
});
