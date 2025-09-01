// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;


import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {PoolAddress} from "./../lib/PoolAddress.sol";
import {PositionKey} from "./../lib/PositionKey.sol";
import {TickMath} from "./../lib/TickMath.sol";
import {LiquidityAmounts} from "./../lib/LiquidityAmounts.sol";
import {CallbackValidation} from "./../lib/CallbackValidation.sol";
import {IWETH9} from "./../interfaces/IWETH9.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract LiquidityManagement{



  

   



 //回调函数
    // function uniswapV3MintCallback(
    //     uint256 amount0Owed,
    //     uint256 amount1Owed,
    //     bytes calldata data
    // ) external {

    //     // MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
    //     // CallbackValidation.verifyCallback(factory, decoded.poolKey); 

    //     if(token0IsWETH == 1){
    //         if(amount0Owed > 0){
    //             IWETH9(_token0).transfer(msg.sender, amount0Owed);
    //         }
    //         if(amount1Owed > 0){
    //             IERC20(_token1).transferFrom(address(this), msg.sender, amount1Owed);
    //         }
    //     }else {
    //         if(amount0Owed > 0){
    //             IERC20(_token0).transferFrom(address(this), msg.sender, amount0Owed);
    //         }
    //         if(amount1Owed > 0){
    //             IWETH9(_token1).transfer(msg.sender, amount1Owed);
    //         }
    //     }
        
    // }



}