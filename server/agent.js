const Anthropic = require('@anthropic-ai/sdk')
const { searchParts } = require('./tools/searchParts')
const { checkCompatibility } = require('./tools/checkCompatibility')
const { getPartDetails } = require('./tools/getPartDetails')
const { troubleshoot } = require('./tools/troubleshoot')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `
You are a helpful assistant for PartSelect, an appliance parts retailer.
You ONLY help with refrigerator and dishwasher parts — nothing else.
If a user asks about anything outside of this scope, respond with:
"I can only help with refrigerator and dishwasher parts. What part are you looking for?"

When answering:
- Always use your tools to look up real part data before responding
- Present parts clearly with their part number, name, and price
- For compatibility questions, always check using the check_compatibility tool
- For troubleshooting, use the troubleshoot tool then suggest relevant parts
`

const TOOLS = [
  {
    name: 'search_parts',
    description: 'Search for refrigerator or dishwasher parts by description, symptom, or part name',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query e.g. "ice maker motor" or "dishwasher pump"' },
        category: { type: 'string', enum: ['refrigerator', 'dishwasher', 'both'], description: 'Appliance category' }
      },
      required: ['query', 'category']
    }
  },
  {
    name: 'check_compatibility',
    description: 'Check if a part is compatible with a specific appliance model number',
    input_schema: {
      type: 'object',
      properties: {
        part_number: { type: 'string', description: 'The part number e.g. PS11752778' },
        model_number: { type: 'string', description: 'The appliance model number e.g. WDT780SAEM1' }
      },
      required: ['part_number', 'model_number']
    }
  },
  {
    name: 'get_part_details',
    description: 'Get full details about a specific part including installation instructions and price',
    input_schema: {
      type: 'object',
      properties: {
        part_number: { type: 'string', description: 'The part number to look up' }
      },
      required: ['part_number']
    }
  },
  {
    name: 'troubleshoot',
    description: 'Get troubleshooting steps and likely parts needed for an appliance symptom',
    input_schema: {
      type: 'object',
      properties: {
        appliance: { type: 'string', enum: ['refrigerator', 'dishwasher'] },
        symptom: { type: 'string', description: 'What the appliance is doing wrong e.g. "ice maker not working"' }
      },
      required: ['appliance', 'symptom']
    }
  }
]

const toolHandlers = {
  search_parts: searchParts,
  check_compatibility: checkCompatibility,
  get_part_details: getPartDetails,
  troubleshoot: troubleshoot
}

async function handleChat(messages, onChunk) {
  const cleanMessages = messages.map(m => ({ role: m.role, content: m.content }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: cleanMessages
  })

  if (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const toolResults = []

    for (const toolUse of toolUseBlocks) {
      const handler = toolHandlers[toolUse.name]
      const result = await handler(toolUse.input)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result)
      })
      onChunk({ type: 'tool_use', tool: toolUse.name, input: toolUse.input })
    }

    const finalResponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [
        ...cleanMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ]
    })

    const textBlock = finalResponse.content.find(b => b.type === 'text')
    onChunk({ type: 'text', text: textBlock?.text ?? '' })

    const structuredData = toolResults.map(r => JSON.parse(r.content))
    onChunk({ type: 'parts_data', data: structuredData })

  } else {
    const textBlock = response.content.find(b => b.type === 'text')
    onChunk({ type: 'text', text: textBlock?.text ?? '' })
  }
}

module.exports = { handleChat }