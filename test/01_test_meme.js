const {  ethers,deployments,upgrades } = require("hardhat")
const { expect } = require("chai")
const fs = require("fs");
const path = require("path");


describe("test MemeToken", async function() {


    it("should deploy  MemeToken", async function() {

        const { deployer,user1,user2,user3,user4 } = await getNamedAccounts();
        const deployerSigner = await ethers.getSigner(deployer);
        const user1Signer = await ethers.getSigner(user1);
        const user2Signer = await ethers.getSigner(user2);
        const user3Signer = await ethers.getSigner(user3);
        const user4Signer = await ethers.getSigner(user4);

        console.log("deployer:",deployer)
        console.log("user1:",user1)
        console.log("user2:",user2)
        console.log("user3:",user3)
        console.log("user4:",user4)

        //部署MemeToken合约
        await deployments.fixture(["deployMemeToken"])

                 const wethData = await deployments.get("WETH9")
                 const wethContract = await ethers.getContractAt("WETH9",wethData.address,deployerSigner)
               //   const wethContract = new ethers.Contract(wethData.address, wethData.abi, deployerSigner);
                 console.log("[test01]WETH合约地址：",wethData.address)


                const erc20Data = await deployments.get("WERC20")
                 const erc20Contract = await ethers.getContractAt("WERC20",erc20Data.address,deployerSigner)
                 console.log("[test01]WERC20合约地址：",erc20Data.address)

                 const tokenData = await deployments.get("MemeToken")
                 const tokenContract = await ethers.getContractAt("MemeToken",tokenData.address,deployerSigner)
                 console.log("[test01]MemeToken合约地址：",tokenData.address)

                 let token0 = "";
                 let token1 = "";
                 let token0IsWETH = 0;
                 if(wethData.address<erc20Data.address){
                    token0 = wethData.address;
                    token1 = erc20Data.address;
                    token0IsWETH = 1;
                    console.log('---------token0 is WETH--------');
                 }else{
                    token0 = erc20Data.address;
                    token1 = wethData.address;
                    console.log('---------token0 is ERC20--------');
                 }

                let InitializePoolFilter = tokenContract.filters.InitializePool(token0, null, null, null);
                console.log('---------设置监听InitializePool事件--------');
                tokenContract.on(InitializePoolFilter, (res) => {
                  console.log('---------监听InitializePool事件输出start--------');
                  console.log('token0', res.args[0]);
                  console.log('token1', res.args[1]);
                  console.log('fee', res.args[2]);
                  console.log('tick', res.args[3]);
                  console.log('---------监听InitializePool事件输出end--------');
                }
                );

                  let IncreaseLiquidityFilter = tokenContract.filters.IncreaseLiquidity(null, null, null, null);
                console.log('---------设置监听IncreaseLiquidity事件--------');
                tokenContract.on(IncreaseLiquidityFilter, (res) => {
                  console.log('---------监听IncreaseLiquidity事件输出start--------');
                  console.log('tokenId', res.args[0]);
                  console.log('liquidity', res.args[1]);
                  console.log('amount0', res.args[2]);
                  console.log('amount1', res.args[3]);
                  console.log('---------监听IncreaseLiquidity事件输出end--------');
                }
                );
                
                
                await tokenContract.setToken0IsWETH(token0IsWETH);

                console.log('---------createAndInitializePoolIfNecessary start--------');
                const fee = 3000;
                //初始价格0.0001=1/10000=1*10^18/10000*10^18=10^14/10^22=10000*10^8/10^18
                const sqrtPriceX96 = 1//*Math.pow(2,96)///Math.sqrt(10000*Math.pow(10,18));
                console.log("sqrtPriceX96:",sqrtPriceX96)
                //初始化交易对
                const initTx = await tokenContract.createAndInitializePoolIfNecessary(
                    token0,token1,fee,sqrtPriceX96)
                const initReceipt = await initTx.wait()
                console.log('---------createAndInitializePoolIfNecessary end--------');
                const [factoryAddr, routerAddr, poolAddr] = await tokenContract.getInfo();
                console.log("[test01]factory,router,pool:",[factoryAddr, routerAddr, poolAddr])


               //user1存入ETH，兑换WETH
                wethContract.connect(user1Signer).deposit({value:300000});
                await wethContract.connect(user1Signer).approve(tokenData.address,100000);

                //给用户user1铸造10000个erc20代币
                const mintTx1 = await erc20Contract.connect(deployerSigner).mint(user1,100000)
                const mintReceipt1 = await mintTx1.wait()
               await erc20Contract.connect(user1Signer).approve(tokenData.address,100000);


                console.log("[test01]user1 weth balance:",await wethContract.balanceOf(user1))
                console.log("[test01]user1 erc20 balance:",await erc20Contract.balanceOf(user1))
                console.log("[test01]token0IsWETH:",token0IsWETH);

                //user1添加流动性
                const block = await ethers.provider.getBlock();
                const deadline = block.timestamp + 1000;
                const addLiqTx = await tokenContract.connect(user1Signer).mint(
                  {
                      token0: token0,
                      token1: token1,
                      fee: fee,
                      tickLower: -887220,
                      tickUpper: 887220,
                      amount0Desired: 10000,
                      amount1Desired: 10000,
                      amount0Min: 0,
                      amount1Min: 0,
                      recipient: user1,
                      deadline: deadline
                  }
                );

                // console.log("[test01]addLiqTx:",addLiqTx)
                const addLiqReceipt = await addLiqTx.wait()
                // console.log("[test01]addLiqReceipt:",addLiqReceipt)
                console.log("[test01]user1 weth balance:",await wethContract.balanceOf(user1))
                console.log("[test01]user1 erc20 balance:",await erc20Contract.balanceOf(user1))

       
              const poolData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),"utf-8")
              const poolAbi = JSON.parse(poolData).abi
              const poolBytecode = JSON.parse(poolData).bytecode 
              const poolContract = new ethers.Contract(poolAddr,poolAbi, deployerSigner);

               const slot0 = await poolContract.slot0();
               const pool_token0 = await poolContract.token0();
               const pool_token1 = await poolContract.token1();
               const pool_fee = await poolContract.fee();
              const  feeGrowthGlobal0X128 = await poolContract.feeGrowthGlobal0X128();
               const feeGrowthGlobal1X128 = await poolContract.feeGrowthGlobal1X128();
              const  pool_liquidity = await poolContract.liquidity();
              const tickSpacing = await poolContract.tickSpacing();
              const maxLiquidityPerTick = await poolContract.maxLiquidityPerTick();
              // const positions = await poolContract.positions();
              // const protocolFees = await poolContract.protocolFees();
              // const balance0 = await poolContract.balance0();
              // const balance1 = await poolContract.balance1();


               console.log("test01]pool.slot0:",slot0)
               
               console.log("test01]pool.token0:",pool_token0)
               console.log("test01]pool.token1:",pool_token1)
               console.log("test01]pool.fee:",pool_fee)

               console.log("test01]slot0.sqrtPriceX96:",slot0[0].toString())
                const bigNumber = BigInt(slot0[0]); // 将数字转换为BigInt
                const _price = bigNumber >> BigInt(96n); // 使用BigInt进行位移操作
               console.log("test01]_price:",_price)

               console.log("test01]slot0.tick:",slot0[1].toString())
               console.log("test01]slot0.observationIndex:",slot0[2].toString())
               console.log("test01]slot0.observationCardinality:",slot0[3].toString())
               console.log("test01]slot0.observationCardinalityNext:",slot0[4].toString())
               console.log("test01]slot0.locked:",slot0[5].toString())

               console.log("test01]pool.feeGrowthGlobal0X128:",feeGrowthGlobal0X128)
               console.log("test01]pool.feeGrowthGlobal1X128:",feeGrowthGlobal1X128)
               console.log("test01]pool.liquidity:",pool_liquidity)
               console.log("test01]pool.tickSpacing:",tickSpacing)
               console.log("test01]pool.maxLiquidityPerTick:",maxLiquidityPerTick)
              //  console.log("test01]pool.positions:",positions)
              //  console.log("test01]pool.protocolFees:",protocolFees)
              // console.log("test01]pool.balance0:",balance0)
              // console.log("test01]pool.balance1:",balance1)


        });



})