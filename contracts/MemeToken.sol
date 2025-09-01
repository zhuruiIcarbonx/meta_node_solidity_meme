// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
// import {Lib} from  "./lib/Lib.sol";
import {IMemeToken} from "./interfaces/IMemeToken.sol";
import {PoolAddress} from "./lib/PoolAddress.sol";
import {PositionKey} from "./lib/PositionKey.sol";
import {TickMath} from "./lib/TickMath.sol";
import {LiquidityAmounts} from "./lib/LiquidityAmounts.sol";
// import {CallbackValidation} from "./lib/CallbackValidation.sol"; 
import {IWETH9} from "./interfaces/IWETH9.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MemeToken is Initializable, ERC721Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IMemeToken {
    

    address private pool;
    address private router;
    // address public WETH9;
    uint176 private _nextId;
    uint80 private _nextPoolId;
    mapping(uint256 => Position) private _positions;
    mapping(address => uint80) private _poolIds;// @dev IDs of pools assigned by this contract
    mapping(uint80 => PoolAddress.PoolKey) private _poolIdToPoolKey;// @dev Pool keys by pool ID, to save on SSTOREs for position data
     
    address private factory;
    address private _token0;
    address private _token1;
    uint24 private token0IsWETH;//token0IsWETH标志位，true表示token0是WETH，false表示token1是WETH
   
   

    function initialize(address _factory,address _router) public initializer {

        __MemeToken_init(_factory,_router);
    }

    function getInfo() public view returns(address _factory,address _router,address _pool){
        return (factory,router,pool);
    }

      function setToken0IsWETH (uint24 _token0IsWETH) external onlyOwner {
        token0IsWETH = _token0IsWETH;
    }


    function __MemeToken_init(address _factory,address _router) internal onlyInitializing {
    
        __ERC721_init("MemeToken", "MEME");
        __Ownable_init(msg.sender);
        factory = _factory;
        router = _router;
         _nextId = 1;
         _nextPoolId = 1;
        token0IsWETH = 0;
    }  

     function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

   
    // 部署前检查字节码大小
    function getBytecodeSize() public view returns (uint) {
        return address(this).code.length;
    }


    //创建流动性池
    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        int24 tick
    ) external payable  returns (address _pool) {
        require(token0 < token1,"<");
        _token0 = token0;
        _token1 = token1;   
        _pool = IUniswapV3Factory(factory).getPool(token0, token1, fee);
        
        emit InitializePool(token0, token1, fee, tick);
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick); 
        emit InitializePool(token0, token1, fee, tick);

        if (_pool == address(0)) {
            _pool = IUniswapV3Factory(factory).createPool(token0, token1, fee);
            IUniswapV3Pool(_pool).initialize(sqrtPriceX96);
        } else {
            (uint160 sqrtPriceX96Existing, , , , , , ) = IUniswapV3Pool(_pool).slot0();
            if (sqrtPriceX96Existing == 0) {
                IUniswapV3Pool(_pool).initialize(sqrtPriceX96);
            }
        }
        pool = _pool;
    }

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, 'Transaction too old');
        _;
    }

     function cachePoolKey(address _pool, PoolAddress.PoolKey memory poolKey) private returns (uint80 poolId) {
        poolId = _poolIds[_pool];
        if (poolId == 0) {
            _poolIds[_pool] = (poolId = _nextPoolId++);
            _poolIdToPoolKey[poolId] = poolKey;
        }
    }

   
    //创建流动性
   function mint(MintParams calldata params)
        external payable checkDeadline(params.deadline)
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        IUniswapV3Pool _pool;
        (liquidity, amount0, amount1, _pool) = addLiquidity(
            AddLiquidityParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                recipient: address(this),
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: params.amount0Desired,
                amount1Desired: params.amount1Desired,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min
            })
        );

        _mint(params.recipient, (tokenId = _nextId++));

        bytes32 positionKey = PositionKey.compute(address(this), params.tickLower, params.tickUpper);
        (, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, , ) = _pool.positions(positionKey);

        // idempotent set
        uint80 poolId =
            cachePoolKey(
                address(_pool),
                PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee})
            );

        _positions[tokenId] = Position({
            nonce: 0,
            operator: address(0),
            poolId: poolId,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            feeGrowthInside0LastX128: feeGrowthInside0LastX128,
            feeGrowthInside1LastX128: feeGrowthInside1LastX128,
            tokensOwed0: 0,
            tokensOwed1: 0
        });

        emit IncreaseLiquidity(tokenId, liquidity, amount0, amount1);
    }

    
    
    function addLiquidity(AddLiquidityParams memory params)
        internal 
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1,
            IUniswapV3Pool _pool
        )
    {
        PoolAddress.PoolKey memory poolKey =
            PoolAddress.PoolKey({token0: params.token0, token1: params.token1, fee: params.fee});

        _pool = IUniswapV3Pool(PoolAddress.computeAddress(factory, poolKey));

        // compute the liquidity amount
        {
            (uint160 sqrtPriceX96, , , , , , ) = _pool.slot0();
            uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
            uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

            liquidity = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                sqrtRatioAX96,
                sqrtRatioBX96,
                params.amount0Desired,
                params.amount1Desired
            );
        }

        (amount0, amount1) = _pool.mint(
            params.recipient,
            params.tickLower,
            params.tickUpper,
            liquidity,
            abi.encode(MintCallbackData({poolKey: poolKey, payer: msg.sender}))
        );

        require(amount0 >= params.amount0Min && amount1 >= params.amount1Min, 'Price slippage check');
    }


    function uniswapV3MintCallback(
        uint256 amount0Owed,
        uint256 amount1Owed,
        bytes calldata data
    ) external {

        MintCallbackData memory decoded = abi.decode(data, (MintCallbackData));
        // CallbackValidation.verifyCallback(factory, decoded.poolKey); 

        // if(token0IsWETH == 1){
            // if(amount0Owed > 0)IWETH9(_token0).transferFrom(decoded.payer, msg.sender, amount0Owed);
            // if(amount1Owed > 0)IERC20(_token1).transferFrom(decoded.payer, msg.sender, amount1Owed);
        // }else {
            if(amount0Owed > 0)IERC20(_token0).transferFrom(decoded.payer, msg.sender, amount0Owed);
            if(amount1Owed > 0)IWETH9(_token1).transferFrom(decoded.payer, msg.sender, amount1Owed);
        // }
        
    }

}