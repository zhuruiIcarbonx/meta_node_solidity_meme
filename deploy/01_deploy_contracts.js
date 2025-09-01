const { deployments, upgrades } = require("hardhat")

const fs = require("fs")//filesystem
const path = require("path")



module.exports = async ({getNamedAccounts, deployments}) => {

    //用户deployer、user1、user2、user3、user4信息
    const {save} = deployments;
    const {deployer, user1, user2, user3, user4} = await getNamedAccounts();
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

    
    //部署合约
    console.log("开始部署合约...")

    //部署合约 WETH、MemeRouter、MemeFactory、MemeToken
    console.log("开始部署WETH合约...")
    // const wethData = fs.readFileSync(path.resolve(__dirname,"../json/WETH9.json"),"utf-8")
    // const wethAbi = JSON.parse(wethData).abi
    // const wethBytecode = JSON.parse(wethData).bytecode 
    // console.log("[01]WETH合约wethAbi：", wethAbi)
    // const wethFactory = new ethers.ContractFactory(wethAbi, wethBytecode, deployerSigner);
     const wethFactory = await ethers.getContractFactory("WETH9", deployerSigner)
    const weth = await wethFactory.deploy()
    await weth.waitForDeployment();
    const wethAddress = weth.target
    console.log("[01]WETH合约地址：", wethAddress)

       //保存合约地址
    await save("WETH9", {
        abi:wethFactory.interface.format("json"),
        address: wethAddress,
        // args:[],
        // log:true,    
    })


    const erc20Factory = await ethers.getContractFactory("WERC20", deployerSigner)
    const erc20 = await erc20Factory.deploy()
    await erc20.waitForDeployment();
    const erc20Address = erc20.target
    console.log("[01]ERC20合约地址：", erc20Address)

       //保存合约地址
    await save("WERC20", {
        abi:erc20Factory.interface.format("json"),
        address: erc20Address,
        // args:[],
        // log:true,    
    })


    console.log("开始部署MemeFactory合约...") 
    const factoryData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),"utf-8")
    const factoryAbi = JSON.parse(factoryData).abi
    const factoryBytecode = JSON.parse(factoryData).bytecode 
    console.log("[01]MemeFactory合约factoryAbi：", factoryAbi)
    const memeFactory = new ethers.ContractFactory(factoryAbi, factoryBytecode, deployerSigner);
    const factory = await memeFactory.deploy() 
    await factory.waitForDeployment();
    const memeFactoryAddress = factory.target
    console.log("[01]MemeFactory合约地址：", memeFactoryAddress)
 

    // console.log("开始部署Desc合约...") 
    // const descData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),"utf-8")
    // const descAbi = JSON.parse(descData).abi
    // const descBytecode = JSON.parse(descData).bytecode
    // const descFactory = new ethers.ContractFactory(descAbi, descBytecode, deployerSigner);
    // const desc = await descFactory.deploy(memeFactoryAddress, wethAddress)
    // await desc.waitForDeployment();
    // const descAddress = desc.target
    // console.log("[01]descAddress合约地址：", descAddress)


    // console.log("开始部署positon合约...") 
    // const positionData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),"utf-8")
    // const positionAbi = JSON.parse(positionData).abi
    // const positionBytecode = JSON.parse(positionData).bytecode
    // const positionFactory = new ethers.ContractFactory(positionAbi, positionBytecode, deployerSigner);
    // const position = await positionFactory.deploy(memeFactoryAddress, wethAddress)
    // await position.waitForDeployment();
    // const positionAddress = position.target
    // console.log("[01]positionAddress合约地址：", positionAddress)


    console.log("开始部署MemeRouter合约...") 
    const routerData = fs.readFileSync(path.resolve(__dirname,"../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),"utf-8")
    const routerAbi = JSON.parse(routerData).abi
    const routerBytecode = JSON.parse(routerData).bytecode 
    const memeRouterFactory = new ethers.ContractFactory(routerAbi, routerBytecode, deployerSigner);
    const router = await memeRouterFactory.deploy(memeFactoryAddress, wethAddress)
    await router.waitForDeployment();
    const memeRouterAddress = router.target
    console.log("[01]MemeRouter合约地址：", memeRouterAddress)


    
    console.log("开始部署MemeToken合约...")
    const memeTokenFactory = await ethers.getContractFactory("MemeToken", deployerSigner)
    const tokenProxy = await upgrades.deployProxy(memeTokenFactory,[memeFactoryAddress, memeRouterAddress],{
        initializer:"initialize",
        kind:"uups"
    })
    const codeSize = await tokenProxy.getBytecodeSize();
    console.log("[04]McodeSize：",codeSize)
    await tokenProxy.waitForDeployment();
    const tokenProxyAddress = await tokenProxy.getAddress()
    const tokenimplAddress = await upgrades.erc1967.getImplementationAddress(tokenProxyAddress)
    console.log("[04]MemeToken代理合约地址：",tokenProxyAddress)
    console.log("[04]MemeToken实际合约地址：",tokenimplAddress)




     //保存合约地址
    await save("MemeToken", {
        abi:memeTokenFactory.interface.format("json"),
        address: tokenProxyAddress,
        // args:[],
        // log:true,    
    })



    const storePath = path.resolve(__dirname,"./.cache/MemeToken.json")
    fs.writeFileSync(
        storePath,
        JSON.stringify({
            address: tokenProxyAddress,
            abi: memeTokenFactory.interface.format("json")
        })
    )



    }

module.exports.tags = ['deployMemeToken'];