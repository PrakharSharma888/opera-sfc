const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat')
const chai = require('chai');
const { expect, should } = require('chai');

describe("It should interact with the contract", function(){
    it("Should update the min stake", async()=>{
        const Contract = await ethers.getContractFactory("ConstantsManager")
        const contract = await Contract.deploy()
        await contract.deployed()

        console.log(contract.address);

        const init = await contract.initialize()
        await init.wait()
        // const stake = await contract.updateMinSelfStake("100000000000000000000000")
        // await stake.wait()
        const value = await contract.minSelfStake()
        console.log(value);
    })
})