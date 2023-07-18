import express, { Express, Request, Response } from "express";
import _ from "lodash";
import yargs from "yargs"
import * as ExpressTypes from "#/types/WalletServer";
import WalletService from "#/src/service/WalletService";
import TransactionService from "#/src/service/TransactionService";
import cors from "cors";
import bodyParser from "body-parser";

const app: Express = express();
const argv = yargs.argv as unknown as ExpressTypes.Argv;
const port = argv.port;

const jsonPrettier = <T>(v?: T): string =>
  v ? JSON.stringify(v, null, 2) : "{}";

const header = {
  contentTypeJson: "application/json; charset=utf-8",
};

app.use(bodyParser.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    // optionsSuccessStatus: 200,
  })
);

app.post("/wallet", async (req: Request, res: Response) => {
  const wallet = new WalletService();
  res
    .status(201)
    .header("Content-Type", header.contentTypeJson)
    .send(
      jsonPrettier({
        private_key: wallet.privateKey,
        public_key: wallet.publicKey,
        blockchain_address: wallet.blockchainAddress,
      })
    );
});

app.post(
  "/transaction",
  (req: Request<{}, {}, ExpressTypes.PostTransactionArgs>, res: Response) => {
    const body = req.body;
    const transactionService = new TransactionService({
      senderPrivateKey: body.sender_private_key,
      senderPublicKey: body.sender_public_key,
      senderBlockchainAddress: body.sender_blockchain_address,
      recipientBlockchainAddress: body.recipient_blockchain_address,
      value: body.value,
    });
    transactionService.getTransactionWithSignature().then((data) => {
      res
        .status(201)
        .header("Content-Type", header.contentTypeJson)
        .send(jsonPrettier(data));
    });
  }
);

app.listen(port, () => {
  console.log(`Wallet server is running at http://localhost:${port}`);
});