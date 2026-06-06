require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const getPartDetails = async ({ part_number }) => {
  const { data, error } = await supabase
    .from('parts')
    .select('part_number, name, category, description, price, image_url, install_instructions')
    .eq('part_number', part_number)
    .maybeSingle()

  if (error) {
    console.error('getPartDetails error:', error)
    return null
  }

  if (!data) {
    return { message: `Part ${part_number} was not found in our catalog.` }
  }

  // Also grab a sample of compatible models
  const { data: compatibleModels } = await supabase
    .from('compatibility')
    .select('model_number')
    .eq('part_number', part_number)
    .limit(10)

  return {
    ...data,
    compatible_models: compatibleModels?.map(r => r.model_number) ?? []
  }
}

module.exports = { getPartDetails }