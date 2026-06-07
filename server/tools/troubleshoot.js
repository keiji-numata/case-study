require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')
const { VoyageAIClient } = require('voyageai')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

const troubleshoot = async ({ appliance, symptom }) => {
  // Search for parts related to the symptom
  const response = await voyage.embed({ input: symptom, model: 'voyage-3-lite' })
  const embedding = response.data[0].embedding

  const { data, error } = await supabase.rpc('match_parts', {
    query_embedding: embedding,
    match_threshold: 0.35,
    match_count: 3,
    filter_category: appliance
  })

  if (error) {
    console.error('troubleshoot error:', error)
    return { steps: [], parts: [] }
  }

  return {
    appliance,
    symptom,
    related_parts: data ?? []
  }
}

module.exports = { troubleshoot }