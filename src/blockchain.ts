import * as CryptoJS from 'crypto-js';
import * as _ from 'lodash';
import { broadcastLatest, broadCastTransactionPool, connectToPeers } from './p2p';
import {
    getFigBaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTxOut
} from './transaction';
import { addToTransactionPool, getTransactionPool, updateTransactionPool } from './transactionPool';
import { createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromNodeWallet, createFromWalletTransaction } from './wallet';
import { BigNumber } from 'bignumber.js';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';


import moment = require('moment');

const blockchainLocation = 'node/blockchain/';
const peers = require("../node/peers/peers.json")
const nodesecretlocation = process.env.NODE_SECRET_LOCATION || 'node/wallet/node_secret';

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 8;
// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 1;
// min figing
const MIN_COIN_FOR_FIGING: number = 100000;

class Block {

    public index: number;
    public hash: string;
    public previousHash: string;
    public timestamp: number;
    public data: Transaction[];
    public difficulty: number;
    public figerBalance: number;
    public figerAddress: string;

    constructor(index: number, hash: string, previousHash: string,
        timestamp: number, data: Transaction[], difficulty: number, figerBalance: number, figerAddress: string) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.figerBalance = figerBalance;
        this.figerAddress = figerAddress;
    }
}


const genesisTransaction = {
    'txIns': [{ 'signature': '', 'txOutId': '', 'txOutIndex': 0 }],
    'txOuts': [{
        'address': 'tWzTTAFzNgGibTwPLSNxvEDVAAwKV9zPGdVzuyPvRWVn',
        'amount': 1
    }, {
        'address': 'tWzTTAFzNgGibTwPLSNxvEDVAAwKV9zPGdVzuyPvRWVn',
        'amount': 10000000
    }, {
        'address': '29zJUEdSeGESDf7NHXE5mDgg7WkHkcA2YqwGS9eYHG2yb',
        'amount': 10000000
    }, {
        'address': '27pTrhEEU1qJjD8KCXa1h4JZ8stAsZMagsmDjkwxVibns',
        'amount': 10000000
    }, {
        'address': '22PYANdRGoJ5GnfAGS3QJjn2u1pG1mhGrksPbdQYaqyyV',
        'amount': 1000000
    }],
    'id': 'a7998df5379f3133ec48b75b0db533d3b0e784ede170f2e09da42c38e9494828'
};


const genesisBlock: Block = new Block(
    0, 'daf7a68e52b35ec1e00f68e137ce7b7609dca13f6ffd5f324f6d4b3df96bc3f5', '', 734994001, [genesisTransaction], 0, 0, "tWzTTAFzNgGibTwPLSNxvEDVAAwKV9zPGdVzuyPvRWVn"
);


let blockchain: Block[] = [genesisBlock];

let unspentTxOuts: UnspentTxOut[] = processTransactions(blockchain[0].data, [], 0);

const getBlockchain = (): Block[] => blockchain;

const getBlockchainWithOffset = (
    offset: number,
    page: number
): { blocks: Block[]; totalBlocksSize: number } => {

    const totalBlocksSize: number = blockchain.length;

    let lastBlock: Block = blockchain.slice(-1)[0];
    let blockHeight = (lastBlock.index)
    let start = blockHeight + 1 - offset * page

    let blocks = blockchain.slice(start, start + page);
    blocks = blocks.sort((a, b) => b.index - a.index)

    return { blocks, totalBlocksSize };
};

const getLastBlock = (): Block => {
    let lastBlock: Block = blockchain.slice(-1)[0];
    return lastBlock;
};

const getNodeUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);


const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
    unspentTxOuts = newUnspentTxOut;
};

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];


const getDifficulty = (aBlockchain: Block[]): number => {
    const latestBlock: Block = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        if (prevAdjustmentBlock.difficulty <= 0) {
            return 0
        } else {
            return prevAdjustmentBlock.difficulty - 1;
        }
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

const generateFigNextBlock = (blockData: Transaction[]) => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = getDifficulty(getBlockchain());
    const nextIndex: number = previousBlock.index + 1;
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, blockData, difficulty);

    if (newBlock === null) {
        console.log("Node has not enough money to mine this block")
        return null;
    } else {
        if (addBlockToChain(newBlock)) {
            broadcastLatest();
            return newBlock;
        } else {
            console.log("error")
            return null;
        }
    }


};

