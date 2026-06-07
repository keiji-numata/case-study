require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')
const { VoyageAIClient } = require('voyageai')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

const searchParts = async ({ query, category }) => {
  // Embed the user's query
  const response = await voyage.embed({ input: query, model: 'voyage-3-lite' })
  const embedding = response.data[0].embedding

  // Vector similarity search against the parts table
  const { data, error } = await supabase.rpc('match_parts', {
    query_embedding: embedding,
    match_threshold: 0.35,
    match_count: 3,
    filter_category: category === 'both' ? null : category
  })

  if (error) {
    console.error('searchParts error:', error)
    return []
  }

  return data
}

module.exports = { searchParts }