export type Argv = {
  port: string;
};

export type PostTransactionArgs = {
  sender_blockchain_address: string;
  recipient_blockchain_address: string;
  signature: string;
  sender_public_key: string;
  value: number;
};

export type Transaction = {
  sender_blockchain_address: string;
  recipient_blockchain_address: string;
  value: number;
};

export type Block = {
  timestamp: number;
  transactions: Transaction[];
  nonce: number;
  previous_hash: string;
};