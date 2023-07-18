<script lang="ts" setup>
import axios from "axios";
import _ from "lodash";

const snackbar = ref(false);
const config = useRuntimeConfig();
const walletEndPoint = config.public.WALLET_SERVER_END_POINT;
const blockChainHost = config.public.BLOCK_CHAIN_SERVER_HOST;
const blockChainGateway = `${config.public.BLOCK_CHAIN_SERVER_HOST}:8001`;

// ========== Wallet ==========
type Wallet = {
  private_key: string;
  public_key: string;
  blockchain_address: string;
};
const { data: wallet } = await useAsyncData<Wallet>("postWallet", async () => {
  const res = await axios.post(`${walletEndPoint}/wallet`);
  return res.data as Wallet;
});
const walletAmount = ref(0);
const isFetchWalletAmount = ref(true);
const fetchWalletAmount = async () => {
  isFetchWalletAmount.value = true;
  const res = await axios.get(
    `${blockChainGateway}/sum_bitcoin/${wallet.value.blockchain_address}`
  );
  walletAmount.value = _.toNumber(res.data.amount);
  isFetchWalletAmount.value = false;
};

// ========== Send BitCoin ==========
type TheTransaction = {
  sender_blockchain_address: string;
  recipient_blockchain_address: string;
  sender_public_key: string;
  value: number;
  signature: string;
};
const inputRecipientBlockchainAddress = ref<string>();
const inputSendBitCoinAmount = ref<number>();
const isSendBitCoin = ref(false);
const onClickSendBitCoin = async () => {
  if (!inputRecipientBlockchainAddress.value || !inputSendBitCoinAmount.value) {
    return;
  }
  isSendBitCoin.value = true;
  const theTransaction = (
    await axios.post(`${walletEndPoint}/transaction`, {
      sender_private_key: wallet.value.private_key,
      sender_blockchain_address: wallet.value.blockchain_address,
      recipient_blockchain_address: inputRecipientBlockchainAddress.value,
      sender_public_key: wallet.value.public_key,
      value: inputSendBitCoinAmount.value,
    })
  ).data as TheTransaction;
  await axios.post(`${blockChainGateway}/transaction`, {
    sender_blockchain_address: wallet.value.blockchain_address,
    recipient_blockchain_address: inputRecipientBlockchainAddress.value,
    sender_public_key: wallet.value.public_key,
    signature: theTransaction.signature,
    value: inputSendBitCoinAmount.value,
  });
  inputRecipientBlockchainAddress.value = undefined;
  inputSendBitCoinAmount.value = undefined;
  snackbar.value = true;
  isSendBitCoin.value = false;
};

// ========== BitCoinNetwork ==========
type BitcoinNetwork = {
  [key in number]: {
    chain: string;
    transactions: string;
  };
};
const fetchBitcoinNetwork = async (): Promise<BitcoinNetwork> => {
  return {
    8001: {
      chain: JSON.stringify(
        (await axios.get(`${blockChainHost}:8001/chain`)).data,
        null,
        2
      ),
      transactions: JSON.stringify(
        (await axios.get(`${blockChainHost}:8001/transactions`)).data,
        null,
        2
      ),
    },
    8002: {
      chain: JSON.stringify(
        (await axios.get(`${blockChainHost}:8002/chain`)).data,
        null,
        2
      ),
      transactions: JSON.stringify(
        (await axios.get(`${blockChainHost}:8002/transactions`)).data,
        null,
        2
      ),
    },
    8003: {
      chain: JSON.stringify(
        (await axios.get(`${blockChainHost}:8003/chain`)).data,
        null,
        2
      ),
      transactions: JSON.stringify(
        (await axios.get(`${blockChainHost}:8003/transactions`)).data,
        null,
        2
      ),
    },
  } as BitcoinNetwork;
};

