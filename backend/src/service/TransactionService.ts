import crypto from "crypto";
import eccrypto from "eccrypto";
import { sortedObjectByKey, convertToUtf8 } from "#/src/utils/index";

type Args = {
  senderPrivateKey: string;
  senderPublicKey: string;
  senderBlockchainAddress: string;
  recipientBlockchainAddress: string;
  value: number;
};

type Transaction = {
  sender_blockchain_address: string;
  recipient_blockchain_address: string;
  sender_public_key: string;
  value: number;
  signature: string;
};

export default class {
  private senderPrivateKey: string;
  private senderPublicKey: string;
  private senderBlockchainAddress: string;
  private recipientBlockchainAddress: string;
  private value: number;

  constructor(args: Args) {
    this.senderPrivateKey = args.senderPrivateKey;
    this.senderPublicKey = args.senderPublicKey;
    this.senderBlockchainAddress = args.senderBlockchainAddress;
    this.recipientBlockchainAddress = args.recipientBlockchainAddress;
    this.value = args.value;
  }

  public async getTransactionWithSignature(): Promise<Transaction> {
    return {
      sender_blockchain_address: this.senderBlockchainAddress,
      recipient_blockchain_address: this.recipientBlockchainAddress,
      sender_public_key: this.senderPublicKey,
      value: this.value,
      signature: await this.generateSignature(),
    };
  }

  public async generateSignature(): Promise<string> {
    const transaction = sortedObjectByKey({
      sender_blockchain_address: this.senderBlockchainAddress,
      recipient_blockchain_address: this.recipientBlockchainAddress,
      value: this.value,
    });
    const transactionStr = convertToUtf8(JSON.stringify(transaction));
    const msg = crypto.createHash("sha256").update(transactionStr).digest();
    return new Promise((resolve, reject) => {
      eccrypto
        .sign(Buffer.from(this.senderPrivateKey, "hex"), msg)
        .then((sig) => {
          eccrypto
            .verify(Buffer.from(this.senderPublicKey, "hex"), msg, sig)
            .then(function () {
              resolve(sig.toString("hex"));
            })
            .catch(function () {
              reject("Failed Signature");
            });
        });
    });
  }
}
