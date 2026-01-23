import { Keypair, Networks, Horizon } from '@stellar/stellar-sdk'
import { PaymentStreamFormData, SUPPORTED_TOKENS } from './validations'

// Use testnet for development
const server = new Horizon.Server('https://horizon-testnet.stellar.org')
const networkPassphrase = Networks.TESTNET

export interface CreateStreamParams {
  senderKeypair: Keypair
  recipientAddress: string
  tokenAddress: string
  totalAmount: string
  durationInSeconds: number
  cancelable: boolean
  transferable: boolean
}

export class StellarService {
  static async createPaymentStream(formData: PaymentStreamFormData): Promise<string> {
    try {
      // For demo purposes, we'll simulate the transaction
      // In a real implementation, you would:
      // 1. Connect to user's wallet (Freighter, etc.)
      // 2. Get the user's keypair
      // 3. Build and submit the actual transaction to the smart contract
      
      console.log('Creating payment stream with data:', formData)
      
      // Convert duration to seconds
      const durationInSeconds = formData.durationUnit === 'days' 
        ? parseInt(formData.duration) * 24 * 60 * 60
        : parseInt(formData.duration) * 60 * 60
      
      // Get token info
      const selectedToken = SUPPORTED_TOKENS.find(token => token.value === formData.token)
      if (!selectedToken) {
        throw new Error('Invalid token selected')
      }
      
      // Simulate contract interaction
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      
      // In a real implementation, you would:
      // 1. Create a transaction that calls the payment stream contract
      // 2. Include operations to transfer tokens to the contract
      // 3. Submit the transaction to the network
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      return streamId
    } catch (error) {
      console.error('Error creating payment stream:', error)
      throw new Error('Failed to create payment stream: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }
  
  static async getAccountInfo(publicKey: string) {
    try {
      const account = await server.loadAccount(publicKey)
      return account
    } catch (error) {
      throw new Error('Failed to load account information')
    }
  }
  
  static validateStellarAddress(address: string): boolean {
    try {
      Keypair.fromPublicKey(address)
      return true
    } catch {
      return false
    }
  }
  
  static formatAmount(amount: string, decimals: number = 7): string {
    const num = parseFloat(amount)
    return num.toFixed(decimals)
  }
}