const { data: bitcoinNetwork } = await useAsyncData<BitcoinNetwork>(
  "fetchBitcoinNetwork",
  async () => fetchBitcoinNetwork()
);
const onClickFetchBitCoinNetwork = async () => {
  bitcoinNetwork.value = await fetchBitcoinNetwork();
};
const miningLoading = ref({
  8001: false,
  8002: false,
  8003: false,
});
const onClickMining = async (port: 8001 | 8002 | 8003) => {
  if (miningLoading.value[port]) return;
  miningLoading.value[port] = true;
  await axios.post(`${blockChainHost}:${port}/mining`);
  miningLoading.value[port] = false;
};

onMounted(() => {
  fetchWalletAmount();
});
</script>

<template>
  <Title>Wallet</Title>
  <v-container class="container">
    <v-row>
      <!-- Wallet -->
      <v-col cols="6">
        <v-card class="pa-8">
          <v-row>
            <v-col cols="12">
              <h1>Wallet</h1>
            </v-col>
            <v-col cols="12">
              <v-btn :loading="isFetchWalletAmount" @click="fetchWalletAmount">
                {{ walletAmount }} bit
              </v-btn>
            </v-col>
            <v-col cols="12">
              <v-textarea
                label="Public Key"
                rows="4"
                v-model="wallet.public_key"
              ></v-textarea>
              <v-text-field
                label="Private Key"
                v-model="wallet.private_key"
              ></v-text-field>
              <v-text-field
                label="Blockchain Address"
                v-model="wallet.blockchain_address"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
      <!-- Send BitCoin -->
      <v-col cols="6">
        <v-card class="pa-8">
          <v-row>
            <v-col cols="12">
              <h1>Send BitCoin</h1>
            </v-col>
            <v-col cols="12">
              <v-text-field
                label="recipient blockchain address"
                v-model="inputRecipientBlockchainAddress"
              ></v-text-field>
              <v-text-field
                label="Amount"
                v-model="inputSendBitCoinAmount"
              ></v-text-field>
              <v-btn
                color="primary"
                :loading="isSendBitCoin"
                @click="onClickSendBitCoin"
              >
                Send
              </v-btn>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
      <!-- BitCoinNetwork -->
      <v-col cols="12">
        <v-row>
          <v-col cols="12">
            <h1>BitCoin Network</h1>
          </v-col>
          <v-col cols="12">
            <v-btn color="primary" @click="onClickFetchBitCoinNetwork">
              Fetch All
            </v-btn>
            <v-btn
              color="warning"
              class="ml-4"
              @click="onClickMining(8001)"
              :loading="miningLoading[8001]"
            >
              Mining(8001)
            </v-btn>
            <v-btn
              color="warning"
              class="ml-4"
              @click="onClickMining(8002)"
              :loading="miningLoading[8002]"
            >
              Mining(8002)
            </v-btn>
            <v-btn
              color="warning"
              class="ml-4"
              @click="onClickMining(8003)"
              :loading="miningLoading[8003]"
            >
              Mining(8003)
            </v-btn>
          </v-col>
          <v-col cols="12">
            <h2>{{ blockChainHost }}:8001</h2>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Chain"
              rows="6"
              v-model="bitcoinNetwork[8001].chain"
            ></v-textarea>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Transactions"
              rows="6"
              v-model="bitcoinNetwork[8001].transactions"
            ></v-textarea>
          </v-col>
          <v-col cols="12">
            <h2>{{ blockChainHost }}:8002</h2>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Chain"
              rows="6"
              v-model="bitcoinNetwork[8002].chain"
            ></v-textarea>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Transactions"
              rows="6"
              v-model="bitcoinNetwork[8002].transactions"
            ></v-textarea>
          </v-col>
          <v-col cols="12">
            <h2>{{ blockChainHost }}:8003</h2>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Chain"
              rows="6"
              v-model="bitcoinNetwork[8003].chain"
            ></v-textarea>
          </v-col>
          <v-col cols="6">
            <v-textarea
              label="Transactions"
              rows="6"
              v-model="bitcoinNetwork[8003].transactions"
            ></v-textarea>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
    <v-snackbar v-model="snackbar">
      Sent Transaction !
      <template v-slot:action="{ attrs }">
        <v-btn color="success" text v-bind="attrs" @click="snackbar = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

.container {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
}