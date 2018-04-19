'use strict';

const PlayCoin = artifacts.require('PlayCoin');
const PlayCoinMultiSigFactory = artifacts.require('PlayCoinMultiSigWallet');
const web3 = PlayCoin.web3;
const eth = web3.eth;
const FOREVER = 99999999999;  // Tuesday, 27 June 3730 2:45:55 AM

// get eth balance
const ethBalanceOf = (account) => eth.getBalance(account);

const deployMultiSigWallet = (owners, requiredConfirm, coin) => {
  return PlayCoinMultiSigFactory.new(owners, requiredConfirm, coin);
};

const deployPlayCoin = (owner,admin,vault) => {
  return PlayCoin.new("PLY", "PlayCoin", owner, admin, vault);
};

const printTx = (tx) => {
  for(let i=0; i<tx.logs.length; i++) {
    console.log(`------------------------------------`);
    console.log(`tx.logs[${i}]`);
    for(let key in tx.logs[i]) {
      if(key == "args") {
        for(let argname in tx.logs[i]["args"]) {
          console.log(`TX[${key}][${argname}] = ${tx.logs[i][key][argname]}`);
        }
      } else {
        console.log(`TX[${key}] = ${tx.logs[i][key]}`);
      }
    }
  }
};

const getEventParameterFromTx = (tx, _event, param) => {
  const found = tx.logs
    .filter(({event}) => event === _event)

  if(found.length >= 1) {
    const foundParam = found[0].args[param]
    if(!foundParam)
      assert.fail();
    else
      return foundParam;
  } else {
    assert.fail();
  }
};

const mkPromise = ftWithCallback =>
  new Promise((resolve, reject) =>
    ftWithCallback((err, res) => {
      if (err) { reject(err); } else { resolve(res); }
    })
  )

// some functional flavour
const _zip = a => b => a.map((e, i) => [e, b[i]]);
const _map = a => f => a.map(f);
const _mkString = a => delim => a.join(delim);
const _compose = (...fs) =>
  fs.reverse().reduce((f1, f2) =>
      v => f2(f1(v)),
      v => v
  );
const _then = (...fs) =>
  fs.reduce((f1, f2) =>
      v => f2(f1(v)),
    v => v
  );

const trRequestIndexMap = {
  desc: 0,
  contractAddr: 1,
  abi: 2,
  executed: 3,
  cancelled: 4,
  confirmed: 5,
  expiry: 6
};

const assertTxRequest = (txRequest, desc, abi, executed, cancelled, confirmed, contractAddr = 0, expiry=FOREVER ) => {
  assert.equal(txRequest[trRequestIndexMap.desc], desc);
  assert.equal(txRequest[trRequestIndexMap.contractAddr], contractAddr);
  assert.equal(txRequest[trRequestIndexMap.abi], abi);
  assert.equal(txRequest[trRequestIndexMap.executed], executed);
  assert.equal(txRequest[trRequestIndexMap.cancelled], cancelled);
  assert.equal(txRequest[trRequestIndexMap.confirmed], confirmed);
  assert.equal(txRequest[trRequestIndexMap.expiry], expiry);
};

const assertTxRequestStateOnly = (txRequest, desc, executed, cancelled, confirmed ) => {
  assert.equal(txRequest[trRequestIndexMap.desc], desc);
  assert.equal(txRequest[trRequestIndexMap.executed], executed);
  assert.equal(txRequest[trRequestIndexMap.cancelled], cancelled);
  assert.equal(txRequest[trRequestIndexMap.confirmed], confirmed);
};

const ONE_DAY = 24 * 3600;

