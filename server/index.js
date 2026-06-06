require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const express = require('express')
const cors = require('cors')
const { handleChat } = require('./agent')

const app = express()
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  console.log('Chat endpoint hit, messages:', req.body.messages?.length)

  const { messages } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    console.log('Calling handleChat...')
    await handleChat(messages, (chunk) => {
        console.log('Chunk received:', chunk.type)
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
    })
    console.log('handleChat complete')
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error(err)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
})

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})