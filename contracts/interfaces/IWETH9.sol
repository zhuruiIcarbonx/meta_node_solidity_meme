// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

interface IWETH9 {
    function deposit() external payable;
    function transferFrom(address src, address dst, uint wad) external returns (bool);
    function withdraw(uint) external; 
}