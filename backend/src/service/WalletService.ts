import eccrypto from "eccrypto";
import crypto from "crypto";
import ripemd160 from "ripemd160";
import base58 from "bs58";

export default class {
  private _privateKey: Buffer;
  private _publicKey: Buffer;
  private _blockchainAddress: string;

  constructor() {
    this._privateKey = eccrypto.generatePrivate();
    this._publicKey = eccrypto.getPublic(this._privateKey);
    this._blockchainAddress = this.generateBlockchainAddress();
  }

  public get privateKey(): string {
    return this._privateKey.toString("hex");
  }

  public get publicKey(): string {
    return this._publicKey.toString("hex");
  }

  public get blockchainAddress(): string {
    return this._blockchainAddress;
  }

  private generateBlockchainAddress(): string {
    // 公開鍵をSHA256でハッシュ化
    const publicKeySha256Hash = crypto
      .createHash("sha256") 
      .update(this._publicKey) 
      .digest();
    // 更にRipemd160でハッシュ化
    const publicKeyRipemd160Hash = new ripemd160()
      .update(publicKeySha256Hash)
      .digest();
    // Ripemd160でハッシュ化された文字列の先頭に、「00」を付与
    const step1 = Buffer.from(
      "00" + publicKeyRipemd160Hash.toString("hex"),
      "hex"
    );
    // ダブルハッシュ
    const step2 = crypto.createHash("sha256").update(step1).digest();
    const step3 = crypto.createHash("sha256").update(step2).digest();
    // チェックサム取得と文字列への結合
    const checksum = step3.toString("hex").substring(0, 8);
    const step4 = step1.toString("hex") + checksum;
    // base58でエンコード
    const address = base58.encode(Buffer.from(step4, "hex"));
    return address;
  }
}