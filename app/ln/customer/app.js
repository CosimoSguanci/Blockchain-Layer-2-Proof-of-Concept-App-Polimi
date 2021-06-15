const lnService = require('ln-service');

const { lnd } = lnService.authenticatedLndGrpc({
  cert: '',
  macaroon: '',
  socket: '127.0.0.1:10009',
});

const io = require("socket.io-client");

const GROCERY_SHOP_URL = "<GROCERY_SHOP_URL>";

const NUMBER_OF_TX = 200;

let sockets = [];

for (let i = 0; i < NUMBER_OF_TX; i++) {
  const socket = io(GROCERY_SHOP_URL);
  sockets.push(socket);
}


for (let i = 0; i < NUMBER_OF_TX; i++) {
  let socket = sockets[i];


  socket.on('paymentReq', (req) => {
    // req = payment invoice
    lnService.pay({ lnd, request: req }, (err, payment) => {
      if (err) {
        console.error(err);
      }
      else {
        socket.emit('paymentDone', req);
        console.log('Payment Done ' + payment.id);
      }
    });

  });
}