const getMyUnspentTransactionOutputs = () => {
    return findUnspentTxOuts(getPublicFromNodeWallet(), getNodeUnspentTxOuts());
};

const generateNextBlock = () => {
    const coinbaseTx: Transaction = getFigBaseTransaction(getPublicFromNodeWallet(), getLatestBlock().index + 1);
    const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
    return generateFigNextBlock(blockData);
};

const generateNextBlockWithTransaction = (receiverAddress: string, amount: number, nodeSecret: string) => {
    const nodeSecretKey = readFileSync(nodesecretlocation, 'utf8').toString();
    if (nodeSecretKey !== nodeSecret) {
        throw Error('Invalid node secret');
    }

    if (!isValidAddress(receiverAddress)) {
        throw Error('Invalid address format');
    }
    if (typeof amount !== 'number' || amount <= 0) {
        throw Error('Invalid coin amount');
    }

    const tx: Transaction = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getNodeUnspentTxOuts(), getTransactionPool());
    const coinbaseTx: Transaction = getFigBaseTransaction(getPublicFromNodeWallet(), getLatestBlock().index + 1);
    const blockData: Transaction[] = [coinbaseTx, tx];
    return generateFigNextBlock(blockData);
};

const findBlock = (index: number, previousHash: string, data: Transaction[], difficulty: number): Block => {
    let pastTimestamp: number = 0;
    while (true) {
        let timestamp: number = getCurrentTimestamp();
        if (pastTimestamp !== timestamp) {
            if (getNodeBalance() <= MIN_COIN_FOR_FIGING) {

                return null
            } else {
                let hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, getNodeBalance(), getPublicFromNodeWallet());
                if (isBlockStakingValid(previousHash, getPublicFromNodeWallet(), timestamp, getNodeBalance(), difficulty, index)) {
                    return new Block(index, hash, previousHash, timestamp, data, difficulty, getNodeBalance(), getPublicFromNodeWallet());
                }
                pastTimestamp = timestamp;
            }
        }
    }
};

const getNodeBalance = (): number => {
    return getBalance(getPublicFromNodeWallet(), getNodeUnspentTxOuts());
};

const getFreeWalletBalance = (address: string): number => {
    return getBalance(address, getNodeUnspentTxOuts());
};

const sendTransactionToPool = (address: string, amount: number, nodeSecret: string): Transaction => {
    const nodeSecretKey = readFileSync(nodesecretlocation, 'utf8').toString();
    if (nodeSecretKey !== nodeSecret) {
        throw Error('Invalid node secret');
    }

    const tx: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getNodeUnspentTxOuts(), getTransactionPool());
    addToTransactionPool(tx, getNodeUnspentTxOuts());
    broadCastTransactionPool();
    return tx;
};

const sendFromWalletTransactionToPool = (publicKey: string, privateKey: string, toPublicKey: string, amount: number): Transaction => {

    const tx: Transaction = createFromWalletTransaction(publicKey, amount, privateKey, toPublicKey, getNodeUnspentTxOuts(), getTransactionPool());
    addToTransactionPool(tx, getNodeUnspentTxOuts());
    broadCastTransactionPool();
    return tx;
};

const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.figerBalance, block.figerAddress);

const calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
    difficulty: number, figerBalance: number, figerAddress: string): string => {
    const firstHash = CryptoJS.SHA512(index + previousHash + timestamp + data + difficulty + figerBalance + figerAddress).toString();
    const doubledHash = CryptoJS.SHA256(firstHash).toString();
    return doubledHash
}

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object'
        && typeof block.difficulty === 'number'
        && typeof block.figerBalance === 'number'
        && typeof block.figerAddress === 'string';
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('Invalid structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (!isValidFiger(newBlock.data)) {
        console.log('Invalid Node Balance');
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('Invalid Index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('Invalid Previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock.timestamp, previousBlock.timestamp)) {
        console.log('Invalid Timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const isValidTimestamp = (newTimestamp: number, previousTimestamp: number): boolean => {
    return (previousTimestamp - 60 < newTimestamp)
        && newTimestamp - 60 < getCurrentTimestamp();
};

const isValidFiger = (transactions: Transaction[]): boolean => {
    return getBalance(transactions[0].txOuts[0].address, getNodeUnspentTxOuts()) >= MIN_COIN_FOR_FIGING
};


const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log('invalid hash, got:' + block.hash);
        return false;
    }

    if (!isBlockStakingValid(block.previousHash, block.figerAddress, block.figerBalance, block.timestamp, block.difficulty, block.index)) {
        console.log('staking hash not lower than balance over diffculty times 2^256');
    }
    return true;
};

const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};



const isBlockStakingValid = (prevhash: string, address: string, timestamp: number, balance: number, difficulty: number, index: number): boolean => {
    difficulty = difficulty + 1;

    const balanceOverDifficulty = new BigNumber(2).exponentiatedBy(256).times(balance).dividedBy(difficulty);
    const stakingHash: string = CryptoJS.SHA256(prevhash + address + timestamp).toString();

    const decimalStakingHash = new BigNumber(stakingHash, 16);

    const difference = balanceOverDifficulty.minus(decimalStakingHash).toNumber();

    return difference >= 0;
};


const isValidChain = (blockchainToValidate: Block[]): UnspentTxOut[] => {
    console.log('isValidChain:');

    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    /*
    Tüm blockları valid mi kontrol ediyoruz.
     */
    let aUnspentTxOuts: UnspentTxOut[] = [];

    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock: Block = blockchainToValidate[i];
        if (i !== 0 && !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }

        aUnspentTxOuts = processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
        if (aUnspentTxOuts === null) {
            console.log('invalid transactions in blockchain');
            return null;
        }
    }
    return aUnspentTxOuts;
};

const addBlockToChain = (newBlock: Block): boolean => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal: UnspentTxOut[] = processTransactions(newBlock.data, getNodeUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log('block is not valid in terms of transactions');
            return false;
        } else {
            blockchain.push(newBlock);
            writeBlocksToFile(newBlock)
            setUnspentTxOuts(retVal);
            updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
    return false;
};

const writeBlocksToFile = (newBlock: Block): boolean => {
    const time = moment(new Date()).format("DDMMYYYY");
    const path = `${blockchainLocation}/${time}`
    if (!existsSync(path)) {
        mkdirSync(path);
    }
    writeFileSync(`${path}/${newBlock.index}`, JSON.stringify(newBlock));
    return true
}

const replaceBlockhainToFileSystem = (newBlocks: Block[]): boolean => {
    for (let index = 0; index < newBlocks.length; index++) {
        const newBlock = newBlocks[index];
        writeBlocksToFile(newBlock)
    }
    return true
}

const replaceChain = (newBlocks: Block[]) => {
    const aUnspentTxOuts = isValidChain(newBlocks);
    const validChain: boolean = aUnspentTxOuts !== null;

    if (validChain &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        setUnspentTxOuts(aUnspentTxOuts);
        updateTransactionPool(unspentTxOuts);
        broadcastLatest();
        replaceBlockhainToFileSystem(newBlocks)
    } else {
        console.log('Received blockchain invalid');
    }
};

const initConnections = () => {
    peers.map((item: string) => connectToPeers(item))
    console.log('peers added p2p port on: ' + peers);

}

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction, getNodeUnspentTxOuts());
};

export {
    Block, getBlockchain, getBlockchainWithOffset, getNodeUnspentTxOuts, getLatestBlock, sendTransactionToPool, sendFromWalletTransactionToPool,
    generateFigNextBlock, generateNextBlock, generateNextBlockWithTransaction, getFreeWalletBalance,
    handleReceivedTransaction, getMyUnspentTransactionOutputs, initConnections, getLastBlock,
    getNodeBalance, isValidBlockStructure, replaceChain, addBlockToChain, writeBlocksToFile
};
