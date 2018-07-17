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

#### Reserve

Playcoin introduces the concepts of reserve, which can be used if you want to assign some amount of playcoins to an address but want for that address not to spend the playcoins assigned. For example, the gamehub can assign some playcoins for some the the stakeholders with some restriction on excercising their right to spend the playcoins. Reserved playcoin will be included in the balance of the address, but that address cannot spend the playcoin until the admin(which is a multisig vault to protect the privilleged operation) to reduce or remove the reservation.

### Play Coin Multi Sig Wallet Contract

The multi sig wallet is a contract with a number of signeres and a predefined minimum number of sign to confirm the execution of a transaction. One of the signer can request a transaction on the playcoin contract or he/she can issue any other transaction on other contracts. But the transaction will not run until there are more than the minimum number of singers who signed to the requested transaction. Once the number of sign on the transaction reaches the minumum number, the Play Coin Multi Sig Wallet contract will run the transaction.

The source code is `contracts/PlayCoinMultiSigWallet.sol`.

## Tests

There are a number of basic senario tests for PlayCoin and the PlayCoinMultiSigWallet under the `test` directory. 

## Questions

We will be very happy to hear from you. Please create an issue on the contracts github repository(https://github.com/playcoindev/contracts/issues), we will appreciate you very deeply.

# Revision History

## Version 1.0.0(Initial) 2018-4-19

## Revised 2018-7-17

Based on the audit report, we revised the PlayCoinMultiSigWallet.sol.

- Owner control: owener cannot run the signer change functions any more. Those functions can be called only using the multisign contract itself by registering TX and signing by signers.
- Costly loop: we removed the (potentially) expensive loop. The intention behind the (former costly loop) was to prevent deletion of signer when there are pending TX. But the cost is much bigger than the benefit in this case. The singer can register same TX again to run the pending(and now unexecutable) TX.
- Unchecked Math: we added value check for the subtraction.
- other low risk items: we removed almost every warnings per the tool’s report.
