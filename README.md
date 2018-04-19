# PlayCoin contracts

## Introduction

PlayCoin is a new cryptocurrency to be used within the GameHub ecosystem helping both game developers and online influencers to earn more profits and create a more fair and competitive environment.

GameHub is an online gaming ecosystem that aims to disrupt traditional online gaming monopolies by applying blockchain technology to streamline mobile game downloads and digital marketing to eliminate middlemen. 

This repository provides the PlayCoin contract and the PlayCoin Multi Sig Wallet contract.

## Contracts

This contract is developed using the truffle and zeppelin-solidity. So basic development can be done using the truffle with truffle's internal blockchain network or ganache, geth. And you may use the [qtumjs](https://github.com/qtumproject/qtumjs) with qtumd(or qtum-qt) with RPC option on or just using the qtum-qt wallet and deploy/call/send to the contract manually.

### Play Coin Contract

Play Coin is a type of QRC20 token with the symbol "PLY". It inherits all the functionality of QRC20 standard token. The maximum supply is fixed to 1,000,000,000 PLY(One Billion PLY). And it has 9 decimal digits. Play Coin is not mintable and initially all PLY tokens will be stored into safe vault to keep the remaining token safe.

The source code is `contracts/PlayCoin.sol`.

### Play Coin Multi Sig Wallet Contract

The multi sig wallet is a contract with a number of signeres and a predefined minimum number of sign to confirm the execution of a transaction. One of the signer can request a transaction on the playcoin contract or he/she can issue any other transaction on other contracts. But the transaction will not run until there are more than the minimum number of singers who signed to the requested transaction. Once the number of sign on the transaction reaches the minumum number, the Play Coin Multi Sig Wallet contract will run the transaction.

The source code is `contracts/PlayCoinMultiSigWallet.sol`.

## Tests

There are a number of basic senario tests for PlayCoin and the PlayCoinMultiSigWallet under the `test` directory. 

## Questions

We will be very happy to hear from you. Please create an issue on the contracts github repository(https://github.com/playcoindev/contracts/issues), we will appreciate you very deeply.
