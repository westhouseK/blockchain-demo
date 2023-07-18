import _ from "lodash";
import moment from "moment";
import { sortedObjectByKey, convertToUtf8 } from "#/src/utils/index";
import { Block, Transaction } from "#/types/BlockchainServer";

import eccrypto from "eccrypto";
import crypto from "crypto";
import ping from "tcp-ping";
import axios from "axios";

const NEIGHBOR_PORT: number[] = _.times(3, (i) => 8001 + i);

export default class {
  private _transactions: Transaction[] = [];
  private _chain: Block[] = [];
  private _blockchainAddress?: string = undefined;
  private _neighbors: string[] = [];
  private _neighborHost?: string;
  private _port?: number = undefined;

  public get port(): number | undefined {
    return this._port;
  }

  public set port(value: number | undefined) {
    this._port = value;
  }

  public get neighborHost(): string | undefined {
    return this._neighborHost;
  }

  public set neighborHost(value: string | undefined) {
    this._neighborHost = value;
  }

  public get blockchainAddress(): string | undefined {
    return this._blockchainAddress;
  }

  public set blockchainAddress(value: string | undefined) {
    this._blockchainAddress = value;
  }

  public get neighbors(): string[] {
    return this._neighbors;
  }

  public set neighbors(value: string[]) {
    this._neighbors = value;
  }

  public get chain(): Block[] {
    return this._chain;
  }

  public set chain(value: Block[]) {
    this._chain = value;
  }

  public get transactions(): Transaction[] {
    return this._transactions;
  }

  public set transactions(value: Transaction[]) {
    this._transactions = value;
  }

  constructor(args: { blockchainAddress?: string; port?: number }) {
    if (_.isEmpty(process.env.MINING_DIFFICULTY))
      throw new Error("process.env.MINING_DIFFICULTY is Empty");
    if (_.isEmpty(process.env.MINING_SENDER))
      throw new Error("process.env.MINING_SENDER is Empty");
    if (_.isEmpty(process.env.MINING_REWARD))
      throw new Error("process.env.MINING_REWARD is Empty");
    this._blockchainAddress = args.blockchainAddress;
    this.port = args.port;
    // ブロックチェーンネットワークの初期ブロックを生成
    this.createBlock(0, this.hash({}));
    this.neighborHost = process.env.NEIGHBOR_HOST as string;
  }

  public async init() {
    await this.syncNeighbors();
    await this.resolveConflict();
  }

  public async resolveConflict(): Promise<boolean> {
    const chains = (await Promise.all(
      this.neighbors.map((h) =>
        axios.get(`http://${h}/chain`).then(({ data }) => data)
      )
    )) as Block[][];
    let longestChain: Block[] = this.chain;
    let maxChainLength: number = _.size(this.chain);
    chains.forEach((chain) => {
      const theChainLength: number = _.size(chain);
      if (theChainLength > maxChainLength && this.validChain(chain)) {
        maxChainLength = theChainLength;
        longestChain = chain;
      }
    });
    if (_.difference(longestChain, this.chain).length > 0) {
      this.chain = longestChain;
      console.log("Replaced block chain", JSON.stringify(this.chain, null, 2));
      return true;
    }
    return false;
  }

  public async createTransaction(args: {
    senderBlockchainAddress: string;
    recipientBlockchainAddress: string;
    value: number;
    senderPublicKey?: string;
    signature?: string;
  }): Promise<boolean> {
    const {
      senderBlockchainAddress,
      recipientBlockchainAddress,
      value,
      senderPublicKey,
      signature,
    } = args;
    const isAdded = await this.addTransaction({
      senderBlockchainAddress,
      recipientBlockchainAddress,
      value,
      senderPublicKey,
      signature,
    });
    if (!isAdded) return false;
    // 他のブロックチェーンノードへ同期
    await Promise.all(
      this.neighbors.map((h) =>
        axios.put(`http://${h}/transaction`, {
          sender_blockchain_address: senderBlockchainAddress,
          recipient_blockchain_address: recipientBlockchainAddress,
          value: value,
          sender_public_key: senderPublicKey,
          signature: signature,
        })
      )
    );
    return true;
  }

  public async addTransaction(args: {
    senderBlockchainAddress: string;
    recipientBlockchainAddress: string;
    value: number;
    senderPublicKey?: string;
    signature?: string;
  }): Promise<boolean> {
    const {
      senderBlockchainAddress,
      recipientBlockchainAddress,
      value,
      senderPublicKey,
      signature,
    } = args;
    const transaction: Transaction = sortedObjectByKey({
      sender_blockchain_address: senderBlockchainAddress,
      recipient_blockchain_address: recipientBlockchainAddress,
      value: value,
    }) as unknown as Transaction;
    // マイニングの報酬の場合は後続の検証処理を実施しない
    if (senderBlockchainAddress === process.env.MINING_SENDER) {
      this._transactions.push(transaction);
      return true;
    }
    const transactionStr = convertToUtf8(JSON.stringify(transaction));
    if (
      await this.verifyTransactionSignature({
        signature: signature as string,
        transaction: transactionStr as unknown as string,
        senderPublicKey: senderPublicKey as string,
      })
    ) {
      this._transactions.push(transaction);
      return true;
    }
    return false;
  }

