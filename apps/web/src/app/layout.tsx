import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Career Gap Architect',
    description: 'Career Gap Architect Application',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
