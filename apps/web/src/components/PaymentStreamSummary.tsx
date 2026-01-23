import { PaymentStreamFormData, SUPPORTED_TOKENS } from "@/lib/validations"

interface PaymentStreamSummaryProps {
  data: PaymentStreamFormData
}

export function PaymentStreamSummary({ data }: PaymentStreamSummaryProps) {
  const selectedToken = SUPPORTED_TOKENS.find(token => token.value === data.token)
  const durationInHours = data.durationUnit === "days" 
    ? parseInt(data.duration) * 24 
    : parseInt(data.duration)
  
  const amountPerHour = parseFloat(data.totalAmount) / durationInHours
  const amountPerDay = amountPerHour * 24

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg">Stream Summary</h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Recipient:</span>
          <p className="font-mono text-xs break-all">{data.recipientAddress}</p>
        </div>
        
        <div>
          <span className="text-gray-600">Token:</span>
          <p className="font-medium">{selectedToken?.label || data.token}</p>
        </div>
        
        <div>
          <span className="text-gray-600">Total Amount:</span>
          <p className="font-medium">{data.totalAmount} {data.token}</p>
        </div>
        
        <div>
          <span className="text-gray-600">Duration:</span>
          <p className="font-medium">{data.duration} {data.durationUnit}</p>
        </div>
        
        <div>
          <span className="text-gray-600">Rate per Hour:</span>
          <p className="font-medium">{amountPerHour.toFixed(7)} {data.token}</p>
        </div>
        
        <div>
          <span className="text-gray-600">Rate per Day:</span>
          <p className="font-medium">{amountPerDay.toFixed(7)} {data.token}</p>
        </div>
      </div>
      
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Cancelable:</span>
          <span className={`px-2 py-1 rounded text-xs ${
            data.cancelable 
              ? "bg-green-100 text-green-800" 
              : "bg-red-100 text-red-800"
          }`}>
            {data.cancelable ? "Yes" : "No"}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Transferable:</span>
          <span className={`px-2 py-1 rounded text-xs ${
            data.transferable 
              ? "bg-green-100 text-green-800" 
              : "bg-red-100 text-red-800"
          }`}>
            {data.transferable ? "Yes" : "No"}
          </span>
        </div>
      </div>
    </div>
  )
}