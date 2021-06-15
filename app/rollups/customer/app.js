const socketIoClient = require("socket.io-client");

const GROCERY_SHOP_URL = "<GROCERY_SHOP_URL>";

const zksync = require("zksync");
const { BigNumber, ethers } = require("ethers");

const NUMBER_OF_TX = 100;


(async function () {

  for (let i = 0; i < NUMBER_OF_TX; i++) {

    // Derive zksync.Signer from ethereum wallet.
    const syncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet(privateKeys[i], provider), syncProvider);

    const socket = socketIoClient(GROCERY_SHOP_URL); // connect to grocery shop

    socket.on('paymentReq', async (req) => {

      let reqObj = JSON.parse(req);

      const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther(reqObj.amount));

      let n = await syncWallet.getNonce();

      try {
        const transfer = await syncWallet.getTransfer({
          to: reqObj.destinationAddress,
          token: "ETH",
          amount,
          nonce: n,
          fee: BigNumber.from(0),
          validFrom: 0,
          validUntil: zksync.utils.MAX_TIMESTAMP
        });

        const messagePart = syncWallet.getTransferEthMessagePart(transfer);


        socket.emit('submitTransaction', JSON.stringify({
          tx: transfer,
          message: `From: ${syncWallet.address().toLowerCase()}\n${messagePart}\nNonce: ${n}`
        }));

      } catch (e) {
        console.error(e);
      }
    });

    socket.on('messageToBeSigned', async (obj) => {
      obj = JSON.parse(obj);
      let signature = await syncWallet.ethMessageSigner.getEthMessageSignature(obj.messageToBeSigned);
      socket.emit("submitSignature", JSON.stringify({ signature, index: obj.index }));
    });

    socket.on('paymentCompleted', async (txHash) => {
      console.log('Payment ' + txHash + ' Done');
    });

    socket.on('paymentError', async (txHash) => {
      console.log('Payment ' + txHash + ' encountered an error');
    });
  }
})();







