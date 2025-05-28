"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, FileAudio, Loader2, Upload, X, RotateCcw, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"

export default function AudioProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedAudioBlob, setProcessedAudioBlob] = useState<Blob | null>(null)
  const [processedAudioUrl, setProcessedAudioUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [threshold, setThreshold] = useState(0.015)
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.type.startsWith("audio/")) {
        setError("Por favor selecciona un archivo de audio válido (mp3, wav)")
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
      setProcessedAudioUrl(null)
      setProcessedAudioBlob(null)
      setDownloadUrl(null)
      setProgress(0)

      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl)
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setProcessedAudioUrl(null)
    setProcessedAudioBlob(null)
    setDownloadUrl(null)
    setError(null)
    setProgress(0)

    if (processedAudioUrl) {
      URL.revokeObjectURL(processedAudioUrl)
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl)
    }
  }

  const handleReset = () => {
    setProcessedAudioUrl(null)
    setProcessedAudioBlob(null)
    setDownloadUrl(null)
    setError(null)
    setProgress(0)

    if (processedAudioUrl) {
      URL.revokeObjectURL(processedAudioUrl)
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl)
    }
  }

  const detectSilence = (data: Float32Array, threshold: number): boolean => {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
    }
    const rms = Math.sqrt(sum / data.length)
    return rms < threshold
  }

  const processAudio = async (audioBuffer: AudioBuffer): Promise<AudioBuffer> => {
    try {
      const sampleRate = audioBuffer.sampleRate
      const numChannels = audioBuffer.numberOfChannels
      const silenceThreshold = threshold
      const windowSize = Math.floor(sampleRate * 0.01)

      const channelsData: Float32Array[] = []
      for (let i = 0; i < numChannels; i++) {
        channelsData.push(audioBuffer.getChannelData(i))
      }

      const nonSilentSegments: { start: number; end: number }[] = []
      let isSilent = true
      let silenceStart = 0
      let nonSilenceStart = 0

      const totalWindows = Math.floor(audioBuffer.length / windowSize)

      for (let i = 0; i < totalWindows; i++) {
        if (i % 10 === 0) {
          setProgress(Math.floor((i / totalWindows) * 50))
        }

        const windowStart = i * windowSize
        const windowEnd = Math.min(windowStart + windowSize, audioBuffer.length)
        const windowData = new Float32Array(windowEnd - windowStart)

        for (let j = 0; j < windowData.length; j++) {
          windowData[j] = channelsData[0][windowStart + j]
        }

        const windowIsSilent = detectSilence(windowData, silenceThreshold)

        if (isSilent && !windowIsSilent) {
          nonSilenceStart = windowStart
          isSilent = false
        } else if (!isSilent && windowIsSilent) {
          silenceStart = windowStart
          isSilent = true
          nonSilentSegments.push({
            start: nonSilenceStart,
            end: silenceStart,
          })
        }
      }

      if (!isSilent) {
        nonSilentSegments.push({
          start: nonSilenceStart,
          end: audioBuffer.length,
        })
      }

      if (nonSilentSegments.length === 0) {
        return audioBuffer
      }
      if (
        nonSilentSegments.length === 1 &&
        nonSilentSegments[0].start === 0 &&
        nonSilentSegments[0].end === audioBuffer.length
      ) {
        return audioBuffer
      }

      let totalLength = 0
      for (const segment of nonSilentSegments) {
        totalLength += segment.end - segment.start
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current
      const processedBuffer = ctx.createBuffer(numChannels, totalLength, sampleRate)

      let outputPosition = 0
      for (let segmentIndex = 0; segmentIndex < nonSilentSegments.length; segmentIndex++) {
        const segment = nonSilentSegments[segmentIndex]
        const segmentLength = segment.end - segment.start

        setProgress(50 + Math.floor((segmentIndex / nonSilentSegments.length) * 50))

        for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
          const outputData = processedBuffer.getChannelData(channelIndex)
          const inputData = channelsData[channelIndex]

          for (let i = 0; i < segmentLength; i++) {
            outputData[outputPosition + i] = inputData[segment.start + i]
          }
        }

        outputPosition += segmentLength
      }

      setProgress(100)
      return processedBuffer
    } catch (err) {
      console.error("Error procesando audio:", err)
      throw err
    }
  }

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const numOfChannels = buffer.numberOfChannels
    const length = buffer.length * numOfChannels * 2
    const sampleRate = buffer.sampleRate

    const wavBuffer = new ArrayBuffer(44 + length)
    const view = new DataView(wavBuffer)

    writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + length, true)
    writeString(view, 8, "WAVE")
    writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numOfChannels * 2, true)
    view.setUint16(32, numOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, "data")
    view.setUint32(40, length, true)

    const channels = []
    for (let i = 0; i < numOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    let offset = 44
    for (let i = 0; i < buffer.length; i++) {
      for (let c = 0; c < numOfChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
    }

    return wavBuffer
  }

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  const handleProcessAudio = async () => {
    if (!file) return

    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)
      const processedBuffer = await processAudio(audioBuffer)
      const wavBuffer = audioBufferToWav(processedBuffer)

      const blob = new Blob([wavBuffer], { type: "audio/wav" })
      setProcessedAudioBlob(blob)

      // URL para reproducir
      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl)
      }
      const playUrl = URL.createObjectURL(blob)
      setProcessedAudioUrl(playUrl)

      // URL específico para descarga con data URL
      const arrayBufferForDownload = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBufferForDownload)
      let binary = ""
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64 = btoa(binary)
      const dataUrl = `data:audio/wav;base64,${base64}`
      setDownloadUrl(dataUrl)

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = playUrl
          audioRef.current.load()
        }
      }, 100)
    } catch (err) {
      console.error(err)
      setError("Ocurrió un error al procesar el audio. Por favor intenta nuevamente.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenInNewTab = () => {
    if (!downloadUrl) return

    const newWindow = window.open(downloadUrl, "_blank")
    if (newWindow) {
      setError("Audio abierto en nueva pestaña. Haz clic derecho y selecciona 'Guardar como...' para descargarlo.")
    } else {
      setError("No se pudo abrir en nueva pestaña. Verifica que no estés bloqueando ventanas emergentes.")
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Procesador de Audio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert
            variant={error.includes("abierto") ? "default" : "destructive"}
            className="mb-4"
          >
            {error.includes("abierto") ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="audio-file" className="text-sm font-medium">
            Selecciona un archivo de audio (mp3, wav)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="audio-file"
              type="file"
              accept="audio/mp3,audio/wav,audio/mpeg,audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => document.getElementById("audio-file")?.click()}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Seleccionar archivo
            </Button>
          </div>
        </div>

        {file && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <FileAudio className="h-5 w-5 flex-shrink-0 text-blue-500" />
              <span className="text-sm truncate">{file.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Eliminar archivo</span>
            </Button>
          </div>
        )}

        {file && !processedAudioBlob && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="threshold" className="text-sm">
                  Umbral de silencio
                </Label>
                <span className="text-xs text-muted-foreground">{threshold.toFixed(3)}</span>
              </div>
              <Slider
                id="threshold"
                min={0.001}
                max={0.05}
                step={0.001}
                value={[threshold]}
                onValueChange={(value) => setThreshold(value[0])}
              />
              <p className="text-xs text-muted-foreground">Valores más bajos detectan silencios más sutiles</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="duration" className="text-sm">
                  Duración mínima de silencio (segundos)
                </Label>
                <span className="text-xs text-muted-foreground">{minSilenceDuration.toFixed(1)}s</span>
              </div>
              <Slider
                id="duration"
                min={0.1}
                max={2}
                step={0.1}
                value={[minSilenceDuration]}
                onValueChange={(value) => setMinSilenceDuration(value[0])}
              />
              <p className="text-xs text-muted-foreground">Silencios más cortos que este valor no serán eliminados</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Procesando audio...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {processedAudioUrl && processedAudioBlob && downloadUrl && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium">¡Audio listo!</span>
            </div>

            <audio ref={audioRef} controls className="w-full">
              <source src={processedAudioUrl} type="audio/wav" />
              Tu navegador no soporta la reproducción de audio.
            </audio>

            <div className="flex gap-2 w-full">
              <Button 
                onClick={handleOpenInNewTab} 
                className="flex-1 flex items-center justify-center gap-2" 
                variant="default"
                size="lg"
              >
                <ExternalLink className="h-4 w-4" />
                Descargar audio
              </Button>
              
              <Button 
                onClick={handleReset} 
                variant="outline" 
                className="flex items-center gap-2 px-3 whitespace-nowrap"
                size="lg"
              >
                <RotateCcw className="h-4 w-4" />
                Procesar de nuevo
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Solo mostrar el botón de procesar si no hay audio procesado */}
      {file && !processedAudioBlob && (
        <CardFooter>
          <Button onClick={handleProcessAudio} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Quitar silencios"
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
