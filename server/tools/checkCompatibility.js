require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const checkCompatibility = async ({ part_number, model_number }) => {
  // Normalize the model number — strip spaces, uppercase
  const normalizedModel = model_number.trim().toUpperCase()

  const { data, error } = await supabase
    .from('compatibility')
    .select('part_number, model_number')
    .eq('part_number', part_number)
    .eq('model_number', normalizedModel)
    .maybeSingle()

  if (error) {
    console.error('checkCompatibility error:', error)
    return { compatible: false, message: 'Error checking compatibility.' }
  }

  if (data) {
    return {
      compatible: true,
      part_number,
      model_number: normalizedModel,
      message: `Part ${part_number} is compatible with model ${normalizedModel}.`
    }
  }

  // Not found in compatibility table — check if part exists at all
  const { data: part } = await supabase
    .from('parts')
    .select('part_number, name')
    .eq('part_number', part_number)
    .maybeSingle()

  if (!part) {
    return {
      compatible: false,
      message: `Part ${part_number} was not found in our catalog.`
    }
  }

  return {
    compatible: false,
    part_number,
    model_number: normalizedModel,
    message: `Part ${part_number} (${part.name}) does not appear to be compatible with model ${normalizedModel} based on our records.`
  }
}

module.exports = { checkCompatibility }