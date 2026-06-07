const SERVER_URL = 'http://localhost:3001'

export const getAIMessage = async (userQuery, conversationHistory, onChunk) => {
  const messages = [
    ...conversationHistory.filter(m => m.role === 'user' || m.role === 'assistant'),
    { role: 'user', content: userQuery }
  ]

  const res = await fetch(`${SERVER_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let finalText = ''
  let partsData = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const lines = decoder.decode(value).split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      const chunk = JSON.parse(line.slice(6))

      if (chunk.type === 'text_delta') {
        finalText += chunk.text
        onChunk({ type: 'text_delta', text: chunk.text })
      }
      if (chunk.type === 'tool_use') onChunk({ type: 'tool_use', tool: chunk.tool })
      if (chunk.type === 'parts_data') partsData = chunk.data
    }
  }

  return {
    role: 'assistant',
    content: finalText,
    partsData: partsData.length > 0 ? partsData : null
  }
}