contract('PlayCoinMultiSigWallet', (accounts) => {
  let coinInstance;
  let walletInstance;
  const requiredConfirmations = 2;

  let OnePlayCoin;
  let NoOfTokens;

  const owner = accounts[0];
  const admin = accounts[1];
  const vault = accounts[2];

  const user1 = accounts[3];
  const user2 = accounts[4];
  const user3 = accounts[5];

  console.log(`using owner = ${owner}`);
  console.log(`using admin = ${admin}`);
  console.log(`using vault = ${vault}`);
  console.log(`using user1 = ${user1}`);
  console.log(`using user2 = ${user2}`);
  console.log(`using user3 = ${user3}`);

  // 어카운트 잔고 호출을 단순화 해주기 위한 함수
  const tokenBalanceOf = (account) => coinInstance.balanceOf(account);

  beforeEach(async () => {
    coinInstance = await deployPlayCoin(owner, admin, vault);
    assert.ok(coinInstance);

    NoOfTokens = Number(await coinInstance.getMaxNumberOfTokens());
    OnePlayCoin = Number(await coinInstance.getOnePlayCoin());

    walletInstance = await deployMultiSigWallet([owner,admin,vault], 2, coinInstance.address);
    assert.ok(walletInstance);
  });

  it('multisig wallet basic functions', async () => {
    assert.equal( await walletInstance.playcoinAddr(), coinInstance.address );

    // getOwners can be executed by owners only
    assert.deepEqual( await walletInstance.getSigners({from: owner}), [owner, admin, vault]);
    assert.deepEqual( await walletInstance.getSigners({from: admin}), [owner, admin, vault]);
    assert.deepEqual( await walletInstance.getSigners({from: vault}), [owner, admin, vault]);
    try {
      await walletInstance.getSigners({from: user1});  // not owner
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // coin change test
    const newCoin = await deployPlayCoin(admin,owner,vault);
    try {
      await walletInstance.setPlayCoin(newCoin.address, {from: user1});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // only owner can change the playcoin contract address
    await walletInstance.setPlayCoin(newCoin.address, {from: owner});
    assert.equal( await walletInstance.playcoinAddr(), newCoin.address );
  });

  it('test transfer using multisig wallet', async () => {
    // intial balance check
    const initialBalance = await tokenBalanceOf(user1);
    assert.equal(initialBalance.toNumber(), 0);
    const vaultInitBalance = Number(await tokenBalanceOf(vault));
    assert.equal(vaultInitBalance, NoOfTokens * OnePlayCoin);
    assert.equal(ethBalanceOf(walletInstance.address),0);  // initially no eth on walletInstance(gas fee reserve)

    coinInstance.transfer(walletInstance.address, 1000*OnePlayCoin, {from:vault});
    assert.equal(Number(await tokenBalanceOf(walletInstance.address)), 1000*OnePlayCoin);

    // Add playcoin transfer transaction
    const transferData = coinInstance.contract.transfer.getData(user1, OnePlayCoin * 1);

    const MSG1 = "send 1PLY to user1";
    const trSubmit = await walletInstance.requestTX(transferData, MSG1, {from: vault});

    //printTx(trSubmit);

    const txID = getEventParameterFromTx( trSubmit, "TXRequested", "id" );

    // get transaction info
    // NOTE: requestMap returns not the structure, but the ordered list of fields.
    //       the field order is just same as the .sol contract's TXRequest struct.
    //return(request.description, request.contractAddress, request.abiData,
    //  request.executed, request.cancelled, request.confirmed, request.expiry);
    const txRequest = await walletInstance.viewTX(txID);
    const txSigns = await walletInstance.viewWhoSignTX(txID);
    const txRejections = await walletInstance.viewWhoRejectTX(txID);

    //console.log(`TX Requested = {${txRequest}}`);
    //console.log(`TX Confirms = ${txSigns.join(",")}`);
    //console.log(`TX Rejects = ${txRejections.join(",")}`);

    assertTxRequestStateOnly(txRequest, MSG1, false, false, false);
    assert.equal(txSigns.length,1);
    assert.equal(txSigns[0],vault)
    assert.equal(txRejections.length,0);

    //
    // TODO: if web3.eth can parse the returned structure ABI,
    //       we can use below code instead of the above `walletInstance.requestMap(txID)`
    // get transaction info
    //console.log('##### viewTX()');
    //const tx1 = await walletInstance.viewTX(txID);
    //console.log(`tx just after requesting = ${tx1}`);
    //

    // sign transfer transaction using other user
    try {
      await walletInstance.signTX(txID, {from: user1});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // sign transfer transaction using vault
    try {
      await walletInstance.signTX(txID, {from: vault});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // 2 sign -> execute the TX
    // but it should fail because wallet has no gas fee
    // IN TEST ENV: out of gas fee never occurs in truffle develop or ganache)
    // BUT in geth or other: out of gas fee can occur
    const testIsTruffleOrGanache = true
    if(testIsTruffleOrGanache) {
      const trSign = await walletInstance.signTX(txID, {from: admin});
      //printTx(trSign);
      const afterBalance = await tokenBalanceOf(user1);
      // on truffle or ganache, gas fee fail does not occur
      assert.equal(afterBalance.toNumber(), OnePlayCoin * 1)
    } else {
      try {
        const trSign = await walletInstance.signTX(txID, {from: admin});
        //printTx(trSign);
        assert.fail();
      } catch(exception) {
        const failedID = getEventParameterFromTx(trSign, "TXExecutionFailed", "id");
        assert.equal(failedID, 0);
      }
      const afterBalance = await tokenBalanceOf(user1);
      assert.equal(afterBalance.toNumber(), OnePlayCoin * 0)
    }

    // check request TX status
    const txRequest2 = await walletInstance.viewTX(txID);
    const txSigns2 = await walletInstance.viewWhoSignTX(txID);
    const txRejections2 = await walletInstance.viewWhoRejectTX(txID);
    if(testIsTruffleOrGanache)
      assertTxRequest(txRequest2, MSG1, transferData, true, false, true);
    else
      assertTxRequest(txRequest2, MSG1, transferData, false, false, true);
    assert.equal(txSigns2.length,2);
    assert.equal(txSigns2[0],vault);
    assert.equal(txSigns2[1],admin);
    assert.equal(txRejections2.length,0);

    // Send money to wallet
    const Deposit = 1000000000000000;  // 1e15
    await eth.sendTransaction({ to: walletInstance.address, value: Deposit, from: accounts[0] });
    assert.equal(ethBalanceOf(walletInstance.address),Deposit);

    if(!testIsTruffleOrGanache) {
      // run the confirmed TX
      const trRunConfirmed = await walletInstance.runConfirmedTX(txID, {from: admin});
      //printTx(trRunConfirmed);
      const afterBalance2 = await tokenBalanceOf(user1);
      assert.equal(afterBalance2.toNumber(), OnePlayCoin * 1);
    }
  });

  it("only owner can add the signer", async () => {
    // only owner can add the signer
    try {
      await walletInstance.addSigner(user1, {from: admin});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    await walletInstance.addSigner(user1, { from: owner });
    assert.deepEqual(await walletInstance.getSigners({from: owner}), [owner, admin, vault, user1]);
  });

  it("removed signer cannot request TX or Sign", async () => {
    await walletInstance.removeSigner(owner);

    const transferData = coinInstance.contract.transfer.getData(user1, OnePlayCoin * 1);
    const MSG1 = "send 1PLY to user1";
    let trSubmit;
    try {
      trSubmit = await walletInstance.requestTX(transferData, MSG1, {from: owner});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    trSubmit = await walletInstance.requestTX(transferData, MSG1, {from: admin});
    const txID = getEventParameterFromTx( trSubmit, "TXRequested", "id" );

    try {
      trSubmit = await walletInstance.signTX(txID, {from: owner});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }
  });

  it("remove signer test", async () => {
    assert.equal( await walletInstance.playcoinAddr(), coinInstance.address );
    assert.deepEqual( await walletInstance.getSigners({from: owner}), [owner, admin, vault]);

    // can remove signer because min # of signs are less than current # of signer
    await walletInstance.removeSigner(owner);
    // owner can run the getSigners() because he is the owner of the multi sig contract
    assert.deepEqual(await walletInstance.getSigners({from: owner}), [admin, vault]);

    // cannot remove if remaining # of signers is less than or equal to the minimum # of signers.
    let trRemoveFail = await walletInstance.removeSigner(vault);
    let who = getEventParameterFromTx(trRemoveFail, "SignerCannotRemoved", "who");
    let reason = getEventParameterFromTx(trRemoveFail, "SignerCannotRemoved", "reason");
    assert.equal(who, vault);
    assert.equal(reason,"cannot meet no of min signs.");

    await walletInstance.addSigner(owner, { from: owner });
    assert.deepEqual(await walletInstance.getSigners({from: owner}), [admin, vault, owner]);

    // cannot remove if there are some pending transaction
    const transferData = coinInstance.contract.transfer.getData(user1, OnePlayCoin * 1);
    const MSG1 = "send 1PLY to user1";
    const trSubmit = await walletInstance.requestTX(transferData, MSG1, {from: vault});

    trRemoveFail = await walletInstance.removeSigner(owner);
    who = getEventParameterFromTx(trRemoveFail, "SignerCannotRemoved", "who");
    reason = getEventParameterFromTx(trRemoveFail, "SignerCannotRemoved", "reason");
    assert.equal(who, owner);
    assert.equal(reason,"pending TX exists.");
    assert.deepEqual(await walletInstance.getSigners({from: owner}), [admin, vault, owner]);
  });

  it("eth or qtm return test", async () => {
    // Send money to wallet
    const Deposit = 1000000000000000;  // 1e15
    await eth.sendTransaction({ to: walletInstance.address, value: Deposit, from: accounts[0] });
    assert.equal(ethBalanceOf(walletInstance.address),Deposit);

    // refund the money does not work if call directly
    try {
      await walletInstance.refundQtum(vault, Deposit / 10, {from: owner});
      assert.fail();
    } catch(exception) {
      assert.isTrue(exception.message.includes("revert"));
    }

    // encoding refund money
    const refundData = walletInstance.contract.refundQtum.getData(vault, Deposit*0.1);
    const MSG1 = "REFUND 1/10 of eth";
    const trSubmit = await walletInstance.requestTXWithContract(walletInstance.address, refundData,
      MSG1, { from: owner});

    const txID = getEventParameterFromTx( trSubmit, "TXRequested", "id" );

    // confirm the refund
    const trConfirm = await walletInstance.signTX(txID, {from: vault});

    // check request TX status
    const txRequest2 = await walletInstance.viewTX(txID);
    const txSigns2 = await walletInstance.viewWhoSignTX(txID);
    const txRejections2 = await walletInstance.viewWhoRejectTX(txID);
    assertTxRequestStateOnly(txRequest2, MSG1,  true, false, true);
    assert.equal(txSigns2.length,2);
    assert.equal(txSigns2[0],owner);
    assert.equal(txSigns2[1],vault);
    assert.equal(txRejections2.length,0);

    assert.isAtMost(Number(await ethBalanceOf(walletInstance.address)), Deposit*0.9);
  });
});
