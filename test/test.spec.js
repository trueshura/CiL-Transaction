const {describe, it} = require('mocha');
const {assert} = require('chai');
const Transaction = require('../');
const Crypto = require("../transaction/crypto");

let keyPair;
let privateKey;
let publicKey;

const pseudoRandomBuffer = (length = 32) => {
    const pseudoRandomBytes = Buffer.allocUnsafe(length);

    // this will prevent all zeroes buffer (it will make tx invalid
    pseudoRandomBytes[0] = parseInt(Math.random() * 255);
    return pseudoRandomBytes;
};

const generateAddress = () => {
    return pseudoRandomBuffer(20);
};

const createDummyTx = (hash, conciliumId) => {
    return {
        payload: {
            ins: [{txHash: hash ? hash : pseudoRandomBuffer(), nTxOutput: parseInt(Math.random() * 1000) + 1}],
            outs: [{amount: parseInt(Math.random() * 1000) + 1, receiverAddr: generateAddress()}],
            conciliumId: conciliumId !== undefined ? conciliumId : 0
        },
        claimProofs: [pseudoRandomBuffer()]
    };
};
describe('Transaction tests', () => {
    before(function() {
        keyPair = Crypto.createKeyPair();
        privateKey = keyPair.getPrivate();
        publicKey = keyPair.getPublic();
    });

    it('should create empty transaction', async () => {
        const wrapper = () => new Transaction();
        assert.doesNotThrow(wrapper);
    });

    it('should create transaction from Object', async () => {
        new Transaction(createDummyTx());
    });

    it('should calculate hash', async () => {
        const tx = new Transaction(createDummyTx());
        const hash = tx.hash();
        assert.isOk(typeof hash === 'string');
        assert.equal(hash.length, 64);
    });

    it('should FAIL to parse random bytes', async () => {
        assert.throws(() => new Transaction(Buffer.allocUnsafe(100)));
    });

    it('should add input', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 1);
        assert.isOk(tx._data.payload.ins);
        assert.equal(tx._data.payload.ins.length, 1);
    });

    it('should add output (receiver)', async () => {
        const tx = new Transaction();
        tx.addReceiver(100, Buffer.allocUnsafe(20));
        assert.isOk(tx._data.payload.outs);
        assert.equal(tx._data.payload.outs.length, 1);
    });

    it('should change hash upon changes', async () => {
        const tx = new Transaction();
        const hash = tx.hash();

        tx.addInput(pseudoRandomBuffer(), 1);
        const inHash = tx.hash();
        assert.notEqual(hash, inHash);

        tx.addReceiver(100, Buffer.allocUnsafe(20));
        assert.notEqual(inHash, tx.hash());
    });

    it('should sign it', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(100, Buffer.allocUnsafe(20));
        tx.claim(0, keyPair.privateKey);``
        assert.isOk(Array.isArray(tx._data.claimProofs));
        assert.equal(tx._data.claimProofs.length, 1);
        assert.isOk(Buffer.isBuffer(tx._data.claimProofs[0]));

        assert.isOk(Crypto.verify(tx.hash(), tx._data.claimProofs[0], keyPair.publicKey));
    });

    it('should FAIL to sign (missed PK) ', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(100, Buffer.allocUnsafe(20));
        const wrapper = () => tx.claim(0);
        assert.throws(wrapper);
    });

    it('should FAIL to sign (wrong index) ', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(100, Buffer.allocUnsafe(20));
        const wrapper = () => tx.claim(2, keyPair.privateKey);
        assert.throws(wrapper);
    });

    it('should FAIL to modify after signing it', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.claim(0, keyPair.privateKey);
        const wrapper = () => tx.addInput(pseudoRandomBuffer(), 1);
        assert.throws(wrapper);
    });

    it('should encode/decode', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 15);
        tx.addReceiver(1117, Buffer.allocUnsafe(20));
        tx.claim(0, keyPair.privateKey);
        const buffEncoded = tx.encode();
        const recoveredTx = new Transaction(buffEncoded);
        assert.isOk(recoveredTx.equals(tx));
    });

    it('should test setters/getters', async () => {
        const tx = new Transaction();
        tx.conciliumId = 17;
        const [input1, input2] = [pseudoRandomBuffer(), pseudoRandomBuffer()];
        tx.addInput(input1, 15);
        tx.addInput(input2, 11);
        tx.addReceiver(1117, Buffer.allocUnsafe(20));

        assert.equal(tx.conciliumId, 17);
        assert.isOk(tx.inputs && tx.inputs.length === 2);
        assert.isOk(tx.outputs && tx.outputs.length === 1);
        assert.isNotOk(tx.claimProofs.length);

        const keyPair = Crypto.createKeyPair();
        tx.claim(0, keyPair.privateKey);
        assert.isOk(tx.claimProofs.length);

        const arrUtxos = tx.utxos;
        assert.isOk(input1.equals(arrUtxos[0]));
        assert.isOk(input2.equals(arrUtxos[1]));
    });

    it('should change hash upon modification', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 15);
        tx.addReceiver(1117, Buffer.allocUnsafe(20));
        const hash = tx.hash();

        tx.addInput(pseudoRandomBuffer(), 15);
        assert.notEqual(hash, tx.hash());
    });

    it('should fail signature check upon modification', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 15);
        tx.addReceiver(1117, Buffer.allocUnsafe(20));
        tx.claim(0, keyPair.privateKey);

        tx._data.payload.ins[0].nTxOutput = 1;

        assert.isNotOk(Crypto.verify(tx.hash(), tx._data.claimProofs[0], keyPair.publicKey));
    });

    it('should fail to verify: no claimProof for input0', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 15);

        assert.throws(() => tx.verify());
    });

    it('should fail to verify: zero tx', async () => {
        const tx = new Transaction();
        tx.addInput(Buffer.alloc(32), 15);

        assert.throws(() => tx.verify());
    });

    it('should fail to verify: negative tx index', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), -1);

        assert.throws(() => tx.verify());
    });

    it('should fail to verify: zero amount', async () => {
        const tx = new Transaction();
        tx.addReceiver(0, Buffer.allocUnsafe(20));

        assert.throws(() => tx.verify());
    });

    it('should verify', async () => {
        const tx = new Transaction();
        tx.conciliumId = 0;
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.addReceiver(1, Buffer.allocUnsafe(20));
        tx.claim(0, keyPair.privateKey);

        assert.doesNotThrow(() => tx.verify());
    });

    it('should FAIL to verify tx: verification failed during decoding from buffer', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 15);

        const buffEncodedTx = tx.encode();
        const txRestored = new Transaction(buffEncodedTx);
        assert.throws(() => txRestored.verify());
    });

    it('should FAIL to verify tx: verification failed during creating from Object', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 17);

        const txRestored = new Transaction(tx.rawData);
        assert.throws(() => txRestored.verify());
    });
    it('should get utxos from tx', async () => {
        const tx = new Transaction();
        const utxo = pseudoRandomBuffer();
        tx.addInput(utxo, 15);

        assert.isOk(Array.isArray(tx.utxos));
        assert.isOk(utxo.equals(tx.utxos[0]));
    });

    it('should recover pubkey from signature', async () => {
        const keyPair = Crypto.createKeyPair();

        const tx = new Transaction();
        const utxo = pseudoRandomBuffer();
        tx.addInput(utxo, 15);
        tx.claim(0, keyPair.privateKey);

        const pubKey = Crypto.recoverPubKey(tx.hash(), tx.claimProofs[0]);
        assert.equal(pubKey, keyPair.publicKey);
    });

    it('should create coinbase', async () => {
        const coinbase = Transaction.createCoinbase();
        assert.isOk(coinbase.isCoinbase());
    });

    it('should count OUT coins of TX', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.addReceiver(1, Buffer.allocUnsafe(20));
        tx.addReceiver(2, Buffer.allocUnsafe(20));
        tx.addReceiver(4, Buffer.allocUnsafe(20));
        tx.addReceiver(8, Buffer.allocUnsafe(20));

        assert.equal(tx.amountOut(), 15);

        tx.addReceiver(5, Buffer.allocUnsafe(20));
        assert.equal(tx.amountOut(), 20);
    });

    it('should be NON contractCreation (receiver)', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(1, pseudoRandomBuffer(20));

        assert.isNotOk(tx.isContractCreation());
    });
    it('should be contractCreation (2 outputs)', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(1, Crypto.getAddrContractCreation());
        tx.addReceiver(1, pseudoRandomBuffer(20));

        assert.isOk(tx.isContractCreation());
    });
    it('should be contractCreation', async () => {
        const tx = new Transaction();
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.addInput(pseudoRandomBuffer(), 1);
        tx.addReceiver(1, Crypto.getAddrContractCreation());

        assert.isOk(tx.isContractCreation());
    });
    it('should createContract TX', async () => {
        const tx = Transaction.createContract('', generateAddress());
        assert.isOk(tx.isContractCreation());
    });
    it('should get code', async () => {
        const strCode = 'var a=0;';
        const tx = Transaction.createContract(strCode, generateAddress());
        const strGotCode = tx.getContractCode();

        assert.equal(strCode, strGotCode);
    });

    it('should VERIFY tx with contract invocation', async () => {
        const kp = Crypto.createKeyPair();
        const objCode = {};
        const tx = Transaction.invokeContract(
            generateAddress().toString('hex'),
            objCode,
            0
        );

        // spend witness2 coins (WHOLE!)
        tx.addInput(pseudoRandomBuffer(), 0);
        tx.claim(0, kp.privateKey);

        tx.verify();
    });

    it('should get amount sent to contract', async () => {
        const tx = Transaction.invokeContract(
            generateAddress().toString('hex'),
            {},
            100
        );
        tx.addReceiver(1000, generateAddress());
        tx.addReceiver(2000, generateAddress());

        assert.equal(tx.getContractSentAmount(), 100);
    });

    it('should sign whole Tx (for contract usage)', async () => {
        const kp = Crypto.createKeyPair();
        const tx = new Transaction(createDummyTx());
        tx.signForContract(kp.privateKey);

        assert.equal(tx.getTxSignerAddress(), kp.address);

        assert.throws(tx._checkDone);
    });

    it('should get empty address (empty tx)', async () => {
        const tx = new Transaction();

        assert.equal(tx.getTxSignerAddress(), undefined);
    });

    it('should get empty address (no signature)', async () => {
        const tx = new Transaction(createDummyTx());

        assert.equal(tx.getTxSignerAddress(), undefined);
    });

    it('should get empty address (random bytes as signature)', async () => {
        const tx = new Transaction(createDummyTx());
        tx._data.txSignature = pseudoRandomBuffer();

        assert.equal(tx.getTxSignerAddress(), undefined);
    });

    it('should get Contract Address', async () => {
        const buffAddr = generateAddress();
        const tx = Transaction.invokeContract(
            buffAddr.toString('hex'),
            {},
            100
        );

        assert.isOk(buffAddr.equals(tx.getContractAddr()));
    });
});

// const tx = new Transaction(createDummyTx());
// console.log(tx)
// const hash = tx.hash();
// console.log(hash)
// const s = crypto.createHash('sha256').update(pseudoRandomBuffer(20)).digest().toString('hex');//(pseudoRandomBuffer(20))
// console.log(s)
// document.write('<h1>Hello World</h1>');
