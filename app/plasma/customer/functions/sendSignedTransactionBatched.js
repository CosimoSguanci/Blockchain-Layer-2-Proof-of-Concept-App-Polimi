async function sendSignedTransactionBatched(web3, signedTxs) {
  let hashes = [];
  var batch = new web3.BatchRequest();

  await new Promise(function(resolve, reject){

    signedTxs.forEach(signedTx => {
      batch.add(web3.eth.sendSignedTransaction.request(signedTx, (error, data) => {
          if (error) {
            hashes.push({
              error: true,
              hash: null
            });
          }
          else {
            hashes.push({
              hash: data,
              error: false
            });
          }

          if(hashes.length === signedTxs.length) {
            resolve(true);
          }
        }));
    });

    batch.execute();
  });
  
  return hashes;
}

module.exports = sendSignedTransactionBatched;
