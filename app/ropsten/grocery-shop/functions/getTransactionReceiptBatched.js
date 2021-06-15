async function getTransactionReceiptBatched(hashes, web3) {

  let receipts = [];

  if (!hashes) {
      throw new Error("missing parameters");
  }

  var batch = new web3.BatchRequest();

  await new Promise(function(resolve, reject){
    hashes.forEach(hash => {
      batch.add(web3.eth.getTransactionReceipt.request(hash, (error, data) => {
          if (error) {
            receipts.push({
              receipt: null
            });
          }
          else {
            receipts.push({
              receipt: {
                status: data.status
              }
            });
          }

          if(receipts.length === hashes.length) {
            resolve(true);
          }
        }));
    });

    batch.execute();
  });

  return receipts;
}

module.exports = getTransactionReceiptBatched;
