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
  console.log('Rendering card for part:', part)
  if (!part) return null
  return (
    <div className="product-card">
      {part.image_url
        ? <img src={part.image_url} alt={part.name} />
        : <div className="product-card-no-image">No image available</div>
      }
      <div className="product-card-info">
        <span className="product-part-number">{part.part_number}</span>
        <span className="product-name">{part.name}</span>
        {part.price
          ? <span className="product-price">${part.price}</span>
          : <span className="product-price">Check site for price</span>
        }
      </div>
      
      <a
        className="product-card-button"
        href={`https://www.partselect.com/${part.part_number}-Part.htm`}
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

  // Add an empty assistant message that we'll stream into
  setMessages(prev => [...prev, { role: 'assistant', content: '', partsData: null }])

  try {
    let streamedText = ''

    const response = await getAIMessage(
      userInput,
      messages,
      (chunk) => {
        if (chunk.type === 'tool_use') {
          setStatusLabel(SEARCHING_LABELS[chunk.tool] ?? 'Thinking...')
        }
        if (chunk.type === 'text_delta') {
          streamedText += chunk.text
          // Update the last message in place as tokens arrive
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: streamedText,
              partsData: null
            }
            return updated
          })
        }
      }
    )

    // Final update with parts data
    setStatusLabel('')
    setMessages(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = response
      return updated
    })

  } catch (err) {
    setStatusLabel('')
    setMessages(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: 'assistant',
        content: 'Something went wrong. Please try again.'
      }
      return updated
    })
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