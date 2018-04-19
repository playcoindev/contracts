var PlayCoin = artifacts.require("./PlayCoin.sol");
var PlayCoinMultiSigWallet = artifacts.require("./PlayCoinMultiSigWallet.sol");

module.exports = function(deployer, network, accounts) {
  deployer.deploy(PlayCoin, 'PLY', 'PlayCoin', accounts[0], accounts[1], accounts[2]).then( () => {
    console.log(`PlayCoin deployed: address = ${PlayCoin.address}`);
    deployer.
      deploy(PlayCoinMultiSigWallet, [accounts[0], accounts[1], accounts[2]], 2, PlayCoin.address)
  });
};
