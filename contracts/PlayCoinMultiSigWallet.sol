pragma solidity ^0.4.24;

import "./PlayCoin.sol";
import "./SafeMath.sol";

/**
 * @title PlayCoin Multi Signature contract
 */
contract PlayCoinMultiSigWallet {

    /*  Events  */
    event WalletCreated(address indexed creator, address indexed playcoinAddr);
    event PlayCoinChanged(address indexed from, address indexed to);
    event TXRequested(uint16 id, address indexed requester, address indexed contractAddress, bytes abiData, string desc);
    event TXExecuted(uint16 id);
    event TXExpired(uint16 id, uint timestamp);
    event TXExecutionFailed(uint16 id);
    event TXSigned(uint16 id, address indexed who, int nth);
    event TXRejected(uint16 id, address indexed who);
    event TXCancelled(uint16 id);
    event SignerAdded(address indexed who);
    event SignerRemoved(address indexed who);
    event SignerCannotAdd(address indexed who, string reason);
    event SignerCannotRemoved(address indexed who, string reason);
    event QtumReceived(address indexed sender, uint value);
    event QtumRefunded(address indexed receiver, uint value);
    event QtumRefundFailed(address indexed receiver, uint value);
    /* for debugging */
    event DebugMsg1(string msg, uint value1);
    event DebugMsg1A(string msg, address value1);

    /*  Constants  */
    uint constant FOREVER = 99999999999; // Tuesday, 27 June 3730 2:45:55 AM
    uint constant MAX_OWNER_COUNT = 50;

    /*  Storage  */
    struct TXRequest {
        address contractAddress; // the address of contract to run(if 0 use playcoinAddr instead)
        string description;
        bytes abiData;
        bool executed;
        bool cancelled;
        bool confirmed;
        uint expiry;
    }

    using SafeMath for uint256;
    mapping(address => bool) public signerMap; // instead of iterating array, we will use this to check signer
    mapping(uint16 => TXRequest) public requestMap;
    mapping(uint16 => address[]) public requestSignMap;
    mapping(uint16 => address[]) public requestRejectMap;
    address public owner;
    address[] public signers;
    address public playcoinAddr;
    uint8 public requiredNoOfSign;
    uint16 public nextTx;

    /*  Modifiers  */
    // With this modifier, the function should run using this contract's request TX functionality.
    modifier callingSelf() {
        require(msg.sender == address(this));
        _;
    }

    // Various owner/signer checking modifiers
    modifier senderIsOwner() {
        require(owner == msg.sender);
        _;
    }

    modifier senderIsOwnerOrSigner() {
        require(signerMap[msg.sender] || owner == msg.sender);
        _;
    }

    modifier senderIsSigner() {
        require(signerMap[msg.sender]);
        _;
    }

    modifier senderIsSignerOrSelf() {
        require(signerMap[msg.sender] || msg.sender == address(this));
        _;
    }

    modifier senderIsNotSigner() {
        require(!signerMap[msg.sender]);
        _;
    }

    modifier isSigner(address addr) {
        require(signerMap[addr]);
        _;
    }

    modifier isNotSigner(address addr) {
        require(!signerMap[addr]);
        _;
    }

    /* check the txid is valid (using the nextTx counter) */
    modifier validTxID(uint16 txid) {
        require(txid < nextTx);
        _;
    }

    /*  Public Functions  */

    /**
     * @dev multi sign wallet constructor
     *
     * @param _signers All signers who can sign each TX(TX means transaction stored in this wallet).
     * @param  _requiredSign Minimum number of signs for TX to be run.
     * @param _playcoinAddr default contract(usually playcoin) address
     *
     */
    constructor (address[] _signers, uint8 _requiredSign, address _playcoinAddr) public {
        require(_signers.length >= 3 && _signers.length <= MAX_OWNER_COUNT);
        require(_requiredSign >= 2);

        uint i;
        for (i = 0; i < _signers.length; ++i) {
            // check signer repetition and validity
            require(_signers[i] != 0 && !signerMap[_signers[i]]);

            // add to map to make signership(?) check fast
            signerMap[_signers[i]] = true;
        }
        signers = _signers;

        requiredNoOfSign = _requiredSign;
        nextTx = 0;
        playcoinAddr = _playcoinAddr;
        owner = msg.sender;
        emit WalletCreated(owner, _playcoinAddr);
    }

    /**
      * @dev Fallback function allows to deposit ether.
      */
    function() public payable {
        emit QtumReceived(msg.sender, msg.value);
    }

    /**
      * @dev change playcoinAddr
      */
    function setPlayCoin(address _playcoinAddr) public senderIsOwner {
        address oldAddress = playcoinAddr;
        playcoinAddr = _playcoinAddr;

        emit PlayCoinChanged(oldAddress, playcoinAddr);
    }

    /**
      * @dev function to request a TX (i.e. transaction) to be signed and executed afterwards
      *
      * @param _abiData abi encoded function call data (i.e. encoded function name and parameters)
      * @param _description description to be stored in the TX structure
      */
    function requestTX(bytes _abiData, string _description) public senderIsSigner returns (uint16) {
        return requestTXWithContractAndExpiry(0, FOREVER, _abiData, _description);
    }

    /**
      * @dev function to request a TX (i.e. transaction) to be signed and executed afterwards
      *
      * @param _abiData abi encoded function call data (i.e. encoded function name and parameters)
      * @param _description description to be stored in the TX structure
      * @param _contractAddr the contract address to run
      */
    function requestTXWithContract(address _contractAddr, bytes _abiData, string _description)
    public
    senderIsSigner
    returns (uint16)
    {
        return requestTXWithContractAndExpiry(_contractAddr, FOREVER, _abiData, _description);
    }

    /**
      * @dev function to request a TX (i.e. transaction) to be signed and executed afterwards
      *
      * @param _contractAddr the contract address to run
      * @param _expiry when this TX will be expired (unit: secs after the UNIX epoch)
      * @param _abiData abi encoded function call data (i.e. encoded function name and parameters)
      * @param _description description to be stored in the TX structure

      */
    function requestTXWithContractAndExpiry(
        address _contractAddress,
        uint _expiry,
        bytes _abiData,
        string _description
    )
    public
    senderIsSigner
    returns (uint16)
    {
        require(_expiry > now + 1 days);
        // must provide at least 1 days expiry
        require(nextTx < 60000);
        // max 600000 tx

        uint16 txid = nextTx++;

        requestMap[txid].contractAddress = _contractAddress;
        requestMap[txid].description = _description;
        requestMap[txid].abiData = _abiData;
        requestMap[txid].executed = false;
        requestMap[txid].cancelled = false;
        requestMap[txid].confirmed = false;
        requestMap[txid].expiry = _expiry;

        requestSignMap[txid].push(msg.sender);

        emit TXRequested(txid, msg.sender, _contractAddress, _abiData, _description);
        emit TXSigned(txid, msg.sender, 1);
        // request a TX is also a signing that TX

        // It is not likely whole 16bit sequence number will be used up. But to make it sure.
        //if(nextTx>=60000) nextTx = 0;

        // 1 sign confirmation does not make transaction run, so we don't check anything in this function

        return txid;
    }

    // Any signer can run this to execute the (confirmed but not executed) TX.
    // For example, if this multi sign wallet contract does not have enough qtum for gas,
    // playcoinAddr.transfer will be fail with reason out of gas. Then the TX will remain
    // confirmed but not executed. Any signer can try to re-run the TX using this function
    // after send some gas fee to this contract.
    function runConfirmedTX(uint16 txid) public validTxID(txid) senderIsSigner returns(bool)
    {
        TXRequest storage request = requestMap[txid];
        require(!request.cancelled);
        require(!request.executed);
        require(request.confirmed);

        if(checkExpiry(request.expiry, txid)) {
            request.cancelled = true;
            emit TXCancelled(txid);
            return false;
        }

        // execute playcoinAddr or request.contractAddress method
        address cAddr = request.contractAddress == 0 ? playcoinAddr : request.contractAddress;
        request.executed = true;
        if(cAddr.call.value(0)(request.abiData)) {
            emit TXExecuted(txid);
            return true;
        } else {
            request.excuted = false;
            emit TXExecutionFailed(txid);
            return false;
        }
    }

    /**
     * @dev sign the txid-th TX
     *
     * If the TX becomes "confirmed" status, that will be executed also.
     */
    function signTX(uint16 txid) public validTxID(txid) senderIsSigner returns (uint8) {
        TXRequest storage request = requestMap[txid];

        if (checkExpiry(request.expiry, txid)) {
            request.cancelled = true;
            emit TXCancelled(txid);
            return 0;
        }

        address[] storage requestReject = requestRejectMap[txid];
        address[] storage requestSign = requestSignMap[txid];

        require(!request.cancelled);
        require(!request.executed);

        uint8 nSigned = 0;
        // number of signed person
        uint i;

        // check if sender is rejected already
        for (i = 0; i < requestReject.length; ++i) {
            require(requestReject[i] != msg.sender);
            // fail if the sender already rejected
        }

        // check if sender already signed and count all signed person
        for (i = 0; i < requestSign.length; ++i) {
            if (requestSign[i] == msg.sender) {
                require(false);
                // fail if already signed
            }
            ++nSigned;
        }

        // not already signed(otherwise the right above require would fail)
        // so push the sender to the signed array and increase nSigned counter
        requestSign.push(msg.sender);
        ++nSigned;

        emit TXSigned(txid, msg.sender, nSigned);

        // if signed enough, run the transfer
        if (nSigned >= requiredNoOfSign) {
            request.confirmed = true;
            // execute playcoinAddr or request.contractAddress method
            address cAddr = request.contractAddress == 0 ? playcoinAddr : request.contractAddress;
            if (cAddr.call.value(0)(request.abiData)) {
                request.executed = true;
                emit TXExecuted(txid);
            } else {
                emit TXExecutionFailed(txid);
            }
        }

        return nSigned;
    }

    /**
     * @dev reject txid-th TX
     *
     * If there aren't enough signer remaining to confirm the TX, TX will become cancelled status.
     */
    function rejectTX(uint16 txid) public senderIsSigner returns (uint8) {
        if (checkExpiry(request.expiry, txid)) {
            request.cancelled = true;
            emit TXCancelled(txid);
            return 0;
        }

        uint i;

        TXRequest storage request = requestMap[txid];
        address[] storage requestReject = requestRejectMap[txid];
        address[] storage requestSign = requestSignMap[txid];

        require(!request.cancelled);
        require(!request.confirmed);
        require(!request.executed);

        uint8 nRejected = 0;
        // number of person who rejected the transfer

        // check if sender is signed already
        for (i = 0; i < requestSign.length; ++i) {
            require(requestSign[i] != msg.sender);
            // fail if the sender already signed
        }

        // check if sender already rejected and count all person who rejected this transfer
        for (i = 0; i < requestReject.length; ++i) {
            if (requestReject[i] == msg.sender) {
                require(false);
                // fail if already rejected
            }
            ++nRejected;
        }

        // not already rejected(otherwise the right above require would fail)
        // so push the sender to the rejected array and increase nRejected counter
        requestReject.push(msg.sender);
        ++nRejected;

        emit TXRejected(txid, msg.sender);

        // if rejected enough, run the transfer
        if (nRejected > ((uint8)(signers.length)).sub(requiredNoOfSign)) {
            request.cancelled = true;
            emit TXCancelled(txid);
        }

        return nRejected;
    }

    function addSigner(address _newSigner)
    public
    callingSelf
    isNotSigner(_newSigner)
    {
        if (signers.length < MAX_OWNER_COUNT) {
            signers.push(_newSigner);
            signerMap[_newSigner] = true;
            emit SignerAdded(_newSigner);
        } else {
            emit SignerCannotAdd(_newSigner, "Cannot add a signer because of the max limit");
        }
    }

    /**
     * @dev remove a signer
     */
    function removeSigner(address _signer)
    public
    callingSelf
    isSigner(_signer)
    returns (bool)
    {
        uint8 l = signers.length;

        // The number of signer cannot be less than the required number of signs
        if (l == requiredNoOfSign) {
            emit SignerCannotRemoved(_signer, "cannot meet no of min signs.");
            return false;
        }

        uint16 i;

        // find the signer
        for (i = 0; i < l; ++i) {
            if (signers[i] == _signer) {
                break;
            }
        }
        emit DebugMsg1("found ", i);

        // We should be able to find the signer in the loop above.
        // So if i==l-1, _signer is the last element, so we do not need to do anything.
        // And if not move remaining elements a slot forward
        if (i < l.sub(1)) {
            for (++i; i < l; i++) {
                signers[i - 1] = signers[i];
                emit DebugMsg1A("moved", signers[i - 1]);
            }
        }
        // decrease array length
        signers.length--;
        signerMap[_signer] = false;
        emit SignerRemoved(_signer);
        return true;
    }


    /**
     * @dev remove a signer
     */
    function qtumBalance() public view senderIsOwnerOrSigner returns (uint) {
        return address(this).balance;
    }

    /**
     * @dev return the transaction status in txid-th TX
     *
     * Some client cannot parse structure storead as ABI. So, instead of returning whole structure at once,
     * this function returns n-tuple.
     */
    function viewTX(uint16 txid)
    public
    view
    validTxID(txid)
    senderIsSigner
    returns(string, address, bytes, bool, bool, bool, uint)
    {
        TXRequest memory request = requestMap[txid];
        return (
        request.description,
        request.contractAddress,
        request.abiData,
        request.executed,
        request.cancelled,
        request.confirmed,
        request.expiry
        );
    }

    /**
     * @dev returns list of addresses who reject the TX
     */
    function viewWhoRejectTX(uint16 txid) public view validTxID(txid) senderIsSigner returns (address[]) {
        return requestRejectMap[txid];
    }

    /**
     * @dev returns list of addresses who sign the TX
     */
    function viewWhoSignTX(uint16 txid) public view validTxID(txid) senderIsSigner returns (address[]) {
        return requestSignMap[txid];
    }

    /**
     * @dev returns how many TX stored in this contract
     */
    function getTxCount() public view returns (uint16) {
        return nextTx;
    }

    /**
     * @dev get the list of signers
     *
     * Only owner or signer can call this function
     */
    function getSigners() public view senderIsOwnerOrSigner returns (address[]) { return signers; }

    /* utility function to calculate time */
    function calcTime(uint time, uint year, uint week, uint day, uint hour, uint min)
    internal
    pure
    returns (uint)
    {
        return (time + year * (1 years) + week * (1 weeks) + day * (1 days) + hour * (1 hours) + min * (1 minutes));
    }

    /* check if now is after the expiry date */
    function checkExpiry(uint expiry, uint16 txid)
    internal
    returns (bool)
    {
        if (expiry < now) {
            emit TXExpired(txid, expiry);
            return true;
        } else {
            return false;
        }
    }
}
