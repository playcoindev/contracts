pragma solidity ^0.4.24;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

    function sub(uint8 a, uint8 b) internal constant returns (uint8) {
        assert(b <= a);
        return a - b;
    }

}