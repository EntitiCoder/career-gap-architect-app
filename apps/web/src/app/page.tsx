'use client'

import { useState } from 'react'

import HistorySidebar from '../components/HistorySidebar'

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
    const [uploadingResume, setUploadingResume] = useState(false)
    const [uploadingJD, setUploadingJD] = useState(false)

    const handleHistorySelect = (item: any) => {
        setResume(item.resume_preview + (item.resume_preview.length >= 200 ? '...' : ''))
        setJobDescription(item.jd_preview + (item.jd_preview.length >= 200 ? '...' : ''))
        setResult(item.result_json)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
            const response = await fetch(`${apiUrl}/api/gap-analysis`, {
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

    const handleFileUpload = async (
        file: File,
        setterFunction: (text: string) => void,
        setLoadingFunction: (loading: boolean) => void
    ) => {
        setLoadingFunction(true)
        setError(null)

        // Validate file size (10MB limit)
        const MAX_FILE_SIZE = 10 * 1024 * 1024
        if (file.size > MAX_FILE_SIZE) {
            setError('File size exceeds 10MB limit')
            setLoadingFunction(false)
            return
        }

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (!data.ok) {
                setError(data.error || 'Failed to upload file')
                return
            }

            // Set the extracted text
            setterFunction(data.text)

        } catch (err) {
            setError('Failed to upload file. Please try again.')
        } finally {
            setLoadingFunction(false)
        }
    }

    const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileUpload(file, setResume, setUploadingResume)
        }
    }

    const handleJDUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileUpload(file, setJobDescription, setUploadingJD)
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
            <HistorySidebar
                apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}
                onSelect={handleHistorySelect}
            />
            <div className="max-w-6xl mx-auto py-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
                    Career Gap Architect
                </h1>

                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Resume
                                </label>
                                <label
                                    htmlFor="resume-upload"
                                    className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    {uploadingResume ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload PDF/DOCX/TXT
                                        </>
                                    )}
                                </label>
                                <input
                                    id="resume-upload"
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt"
                                    onChange={handleResumeUpload}
                                    className="hidden"
                                    disabled={uploadingResume}
                                />
                            </div>
                            <textarea
                                value={resume}
                                onChange={(e) => setResume(e.target.value)}
                                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Paste your resume here..."
                                required
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Job Description
                                </label>
                                <label
                                    htmlFor="jd-upload"
                                    className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    {uploadingJD ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload PDF/DOCX/TXT
                                        </>
                                    )}
                                </label>
                                <input
                                    id="jd-upload"
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt"
                                    onChange={handleJDUpload}
                                    className="hidden"
                                    disabled={uploadingJD}
                                />
                            </div>
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
                            <div className="prose max-w-none text-gray-700">
                                {renderMarkdown(result.steps)}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-lg p-6">
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
