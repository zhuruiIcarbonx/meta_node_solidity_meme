const {  ethers,deployments,upgrades } = require("hardhat")
const { expect } = require("chai")
const fs = require("fs");
const path = require("path");


describe("test null MemeToken", async function() {


    
    it("should  deploy  factory positionmanager router  ", async function() {

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


        //部署WERC20
        const erc20Data = await deployments.get("WERC20")
        const erc20Contract = await ethers.getContractAt("WERC20",erc20Data.address,deployerSigner)
        console.log("[test02]WERC20合约地址：",erc20Data.address)

        //部署ETH9
        const wethData = fs.readFileSync(path.resolve(__dirname,"../json/WETH9.json"),"utf-8")
        const wethAbi = JSON.parse(wethData).abi
        const wethBytecode = JSON.parse(wethData).bytecode 
        const wethFactory = new ethers.ContractFactory(wethAbi,wethBytecode, deployerSigner);
        const weth = await wethFactory.deploy() 
        await weth.waitForDeployment();
        const wethAddress = weth.target
        console.log("[test02]wethContract合约地址：", wethAddress)


        console.log("开始部署factory合约...") 
        const factoryData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),"utf-8")
        const factoryAbi = JSON.parse(factoryData).abi
        const factoryBytecode = JSON.parse(factoryData).bytecode 
        // console.log("[test02]factory合约factoryAbi：", factoryAbi)
        const memeFactory = new ethers.ContractFactory(factoryAbi, factoryBytecode, deployerSigner);
        const factory = await memeFactory.deploy() 
        await factory.waitForDeployment();
        const factoryAddress = factory.target
        console.log("[test02]factory合约地址：", factoryAddress)


      


        console.log("[test02]开始部署positon合约...") 
        const positionData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),"utf-8")
        const positionAbi = JSON.parse(positionData).abi
        const positionBytecode = JSON.parse(positionData).bytecode
        const positionFactory = new ethers.ContractFactory(positionAbi, positionBytecode, deployerSigner);
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const position = await positionFactory.deploy(factoryAddress, wethAddress,nullAddress)
        await position.waitForDeployment();
        const positionAddress = position.target
        console.log("[test02]positionAddress合约地址：", positionAddress)
    
    
        console.log("[test02]开始部署Router合约...") 
        const routerData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),"utf-8")
        const routerAbi = JSON.parse(routerData).abi
        const routerBytecode = JSON.parse(routerData).bytecode 
        const routerFactory = new ethers.ContractFactory(routerAbi, routerBytecode, deployerSigner);
        const router = await routerFactory.deploy(factoryAddress, wethAddress)
        await router.waitForDeployment();
        const routerAddress = router.target
        console.log("[test02]Router合约地址：", routerAddress)



        let token0 = "";
        let token1 = "";
        let token0IsWETH = 0;
        if(wethAddress<erc20Data.address){
        token0 = wethAddress;
        token1 = erc20Data.address;
        token0IsWETH = 1;
        console.log('---------token0 is WETH--------');
        }else{
        token0 = erc20Data.address;
        token1 = wethAddress;
        console.log('---------token0 is ERC20--------');
        }

    let IncreaseLiquidityFilter = position.filters.IncreaseLiquidity(null, null, null, null);
    console.log('---------设置监听IncreaseLiquidity事件--------');
    position.on(IncreaseLiquidityFilter, (res) => {
        console.log('---------监听IncreaseLiquidity事件输出start--------');
        console.log('tokenId', res.args[0]);
        console.log('liquidity', res.args[1]);
        console.log('amount0', res.args[2]);
        console.log('amount1', res.args[3]);
        console.log('---------监听IncreaseLiquidity事件输出end--------');
    }
    );



        const provider = new ethers.WebSocketProvider("ws://127.0.0.1:8545");
        const iface = new ethers.Interface(positionAbi)
            // [
            // "function createAndInitializePoolIfNecessary(address token0, address token1,uint24 fee,uint160 sqrtPriceX96) external payable returns (address pool)",
            // ])

        const selector = iface.getFunction("createAndInitializePoolIfNecessary").selector
        console.log(`函数选择器是${selector}`)

        function handleBigInt(key, value) {
            if (typeof value === "bigint") {
                return value.toString() + "n"; // or simply return value.toString();
            }
        return value;
        }

        provider.on('pending', async (txHash) => {
            const tx = await provider.getTransaction(txHash);
            if (tx && tx.data.startsWith(selector)) {
                const decoded = iface.parseTransaction(tx);
                console.log("decoded:", decoded);
                console.log("token0:", decoded.args[0]);
                console.log("token1:", decoded.args[1]);
                console.log("fee:", decoded.args[2]);
                console.log("sqrtPriceX96:", decoded.args[3]);
                // console.log("pool:", decoded.args[4]);
            }
        });

        // provider.on('pending', async (txHash) => {
        // if (txHash) {
        //     const tx = await provider.getTransaction(txHash)
        //     j++
        //     console.log(`j===============`,j)
        //     if (tx !== null && tx.data.indexOf(selector) !== -1) {
        //         console.log(`[${(new Date).toLocaleTimeString()}]监听到第${j + 1}个pending交易:${txHash}`)
        //         console.log(`打印解码交易详情:${JSON.stringify(iface.parseTransaction(tx), handleBigInt, 2)}`)
        //         console.log(`转账目标地址:${iface.parseTransaction(tx).args[0]}`)
        //         console.log(`转账金额:${ethers.formatEther(iface.parseTransaction(tx).args[1])}`)
        //         provider.removeListener('pending', this)
        //     }
        // }})


        
        //创建
        console.log('---------createAndInitializePoolIfNecessary start--------');
        const fee = 3000;
        const sqrtPriceX96 = BigInt(1) << BigInt(96);
        console.log("sqrtPriceX96:",sqrtPriceX96)
        //初始化交易对
        const initTx = await position.createAndInitializePoolIfNecessary(
            token0,token1,fee,sqrtPriceX96)
        const initReceipt = await initTx.wait()
        console.log('initReceipt-------', initReceipt);
        console.log('initReceipt.logs[0].data:', initReceipt.logs[0].data);
        // const [result] = ethers.utils.defaultAbiCoder.decode(['address'], initReceipt.logs[0].data);
   
       
        const poolData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),"utf-8")
        const poolAbi = JSON.parse(poolData).abi
        const poolBytecode = JSON.parse(poolData).bytecode 
        const poolAddress = initReceipt.logs[0].data.substring(initReceipt.logs[0].data.length-40)
        const pool = await ethers.getContractAt(poolAbi,"0x"+poolAddress,deployerSigner)
        console.log("[test02]pool合约地址：","0x"+poolAddress)
        // await pool.slot0()
        const _sqrtPriceX96 = await pool.slot0()
         console.log("[test02]_sqrtPriceX96：",_sqrtPriceX96)


// 0xc0F115A19107322cFBf1cDBC7ea011C19EbDB4F8
// 000f7691b1b23a009be9052becb386dec74842575d
// 0032e34de819fc42d29efeefd4115e1063bc8c1575


    });



})