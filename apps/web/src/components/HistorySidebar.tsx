import { useState, useEffect } from 'react';

interface HistoryItem {
    id: number;
    created_at: string;
    resume_preview: string;
    jd_preview: string;
    result_json: any;
}

interface HistorySidebarProps {
    onSelect: (item: HistoryItem) => void;
    apiUrl: string;
}

export default function HistorySidebar({ onSelect, apiUrl }: HistorySidebarProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${apiUrl}/api/history`);
            if (response.ok) {
                const data = await response.json();
                setHistory(data);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed right-4 top-4 z-50 bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-all text-gray-700 border border-gray-200"
                title="View History"
            >
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
            </button>

            {/* Sidebar */}
            <div
                className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 overflow-y-auto border-l border-gray-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="p-4 pt-16">
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Recent Analyses
                    </h2>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No history found</p>
                            ) : (
                                history.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            onSelect(item);
                                            setIsOpen(false);
                                        }}
                                        className="p-3 bg-gray-50 rounded-lg hover:bg-blue-50 cursor-pointer transition border border-gray-200 hover:border-blue-200 group"
                                    >
                                        <div className="text-xs text-gray-500 mb-1">
                                            {new Date(item.created_at).toLocaleDateString()} at{' '}
                                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="font-medium text-gray-800 text-sm line-clamp-2 mb-1 group-hover:text-blue-700">
                                            {item.result_json.missingSkills?.length || 0} Missing Skills Found
                                        </div>
                                        <div className="text-xs text-gray-600 truncate">
                                            MD: {item.result_json.steps ? 'Available' : 'N/A'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-20 z-30"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
