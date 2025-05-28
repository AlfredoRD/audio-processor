import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo de audio" }, { status: 400 })
    }

    // Simulamos el procesamiento con un retraso
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Para este ejemplo, devolvemos el mismo archivo como si fuera procesado
    // En una implementación real, aquí procesarías el audio para quitar silencios
    const arrayBuffer = await audioFile.arrayBuffer()

    // Crear una respuesta con el archivo de audio
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": audioFile.type,
        "Content-Disposition": `attachment; filename="audio-sin-silencios.${audioFile.name.split(".").pop()}"`,
      },
    })
  } catch (error) {
    console.error("Error al procesar el audio:", error)
    return NextResponse.json({ error: "Error al procesar el archivo de audio" }, { status: 500 })
  }
}