  public async mining(): Promise<boolean> {
    // 本番のBitCoinネットワークの場合はトランザクションが存在しない場合でもマイニングが実行される
    // ただ、BitCoinネットワークでトランザクションが存在しない可能性は極めて低いので、基本的には実行される
    // 本環境は検証用のため、トランザクションが存在しない場合はマイニングを中止する（Chainを見やすくするために）
    if (
      // _.isEmpty(this.transactions) ||
      _.isEmpty(this.blockchainAddress) ||
      _.isEmpty(this._chain)
    ) {
      return false;
    }
    if (
      !(await this.addTransaction({
        senderBlockchainAddress: process.env.MINING_SENDER as string,
        recipientBlockchainAddress: this.blockchainAddress as string,
        value: _.toInteger(process.env.MINING_REWARD),
      }))
    ) {
      return false;
    }
    const nonce = this.proofOfWork();
    const previousHash = this.hash(_.last(this._chain) as Block);
    await this.createBlock(nonce, previousHash);
    await Promise.all(
      this.neighbors.map((h) => axios.put(`http://${h}/consensus`))
    );
    return true;
  }

  public calculateTotalAmount(blockchainAddress: string): number {
    let totalAmount = 0.0;
    this._chain.forEach((block) => {
      block.transactions.forEach((transaction) => {
        const value = _.toNumber(transaction["value"]);
        if (blockchainAddress == transaction["recipient_blockchain_address"])
          totalAmount += value;
        if (blockchainAddress == transaction["sender_blockchain_address"])
          totalAmount -= value;
      });
    });
    return totalAmount;
  }

  public async syncNeighbors() {
    const isAvailable = (port: number): Promise<boolean> =>
      new Promise((resolve) => {
        ping.probe(this.neighborHost as string, port, (err, data) => {
          if (err) resolve(false);
          else resolve(data);
        });
      });
    const neighbors: string[] = [];
    for (const port of NEIGHBOR_PORT) {
      if (this.port !== port && (await isAvailable(port))) {
        neighbors.push(`${this.neighborHost}:${port}`);
      }
    }
    const addedNode: string[] = _.difference(this.neighbors, neighbors);
    const removedNode: string[] = _.difference(neighbors, this.neighbors);
    if (addedNode.length > 0) console.log("ノード削除を検出", addedNode);
    else if (removedNode.length > 0)
      console.log("ノード追加を検出", removedNode);
    this.neighbors = neighbors;
  }

  private async createBlock(
    nonce: number,
    previousHash: string
  ): Promise<Block> {
    const block: Block = sortedObjectByKey({
      timestamp: moment().unix(),
      transactions: this._transactions,
      nonce: nonce,
      previous_hash: previousHash,
    }) as unknown as Block;
    this._chain.push(block);
    this._transactions = [];
    // 他のブロックチェーンノードへ同期
    await Promise.all(
      this.neighbors.map((h) => axios.delete(`http://${h}/transaction`))
    );
    return block;
  }

  private proofOfWork(): number {
    if (_.isEmpty(this._chain)) throw new Error("this._chain is Empty");
    const transactions: Transaction[] = _.cloneDeep(this._transactions);
    const previousHash: string = this.hash(_.last(this._chain) as Block);
    let nonce: number = 0;
    while (!this.validProof({ transactions, previousHash, nonce })) {
      nonce += 1;
    }
    return nonce;
  }

  private validProof(args: {
    transactions: Transaction[];
    previousHash: string;
    nonce: number;
    difficulty?: number;
  }) {
    const guessBlock = sortedObjectByKey({
      transactions: args.transactions,
      nonce: args.nonce,
      previous_hash: args.previousHash,
    });
    const guessHash: string = this.hash(guessBlock);
    const difficulty: number =
      args.difficulty || _.toInteger(process.env.MINING_DIFFICULTY);
    const ansower: string = _.times(difficulty, () => "0").join("");
    return _.chain(guessHash)
      .cloneDeep()
      .thru((v) => v.slice(0, difficulty))
      .thru((v) => v === ansower)
      .value();
  }

  private verifyTransactionSignature(args: {
    signature: string;
    transaction: string;
    senderPublicKey: string;
  }): Promise<boolean> {
    const signature = Buffer.from(
      convertToUtf8(args.signature) as unknown as string,
      "hex"
    );
    const transaction = Buffer.from(
      convertToUtf8(args.transaction) as unknown as string,
      "utf-8"
    );
    const senderPublicKey = Buffer.from(
      convertToUtf8(args.senderPublicKey) as unknown as string,
      "hex"
    );
    const msg = crypto.createHash("sha256").update(transaction).digest();
    return new Promise((resolve) => {
      eccrypto
        .verify(senderPublicKey, msg, signature)
        .then(() => {
          resolve(true);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  private validChain(chain: Block[]): boolean {
    let preBlock = chain[0];
    let currentIndex = 1;
    const chainLength = _.size(chain);
    while (currentIndex < chainLength) {
      const theBlock = chain[currentIndex];
      if (!theBlock) return false;
      if (theBlock.previous_hash !== this.hash(preBlock)) {
        return false;
      }
      if (
        !this.validProof({
          transactions: theBlock.transactions,
          previousHash: theBlock.previous_hash,
          nonce: theBlock.nonce,
        })
      ) {
        return false;
      }
      preBlock = theBlock;
      currentIndex++;
    }
    return true;
  }

  private hash(block: Record<string, unknown>): string {
    const blockStr = convertToUtf8(JSON.stringify(sortedObjectByKey(block)));
    const msg = crypto.createHash("sha256").update(blockStr).digest();
    return msg.toString("hex");
  }
}