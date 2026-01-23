"use client"

import { useState } from "react"
import Link from "next/link"
import { PaymentStreamForm } from "@/components/PaymentStreamForm"

export default function CreateStreamPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSuccess = (streamId: string) => {
    setSuccessMessage(`Payment stream created successfully! Stream ID: ${streamId}`)
    setErrorMessage(null)
  }

  const handleError = (error: string) => {
    setErrorMessage(error)
    setSuccessMessage(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <Link 
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              ← Back to Home
            </Link>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Create Payment Stream
              </h1>
              <p className="text-gray-600">
                Set up a continuous payment stream on the Stellar network
              </p>
            </div>

            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 mb-3">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-sm text-green-700 hover:text-green-900 underline"
                >
                  Create Another Stream
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{errorMessage}</p>
              </div>
            )}

            <PaymentStreamForm
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        </div>
      </div>
    </div>
  )
}