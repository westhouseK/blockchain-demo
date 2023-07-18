export type Argv = {
  port: string;
};

export type PostTransactionArgs = {
  sender_private_key: string;
  sender_blockchain_address: string;
  recipient_blockchain_address: string;
  sender_public_key: string;
  value: number;
};