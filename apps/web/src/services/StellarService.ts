import {
    Horizon,
    rpc,
    TransactionBuilder,
    Networks,
    Address,
    xdr,
    nativeToScVal,
    scValToNative,
    Operation,
    Transaction
} from '@stellar/stellar-sdk';
import {
    StellarConfig,
    Stream,
    CreateStreamParams,
    DistributeParams
} from '../types/stellar';

export class StellarService {
    private horizonClient: Horizon.Server;
    private rpcClient: rpc.Server;
    private config: StellarConfig;

    constructor(config: StellarConfig) {
        this.config = config;
        this.horizonClient = new Horizon.Server(config.horizonUrl);
        this.rpcClient = new rpc.Server(config.rpcUrl);
    }

    private getNetworkPassphrase(): string {
        switch (this.config.network) {
            case 'public':
                return Networks.PUBLIC;
            case 'testnet':
                return Networks.TESTNET;
            case 'futurenet':
                return Networks.FUTURENET;
            default:
                return Networks.TESTNET;
        }
    }

    /**
     * Fetch user's streams from the contract
     * Using Soroban RPC events is the most efficient way without a dedicated indexer.
     */
    async getStreams(userAddress: string): Promise<Stream[]> {
        try {
            const contractId = this.config.paymentStreamContractId;

            // Query events for this contract
            const response = await this.rpcClient.getEvents({
                startLedger: 0,
                filters: [
                    {
                        type: 'contract',
                        contractIds: [contractId],
                    },
                ],
            });

            const streams: Stream[] = [];

            for (const event of response.events) {
                const value = scValToNative(event.value);
                // Expected event structure depends on the contract implementation
                if (Array.isArray(value) && value[0] === 'create_stream') {
                    const streamData = value[1] as Stream;
                    if (streamData.sender === userAddress || streamData.recipient === userAddress) {
                        streams.push(streamData);
                    }
                }
            }

            return streams;
        } catch (error) {
            console.error('Error fetching streams:', error);
            return [];
        }
    }

    /**
     * Create a new payment stream
     */
    async createStream(params: CreateStreamParams): Promise<string> {
        const contractAddress = this.config.paymentStreamContractId;

        // Prepare arguments for Soroban contract call
        const args = [
            nativeToScVal(params.sender, { type: 'address' }),
            nativeToScVal(params.recipient, { type: 'address' }),
            nativeToScVal(params.token, { type: 'address' }),
            nativeToScVal(params.totalAmount, { type: 'i128' }),
            nativeToScVal(params.startTime, { type: 'u64' }),
            nativeToScVal(params.endTime, { type: 'u64' }),
        ];

        return this.invokeContract(contractAddress, 'create_stream', args, params.sender);
    }

    /**
     * Withdraw from a stream
     */
    async withdraw(streamId: bigint, amount: bigint, recipientAddress: string): Promise<string> {
        const contractAddress = this.config.paymentStreamContractId;

        // fn withdraw(env, stream_id, amount)
        const args = [
            nativeToScVal(streamId, { type: 'u64' }),
            nativeToScVal(amount, { type: 'i128' }),
        ];

        return this.invokeContract(contractAddress, 'withdraw', args, recipientAddress);
    }

    /**
     * Distribute tokens to multiple recipients
     */
    async distribute(params: DistributeParams): Promise<string> {
        const contractAddress = this.config.distributorContractId;
        let method: string;
        let args: xdr.ScVal[];

        if (params.type === 'equal') {
            if (!params.totalAmount) throw new Error('Total amount is required for equal distribution');
            method = 'distribute_equal';
            args = [
                nativeToScVal(params.sender, { type: 'address' }),
                nativeToScVal(params.token, { type: 'address' }),
                nativeToScVal(params.totalAmount, { type: 'i128' }),
                nativeToScVal(params.recipients, { type: 'address' }),
            ];
        } else {
            if (!params.amounts || params.amounts.length !== params.recipients.length) {
                throw new Error('Amounts must match recipients for weighted distribution');
            }
            method = 'distribute_weighted';
            args = [
                nativeToScVal(params.sender, { type: 'address' }),
                nativeToScVal(params.token, { type: 'address' }),
                nativeToScVal(params.recipients, { type: 'address' }),
                nativeToScVal(params.amounts, { type: 'i128' }),
            ];
        }

        return this.invokeContract(contractAddress, method, args, params.sender);
    }

    /**
     * Internal helper to invoke a Soroban contract
     */
    private async invokeContract(
        contractId: string,
        method: string,
        args: xdr.ScVal[],
        sourceAddress: string
    ): Promise<string> {
        try {
            // 1. Fetch account sequence
            const account = await this.horizonClient.loadAccount(sourceAddress);

            // 2. Build transaction
            const tx = new TransactionBuilder(account, {
                fee: '1000', // Base fee, will be updated by simulation
                networkPassphrase: this.getNetworkPassphrase(),
            })
                .addOperation(
                    Operation.invokeHostFunction({
                        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
                            new xdr.InvokeContractArgs({
                                contractAddress: Address.fromString(contractId).toScAddress(),
                                functionName: method,
                                args: args,
                            })
                        ),
                        auth: [],
                    })
                )
                .setTimeout(30)
                .build();

            // 3. Simulate transaction to estimate fees and footprint
            const simulation = await this.rpcClient.simulateTransaction(tx);

            if (rpc.Api.isSimulationError(simulation)) {
                throw new Error(`Simulation failed: ${simulation.error}`);
            }

            // TODO: In a real app, you would sign this transaction with a wallet provider (e.g., Freighter)
            // and then submit it. For now, we'll return the XDR for the frontend to handle signing.

            const preparedTx = rpc.assembleTransaction(tx, simulation) as unknown as Transaction;
            return preparedTx.toXDR();
        } catch (error: unknown) {
            console.error(`Error in invokeContract (${method}):`, error);
            throw this.handleError(error);
        }
    }

    // Add this to StellarService.ts
    async submitSignedTransaction(signedXdr: string) {
        const tx = new Transaction(signedXdr, this.getNetworkPassphrase());
        const response = await this.rpcClient.sendTransaction(tx);
        
        if (response.status === 'ERROR') {
            throw new Error(`Transaction failed: ${response.errorResult}`);
        }
        
        // Poll for status
        return response.hash;
    }

    private handleError(error: unknown): Error {
        // Map Stellar/Soroban errors to user-friendly messages
        if (error && typeof error === 'object' && 'response' in error) {
            const response = (error as { response: { data?: { extras?: { result_codes?: Record<string, unknown> } } } }).response;
            const resultCodes = response.data?.extras?.result_codes;
            if (resultCodes) {
                return new Error(`Transaction failed: ${JSON.stringify(resultCodes)}`);
            }
        }
        return error instanceof Error ? error : new Error('An unknown error occurred');
    }
}
