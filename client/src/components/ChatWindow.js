import React, { useState, useEffect, useRef } from 'react'
import './ChatWindow.css'
import { getAIMessage } from '../api/api'
import { marked } from 'marked'

const SEARCHING_LABELS = {
  search_parts: 'Searching parts catalog...',
  check_compatibility: 'Checking compatibility...',
  get_part_details: 'Fetching part details...',
  troubleshoot: 'Looking up troubleshooting steps...'
}

function ProductCard({ part }) {
  if (!part || !part[0]) return null
  const p = part[0]
  return (
    <div className="product-card">
      {p.image_url && <img src={p.image_url} alt={p.name} />}
      <div className="product-card-info">
        <span className="product-part-number">{p.part_number}</span>
        <span className="product-name">{p.name}</span>
        {p.price && <span className="product-price">${p.price}</span>}
      </div>
      <a
        className="product-card-button"
        href={`https://www.partselect.com/PS${p.part_number}-Part.htm`}
        target="_blank"
        rel="noreferrer"
      >
        View on PartSelect
      </a>
    </div>
  )
}

function ChatWindow() {
  const defaultMessage = [{
    role: 'assistant',
    content: 'Hi! I can help you find refrigerator and dishwasher parts. What are you looking for?'
  }]

  const [messages, setMessages] = useState(defaultMessage)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [statusLabel, setStatusLabel] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, statusLabel])

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return

    const userInput = input
    setInput('')
    setIsLoading(true)
    setStatusLabel('')

    const updatedMessages = [...messages, { role: 'user', content: userInput }]
    setMessages(updatedMessages)

    try {
      const response = await getAIMessage(
        userInput,
        messages,
        (chunk) => {
          if (chunk.type === 'tool_use') {
            setStatusLabel(SEARCHING_LABELS[chunk.tool] ?? 'Thinking...')
          }
        }
      )

      setStatusLabel('')
      setMessages(prev => [...prev, response])
    } catch (err) {
      setStatusLabel('')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="messages-container">
      {messages.map((message, index) => (
        <div key={index} className={`${message.role}-message-container`}>
          {message.content && (
            <div className={`message ${message.role}-message`}>
              <div dangerouslySetInnerHTML={{
                __html: marked(message.content).replace(/<p>|<\/p>/g, '')
              }} />
            </div>
          )}
          {message.partsData && (
            <div className="product-cards-row">
              {message.partsData.map((part, i) => (
                <ProductCard key={i} part={part} />
              ))}
            </div>
          )}
        </div>
      ))}

      {statusLabel && (
        <div className="assistant-message-container">
          <div className="message assistant-message status-label">
            {statusLabel}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a part, model number, or symptom..."
          disabled={isLoading}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              handleSend()
              e.preventDefault()
            }
          }}
          rows="3"
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={isLoading}
        >
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

export default ChatWindow