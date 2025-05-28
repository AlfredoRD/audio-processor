import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AlfredoAudioSnip',
  description: 'Creado por Alfredo',
  generator: 'alfredo.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
