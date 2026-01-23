export enum StreamStatus {
  Active = 0,
  Paused = 1,
  Canceled = 2,
  Completed = 3,
}

export interface Stream {
  id: bigint;
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  withdrawnAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  status: StreamStatus;
}

export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
}

export interface DistributeParams {
  sender: string;
  token: string;
  totalAmount?: bigint;
  recipients: string[];
  amounts?: bigint[];
  type: 'equal' | 'weighted';
}

export interface StellarConfig {
  network: 'testnet' | 'public' | 'futurenet';
  rpcUrl: string;
  horizonUrl: string;
  paymentStreamContractId: string;
  distributorContractId: string;
}
