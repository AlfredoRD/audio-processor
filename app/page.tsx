import AudioProcessor from "@/components/audio-processor"

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <AudioProcessor />
      </div>
    </main>
  )
}
