const zksync = require("zksync");
const { BigNumber, ethers } = require("ethers");
const NUMBER_OF_TX = 100;

var fs = require('fs');
const readline = require('readline');

(async function () {

  const syncProvider = await zksync.getDefaultProvider("rinkeby");
  let provider = ethers.getDefaultProvider('rinkeby');

  let privateKeys = [];

  const fileStream = fs.createReadStream('private_keys'); // app/rollups/customer/

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });


  for await (const line of rl) {
    privateKeys.push(line);
  }


  let globalIndex = 0;

  let howManyBatch = Math.floor(NUMBER_OF_TX / 10); // max 10 signers for batch transactions -> batch size = 10

  for (let index = 0; index < howManyBatch; index++) {

    let transfers = [];
    let messages = [];


    for (let i = 0; i < 9; i++) {
      const syncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet(privateKeys[globalIndex], provider), syncProvider);

      const amount = zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.0001"));

      let n = await syncWallet.getNonce();

      try {
        const transfer = await syncWallet.getTransfer({
          to: "<DESTINATION_ADDRESS>",
          token: "ETH",
          amount,
          nonce: n,
          fee: BigNumber.from(0),
          validFrom: 0,
          validUntil: zksync.utils.MAX_TIMESTAMP
        });

        const messagePart = syncWallet.getTransferEthMessagePart(transfer);

        transfers.push({
          tx: transfer
        });

        messages.push(`From: ${syncWallet.address().toLowerCase()}\n${messagePart}\nNonce: ${n}`);


      } catch (e) {
        console.error(e);
      }

      //console.log(globalIndex + " done first loop");
      globalIndex++;
      await require('util').promisify(setTimeout)(2000);
    }

    let t = [];
    for (let i = 0; i < 9 + 1; i++) {
      t.push("Transfer");
    }

    let a = [];
    for (let i = 0; i < 9 + 1; i++) {
      a.push("<DESTINATION_ADDRESS>");
    }

    let batchfee = await syncProvider.getTransactionsBatchFee(t, a, "ETH");

    let mainSyncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet("<FEE_PAYER_PRIVATE_KEY>", provider), syncProvider);

    // the shop add its tx to pay for batch fee
    let n = (await mainSyncWallet.getNonce()) + index;

    const transfer = await mainSyncWallet.getTransfer({
      to: "<FEE_PAYER_ADDRESS>",
      token: "ETH",
      amount: zksync.utils.closestPackableTransactionAmount(ethers.utils.parseEther("0.0001")),
      nonce: n,
      fee: BigNumber.from(batchfee),
      validFrom: 0,
      validUntil: zksync.utils.MAX_TIMESTAMP
    });

    const messagePart = mainSyncWallet.getTransferEthMessagePart(transfer);

    messages.unshift(`From: ${mainSyncWallet.address().toLowerCase()}\n${messagePart}\nNonce: ${n}`);

    transfers.unshift({ tx: transfer });

    const messageToBeSigned = messages.join('\n\n');

    let signatures = [];
    signatures.push(await mainSyncWallet.ethMessageSigner.getEthMessageSignature(messageToBeSigned));

    globalIndex = globalIndex - 9;

    for (let i = 0; i < 9; i++) {
      const syncWallet = await zksync.Wallet.fromEthSigner(new ethers.Wallet(privateKeys[globalIndex], provider), syncProvider);

      let signature = await syncWallet.ethMessageSigner.getEthMessageSignature(messageToBeSigned);

      signatures.push(signature);
      //console.log(globalIndex + " done signature loop");
      globalIndex++;
      await require('util').promisify(setTimeout)(2000);
    }

    let transfersString = "";
    let signaturesString = "";

    for (let i = 0; i < 9 + 1; i++) {
      transfersString = transfersString + JSON.stringify(transfers[i].tx) + "\n";
      signaturesString = signaturesString + JSON.stringify(signatures[i]) + "\n";
    }

    fs.writeFileSync("transfers_" + index, transfersString);
    fs.writeFileSync("signatures_" + index, signaturesString);

  }


  console.log("Written transfers and signatures files");
})();







