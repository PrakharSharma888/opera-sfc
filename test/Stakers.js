const {
    BN,
    ether,
    expectRevert,
    time,
    balance,
} = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const TestStakers = artifacts.require('TestStakers');

contract('Staker test', async ([firstStaker, secondStaker, thirdStaker, firstDepositor, secondDepositor]) => {
    beforeEach(async () => {
        this.firstEpoch = 0;
        this.stakers = await TestStakers.new(this.firstEpoch);
    });

    it('checking Staker parameters', async () => {
        expect(await this.stakers.minValidationStake.call()).to.be.bignumber.equal(ether('1.0'));
        expect(await this.stakers.minDelegation.call()).to.be.bignumber.equal(ether('1.0'));
        expect(await this.stakers.percentUnit.call()).to.be.bignumber.equal(new BN('1000000'));
        expect(await this.stakers.maxDelegatedMeRatio.call()).to.be.bignumber.equal(new BN('15000000'));
        expect(await this.stakers.validatorCommission.call()).to.be.bignumber.equal(new BN('150000'));
        expect(await this.stakers.vStakeLockPeriodTime.call()).to.be.bignumber.equal(new BN('86400').mul(new BN('7')));
        expect(await this.stakers.vStakeLockPeriodEpochs.call()).to.be.bignumber.equal(new BN('3'));
        expect(await this.stakers.deleagtionLockPeriodTime.call()).to.be.bignumber.equal(new BN('86400').mul(new BN('7')));
        expect(await this.stakers.deleagtionLockPeriodEpochs.call()).to.be.bignumber.equal(new BN('3'));
    });

    it('checking createVStake function', async () => {
        expect(await this.stakers.vStakersNum.call()).to.be.bignumber.equal(new BN('0'));
        await this.stakers._createVStake({from: firstStaker, value: ether('2.0')});
        await this.stakers._createVStake({from: secondStaker, value: ether('1.01')});
        await expectRevert(this.stakers._createVStake({from: thirdStaker, value: ether('0.99') }), 'insufficient amount');
        await expectRevert(this.stakers._createVStake({from: firstStaker}), 'staker already exists');

        expect(await this.stakers.vStakersNum.call()).to.be.bignumber.equal(new BN('2'));
        expect(await this.stakers.vStakeTotalAmount.call()).to.be.bignumber.equal(ether('3.01'));
        expect(await this.stakers.vStakersLastID.call()).to.be.bignumber.equal(new BN('2'));

        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        let secondStakerID = await this.stakers.vStakerIDs(secondStaker);
        expect(firstStakerID).to.be.bignumber.equal(new BN('1'));
        expect(secondStakerID).to.be.bignumber.equal(new BN('2'));

        expect((await this.stakers.vStakers.call(firstStakerID)).stakeAmount).to.be.bignumber.equal(ether('2.0'));
        expect((await this.stakers.vStakers.call(firstStakerID)).createdEpoch).to.be.bignumber.equal(new BN('1'));
        expect((await this.stakers.vStakers.call(firstStakerID)).stakerAddress).to.equal(firstStaker);

        expect((await this.stakers.vStakers.call(secondStakerID)).stakeAmount).to.be.bignumber.equal(ether('1.01'));
        expect((await this.stakers.vStakers.call(secondStakerID)).createdEpoch).to.be.bignumber.equal(new BN('1'));
        expect((await this.stakers.vStakers.call(secondStakerID)).stakerAddress).to.equal(secondStaker);
    });

    it('checking increaseVStake function', async () => {
        await this.stakers._createVStake({from: firstStaker, value: ether('2.0')});
        await this.stakers.increaseVStake({from: firstStaker, value: ether('1.0')});
        await this.stakers.increaseVStake({from: firstStaker, value: ether('1.0')});
        await this.stakers.increaseVStake({from: firstStaker, value: ether('1.0')});
        await expectRevert(this.stakers.increaseVStake({from: secondStaker, value: ether('1.0') }), "staker doesn't exist");

        let firstStakerID = await this.stakers.vStakerIDs(firstStaker)

        expect(await this.stakers.vStakeTotalAmount.call()).to.be.bignumber.equal(ether('5.0'));
        expect((await this.stakers.vStakers.call(firstStakerID)).stakeAmount).to.be.bignumber.equal(ether('5.0'));
    });

    it('checking createDelegation function', async () => {
        const getDeposition = async (depositor) => this.stakers.delegations.call(depositor);
        const getStaker = async (stakerID) => this.stakers.vStakers.call(stakerID);

        await this.stakers._createVStake({from: firstStaker, value: ether('2.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        let secondStakerID = new BN('2');
        let zeroStakerID = new BN('2');

        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('1.0')});
        await expectRevert(this.stakers.createDelegation(secondStakerID, {from: secondDepositor, value: ether('1.0')}), "staker doesn't exist");
        await expectRevert(this.stakers.createDelegation(zeroStakerID, {from: secondDepositor, value: ether('1.0')}), "staker doesn't exist");
        await expectRevert(this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('0.99')}), 'insufficient amount');
        await expectRevert(this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('29.01')}), "staker's limit is exceeded");
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('29.0')});

        const now = await time.latest();

        const firstDepositionEntity = await getDeposition(firstDepositor);
        const firstStakerEntity = await getStaker(firstStakerID);
        expect(firstDepositionEntity.amount).to.be.bignumber.equal(ether('1'));
        expect(firstDepositionEntity.createdEpoch).to.be.bignumber.equal(new BN('1'));
        expect(now.sub(firstDepositionEntity.createdTime)).to.be.bignumber.lessThan(new BN('5'));
        expect(firstDepositionEntity.toStakerID).to.be.bignumber.equal(firstStakerID);

        const secondDepositionEntity = await getDeposition(secondDepositor);
        expect(secondDepositionEntity.amount).to.be.bignumber.equal(ether('29'));
        expect(secondDepositionEntity.createdEpoch).to.be.bignumber.equal(new BN('1'));
        expect(now.sub(secondDepositionEntity.createdTime)).to.be.bignumber.lessThan(new BN('2'));
        expect(secondDepositionEntity.toStakerID).to.be.bignumber.equal(firstStakerID);

        expect(firstStakerEntity.delegatedMe).to.be.bignumber.equal(ether('30.0'));
        expect(await this.stakers.delegationsTotalAmount.call()).to.be.bignumber.equal(ether('30.0'));
        expect(await this.stakers.delegationsNum.call()).to.be.bignumber.equal(new BN('2'));
    });

    it('checking calcTotalReward function', async () => {
        await expectRevert(this.stakers._calcTotalReward(new BN('1'), new BN('1')), "total validating power can't be zero");
        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('10.0')});

        await this.stakers._createVStake({from: secondStaker, value: ether('1.0')});
        let secondStakerID = await this.stakers.vStakerIDs(secondStaker);
        await this.stakers._makeEpochSnapshots(10000);

        expect(await this.stakers._calcTotalReward(firstStakerID, new BN('1'))).to.be.bignumber.equal(ether('0.5000000000000025'));
        expect(await this.stakers._calcTotalReward(secondStakerID, new BN('1'))).to.be.bignumber.equal(ether('1.5000000000000075'));
    });

    it('checking calcValidatorReward function', async () => {
        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('10.0')});

        await this.stakers._createVStake({from: secondStaker, value: ether('1.0')});
        let secondStakerID = await this.stakers.vStakerIDs(secondStaker);
        await this.stakers._makeEpochSnapshots(10000);

        expect(await this.stakers._calcValidatorReward(firstStakerID, new BN('1'))).to.be.bignumber.equal(ether('0.101562500000000507'));
        expect(await this.stakers._calcValidatorReward(secondStakerID, new BN('1'))).to.be.bignumber.equal(ether('1.5000000000000075'));

    });

    it('checking calcDelegatorReward function', async () => {
        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('10.0')});

        await this.stakers._createVStake({from: secondStaker, value: ether('1.0')});
        let secondStakerID = await this.stakers.vStakerIDs(secondStaker);
        await this.stakers._makeEpochSnapshots(10000);

        expect(await this.stakers._calcDelegatorReward(firstStakerID, new BN('1'), ether('15.0'))).to.be.bignumber.equal(ether('0.398437500000001992'));
    });

    it('checking claimDelegationReward function', async () => {
        await expectRevert(this.stakers.claimDelegationReward(new BN('0'), new BN('1'), {from: firstDepositor}), 'delegation doesn\'t exist');

        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});

        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('10.0')});
        await this.stakers._makeEpochSnapshots(10000);

        await expectRevert(this.stakers.claimDelegationReward(new BN('3'), new BN('1'), {from: firstDepositor}), 'invalid fromEpoch');
        await expectRevert(this.stakers.claimDelegationReward(new BN('0'), new BN('3'), {from: firstDepositor}), 'invalid untilEpoch');

        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('16.0'));
        const balanceBefore = await balance.current(firstDepositor);

        await this.stakers.claimDelegationReward(new BN('0'), new BN('0'), {from: firstDepositor});
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('14.052083333333323594')); // 16 - 0.531250000000002656
        await expectRevert(this.stakers.claimDelegationReward(new BN('0'), new BN('0'), {from: firstDepositor}), 'invalid fromEpoch');
        const balanceAfter = await balance.current(firstDepositor);
        expect(balanceAfter.sub(balanceBefore)).to.be.bignumber.equal(ether('1.946147546666676406')); // 0.531250000000002656 - tx fee

        await this.stakers.prepareToWithdrawDelegation({from: firstDepositor});
        await expectRevert(this.stakers.claimDelegationReward(new BN('0'), new BN('0'), {from: firstDepositor}), "delegation shouldn't be deactivated yet");
    });

    it('checking claimValidatorReward function', async () => {
        await expectRevert(this.stakers.claimValidatorReward(new BN('0'), new BN('1'), {from: firstStaker}), 'staker doesn\'t exist');

        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});

        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('10.0')});
        await this.stakers._makeEpochSnapshots(10000);

        await expectRevert(this.stakers.claimValidatorReward(new BN('3'), new BN('1'), {from: firstStaker}), 'invalid fromEpoch');
        await expectRevert(this.stakers.claimValidatorReward(new BN('0'), new BN('3'), {from: firstStaker}), 'invalid untilEpoch');

        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('16.0'));
        const balanceBefore = await balance.current(firstStaker);

        await this.stakers.claimValidatorReward(new BN('0'), new BN('0'), {from: firstStaker});
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('15.010416666666661719')); // 16 - 0.406250000000002031
        await expectRevert(this.stakers.claimValidatorReward(new BN('0'), new BN('0'), {from: firstStaker}), 'invalid fromEpoch');
        const balanceAfter = await balance.current(firstStaker);
        expect(balanceAfter.sub(balanceBefore)).to.be.bignumber.equal(ether('0.987872873333338281')); // 0.406250000000002031 - tx fee
    });

    it('checking prepareToWithdrawVStake function', async () => {
        const getStaker = async (stakerID) => this.stakers.vStakers.call(stakerID);

        let firstStakerID = new BN('1');
        await expectRevert(this.stakers.prepareToWithdrawVStake({from: firstStaker}), 'staker doesn\'t exist');
        const firstStakerEntityBefore = await getStaker(firstStakerID);
        expect(firstStakerEntityBefore.deactivatedEpoch).to.be.bignumber.equal(new BN('0'));
        expect(firstStakerEntityBefore.deactivatedTime).to.be.bignumber.equal(new BN('0'));

        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});

        const now = await time.latest();
        await this.stakers.prepareToWithdrawVStake({from: firstStaker});

        const firstStakerEntityAfter = await getStaker(firstStakerID);
        expect(firstStakerEntityAfter.deactivatedEpoch).to.be.bignumber.equal(new BN('1'));
        expect(now.sub(firstStakerEntityAfter.deactivatedTime)).to.be.bignumber.lessThan(new BN('5'));
        await expectRevert(this.stakers.prepareToWithdrawVStake({from: firstStaker}), "staker shouldn't be deactivated yet");
    });

    it('checking withdrawVStake function', async () => {
        await this.stakers._createVStake({from: firstStaker, value: ether('1.5')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers._createVStake({from: secondStaker, value: ether('1.5')});
        let secondStakerID = await this.stakers.vStakerIDs(secondStaker);

        await expectRevert(this.stakers.withdrawVStake({from: firstStaker}), 'staker wasn\'t deactivated');

        await this.stakers.prepareToWithdrawVStake({from: firstStaker});
        await this.stakers.prepareToWithdrawVStake({from: secondStaker});

        await expectRevert(this.stakers.withdrawVStake({from: firstStaker}), 'not enough time passed');
        time.increase(86400 * 7);
        await expectRevert(this.stakers.withdrawVStake({from: firstStaker}), 'not enough epochs passed');
        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers._makeEpochSnapshots(10000);

        expect(await this.stakers.vStakersNum.call()).to.be.bignumber.equal(new BN('2'));
        expect(await this.stakers.vStakeTotalAmount.call()).to.be.bignumber.equal(ether('3.0'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('3.0'));
        this.stakers.withdrawVStake({from: firstStaker});
        expect(await this.stakers.vStakersNum.call()).to.be.bignumber.equal(new BN('1'));
        expect(await this.stakers.vStakeTotalAmount.call()).to.be.bignumber.equal(ether('1.5'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('1.5'));
        await expectRevert(this.stakers.withdrawVStake({from: firstStaker}), 'staker wasn\'t deactivated');

        await this.stakers._markValidationStakeAsCheater(secondStakerID, true);
        this.stakers.withdrawVStake({from: secondStaker});
        expect(await this.stakers.vStakersNum.call()).to.be.bignumber.equal(new BN('0'));
        expect(await this.stakers.vStakeTotalAmount.call()).to.be.bignumber.equal(ether('0.0'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('1.5'));
    });

    it('checking prepareToWithdrawDelegation function', async () => {
        const getStaker = async (stakerID) => this.stakers.vStakers.call(stakerID);
        const getDeposition = async (depositor) => this.stakers.delegations.call(depositor);

        await expectRevert(this.stakers.prepareToWithdrawDelegation({from: firstDepositor}), 'delegation doesn\'t exist');
        const firstDepositorEntityBefore = await getDeposition(firstDepositor);
        expect(firstDepositorEntityBefore.deactivatedEpoch).to.be.bignumber.equal(new BN('0'));
        expect(firstDepositorEntityBefore.deactivatedTime).to.be.bignumber.equal(new BN('0'));

        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('5.0')});

        const firstStakerBefore = await getStaker(firstStakerID);
        expect(firstStakerBefore.delegatedMe).to.be.bignumber.equal(ether('5.0'));
        const now = await time.latest();
        await this.stakers.prepareToWithdrawDelegation({from: firstDepositor});
        const firstStakerAfter = await getStaker(firstStakerID);
        expect(firstStakerAfter.delegatedMe).to.be.bignumber.equal(ether('0.0'));

        const firstDepositorEntityAfter = await getDeposition(firstDepositor);
        expect(firstDepositorEntityAfter.deactivatedEpoch).to.be.bignumber.equal(new BN('1'));
        expect(now.sub(firstDepositorEntityAfter.deactivatedTime)).to.be.bignumber.lessThan(new BN('2'));
        await expectRevert(this.stakers.prepareToWithdrawDelegation({from: firstDepositor}), "delegation shouldn't be deactivated yet");
    });

    it('checking withdrawDelegation function', async () => {
        await this.stakers._createVStake({from: firstStaker, value: ether('1.0')});
        let firstStakerID = await this.stakers.vStakerIDs(firstStaker);
        await this.stakers.createDelegation(firstStakerID, {from: firstDepositor, value: ether('1.0')});
        await this.stakers.createDelegation(firstStakerID, {from: secondDepositor, value: ether('1.0')});

        await expectRevert(this.stakers.withdrawDelegation({from: firstDepositor}), 'delegation wasn\'t deactivated');

        await this.stakers.prepareToWithdrawDelegation({from: firstDepositor});
        await this.stakers.prepareToWithdrawDelegation({from: secondDepositor});

        await expectRevert(this.stakers.withdrawDelegation({from: firstDepositor}), 'not enough time passed');
        time.increase(86400 * 7);
        await expectRevert(this.stakers.withdrawDelegation({from: firstDepositor}), 'not enough epochs passed');
        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers._makeEpochSnapshots(10000);
        await this.stakers._makeEpochSnapshots(10000);

        expect(await this.stakers.delegationsNum.call()).to.be.bignumber.equal(new BN('2'));
        expect(await this.stakers.delegationsTotalAmount.call()).to.be.bignumber.equal(ether('2.0'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('3.0'));
        this.stakers.withdrawDelegation({from: firstDepositor});
        expect(await this.stakers.delegationsNum.call()).to.be.bignumber.equal(new BN('1'));
        expect(await this.stakers.delegationsTotalAmount.call()).to.be.bignumber.equal(ether('1.0'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('2.0'));
        await expectRevert(this.stakers.withdrawDelegation({from: firstDepositor}), 'delegation wasn\'t deactivated');

        await this.stakers._markValidationStakeAsCheater(firstStakerID, true);
        this.stakers.withdrawDelegation({from: secondDepositor});
        expect(await this.stakers.delegationsNum.call()).to.be.bignumber.equal(new BN('0'));
        expect(await this.stakers.delegationsTotalAmount.call()).to.be.bignumber.equal(ether('0.0'));
        expect(await balance.current(this.stakers.address)).to.be.bignumber.equal(ether('2.0'));
    });
});