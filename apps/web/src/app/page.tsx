'use client'

import { useState } from 'react'

interface GapAnalysisResult {
    missingSkills: string[]
    steps: string
    interviewQuestions: string
    cached?: boolean
}

export default function Home() {
    const [resume, setResume] = useState('')
    const [jobDescription, setJobDescription] = useState('')
    const [result, setResult] = useState<GapAnalysisResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const response = await fetch('http://localhost:4000/api/gap-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume, jobDescription }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze gap')
            }

            setResult(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    const renderMarkdown = (text: string) => {
        return text.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
                return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h2>
            }
            if (line.startsWith('## ')) {
                return <h3 key={i} className="text-lg font-semibold mt-3 mb-1">{line.slice(3)}</h3>
            }
            if (line.startsWith('- ')) {
                return <li key={i} className="ml-4">{line.slice(2)}</li>
            }
            if (line.trim() === '') {
                return <br key={i} />
            }
            return <p key={i}>{line}</p>
        })
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto py-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
                    Career Gap Architect
                </h1>

                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Resume
                            </label>
                            <textarea
                                value={resume}
                                onChange={(e) => setResume(e.target.value)}
                                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Paste your resume here..."
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Job Description
                            </label>
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Paste the job description here..."
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                    >
                        {loading ? 'Analyzing...' : 'Analyze Gap'}
                    </button>
                </form>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {result && (
                    <div className="space-y-6">
                        {result.cached && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm">
                                Results retrieved from cache
                            </div>
                        )}

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Missing Skills</h2>
                            <div className="flex flex-wrap gap-2">
                                {result.missingSkills.map((skill, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium border border-red-300"
                                    >
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Action Plan</h2>
                            <div className="prose max-w-none text-gray-700">
                                {renderMarkdown(result.steps)}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Interview Preparation</h2>
                            <div className="prose max-w-none text-gray-700">
                                {renderMarkdown(result.interviewQuestions)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}
