import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import _ from "lodash";
import yargs from "yargs";
import moment from "moment";
import { Argv, PostTransactionArgs} from "#/types/BlockchainServer";
import BlockchainService from "#/src/service/BlockchainService";
import WalletService from "#/src/service/WalletService";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();

const cached: {
  blockchain?: BlockchainService;
  timer?: NodeJS.Timer;
  isRunningMining: boolean;
} = { isRunningMining: false };

const app: Express = express();
const argv = yargs.argv as unknown as Argv;
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

app.get("/transactions", (req: Request, res: Response) => {
  res
    .status(200)
    .header("Content-Type", header.contentTypeJson)
    .send(jsonPrettier(cached.blockchain?.transactions));
});

app.get("/chain", (req: Request, res: Response) => {
  res
    .status(200)
    .header("Content-Type", header.contentTypeJson)
    .send(jsonPrettier(cached.blockchain?.chain));
});

app.get("/blockchainAddress", (req: Request, res: Response) => {
  res
    .status(200)
    .header("Content-Type", header.contentTypeJson)
    .send(
      jsonPrettier({
        blockchainAddress: cached.blockchain?.blockchainAddress,
      })
    );
});

app.get(
  "/sum_bitcoin/:the_block_chain_address",
  (req: Request<{ the_block_chain_address: string }>, res: Response) => {
    res
      .status(200)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          amount: cached.blockchain?.calculateTotalAmount(
            req.params.the_block_chain_address
          ),
        })
      );
  }
);

app.post(
  "/transaction",
  async (
    req: Request<{}, {}, PostTransactionArgs>,
    res: Response
  ) => {
    const isAdded = await cached.blockchain?.createTransaction({
      senderBlockchainAddress: req.body.sender_blockchain_address,
      recipientBlockchainAddress: req.body.recipient_blockchain_address,
      value: req.body.value,
      senderPublicKey: req.body.sender_public_key,
      signature: req.body.signature,
    });
    res
      .status(isAdded ? 201 : 500)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          result: isAdded ? "success" : "fail",
        })
      );
  }
);

app.put(
  "/transaction",
  async (
    req: Request<{}, {}, PostTransactionArgs>,
    res: Response
  ) => {
    const isAdded = await cached.blockchain?.addTransaction({
      senderBlockchainAddress: req.body.sender_blockchain_address,
      recipientBlockchainAddress: req.body.recipient_blockchain_address,
      value: req.body.value,
      senderPublicKey: req.body.sender_public_key,
      signature: req.body.signature,
    });
    res
      .status(isAdded ? 201 : 500)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          result: isAdded ? "success" : "fail",
        })
      );
  }
);

app.delete(
  "/transaction",
  async (
    req: Request<{}, {}, PostTransactionArgs>,
    res: Response
  ) => {
    cached!.blockchain!.transactions = [];
    res
      .status(200)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          result: "success",
        })
      );
  }
);

app.post("/mining", async (req: Request, res: Response) => {
  if (!cached.isRunningMining) {
    console.log(
      `================ Start mining at ${moment().format(
        "yyyy年MM月DD日 HH時mm分ss秒"
      )} ================ `
    );
    cached.isRunningMining = true;
    const isSuccess = await cached.blockchain?.mining();
    console.log(JSON.stringify(cached.blockchain?.chain, null, 2));
    cached.isRunningMining = false;
    console.log(
      `================ Finised mining at ${moment().format(
        "yyyy年MM月DD日 HH時mm分ss秒"
      )} ================`
    );
    res
      .status(isSuccess ? 200 : 500)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          result: isSuccess ? "success" : "fail",
        })
      );
  } else {
    res
      .status(400)
      .header("Content-Type", header.contentTypeJson)
      .send(
        jsonPrettier({
          result: "fail",
          detail: "Mining is running",
        })
      );
  }
});

app.put("/consensus", async (req: Request, res: Response) => {
  const replaced = await cached!.blockchain?.resolveConflict();
  res
    .status(200)
    .header("Content-Type", header.contentTypeJson)
    .send(
      jsonPrettier({
        result: replaced ? "Replaced" : "Not replaced",
      })
    );
});

app.listen(port, () => {
  const wallet = new WalletService();

  cached.blockchain = new BlockchainService({
    blockchainAddress: wallet.blockchainAddress,
    port: _.toInteger(port),
  });

  cached.blockchain.init();

  cached.timer = setInterval(() => {
    cached.blockchain?.syncNeighbors();
  }, 3000);

  console.log(`BlockChain node is running at http://localhost:${port}`);
});