'use client'

import { useEffect, useState } from 'react'

export default function Home() {
    const [apiStatus, setApiStatus] = useState<string>('Checking...')

    useEffect(() => {
        fetch('http://localhost:4000/health')
            .then(res => res.json())
            .then(data => setApiStatus(data.status))
            .catch(() => setApiStatus('API not available'))
    }, [])

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Career Gap Architect
                </h1>
                <p className="text-lg text-gray-600 mb-6">
                    Welcome to your monorepo boilerplate
                </p>

                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h2 className="font-semibold text-blue-900 mb-2">🚀 Web App Status</h2>
                        <p className="text-blue-700">Next.js is running successfully!</p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h2 className="font-semibold text-green-900 mb-2">⚡ API Status</h2>
                        <p className="text-green-700">{apiStatus}</p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h2 className="font-semibold text-purple-900 mb-2">🗄️ Database</h2>
                        <p className="text-purple-700">PostgreSQL running in Docker</p>
                    </div>
                </div>
            </div>
        </main>
    )
}
