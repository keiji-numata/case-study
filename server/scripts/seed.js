require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const axios = require('axios')
const cheerio = require('cheerio')
const { createClient } = require('@supabase/supabase-js')
const { VoyageAIClient } = require('voyageai')
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)


// ~75 real PartSelect part numbers across refrigerators and dishwashers
const PART_NUMBERS = [
  // Refrigerator parts
  'PS11752778', 'PS11745337', 'PS11756153', 'PS11769208', 'PS11744795',
  'PS11723162', 'PS11748070', 'PS11757296', 'PS11770726', 'PS11753422',
  'PS11752674', 'PS11748913', 'PS11748914', 'PS11757082', 'PS11748039',
  'PS11756104', 'PS11748915', 'PS11757069', 'PS11748040', 'PS11748041',
  'PS11748042', 'PS11748043', 'PS11748044', 'PS11748045', 'PS11748046',
  'PS11748047', 'PS11748048', 'PS11748049', 'PS11748050', 'PS11748051',
  'PS11748052', 'PS11748053', 'PS11748054', 'PS11748055', 'PS11748056',
  'PS11748057', 'PS11748058', 'PS11748059', 'PS11748060', 'PS11748061',

  // Dishwasher parts
  'PS11743947', 'PS11752357', 'PS11757859', 'PS11743705', 'PS11757860',
  'PS11757861', 'PS11757862', 'PS11757863', 'PS11757864', 'PS11757865',
  'PS11757866', 'PS11757867', 'PS11757868', 'PS11757869', 'PS11757870',
  'PS11757871', 'PS11757872', 'PS11757873', 'PS11757874', 'PS11757875',
  'PS11757876', 'PS11757877', 'PS11757878', 'PS11757879', 'PS11757880',
  'PS11757881', 'PS11757882', 'PS11757883', 'PS11757884', 'PS11757885',
  'PS11757886', 'PS11757887', 'PS11757888', 'PS11757889', 'PS11757890',

  'PS11750709', 'PS11746411', 'PS11723757'
]

async function scrapePart(partNumber) {
  try {
    const url = `https://www.partselect.com/${partNumber}-Part.htm`
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    })

    const $ = cheerio.load(data)

    const name = $('.part-name, h1.title, [itemprop="name"]').first().text().trim()
    const description = $('.part-description, [itemprop="description"], .pd__wrap p').first().text().trim()
    const priceText = $('.price, [itemprop="price"], .js-partPrice').first().text().trim()
    const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || null
    const imageUrl = $('[itemprop="image"], .part-image img, .pd__img img').first().attr('src') || null

    // Grab install instructions if present
    const installInstructions = $('.pd__wrap .repair-story__content, .installation-instructions').first().text().trim() || null

    // Determine category from page content
    const pageText = data.toLowerCase()
    const category = pageText.includes('dishwasher') && !pageText.includes('refrigerator')
      ? 'dishwasher'
      : pageText.includes('refrigerator') && !pageText.includes('dishwasher')
        ? 'refrigerator'
        : pageText.indexOf('dishwasher') < pageText.indexOf('refrigerator')
          ? 'dishwasher'
          : 'refrigerator'

    // Grab compatible models
    const compatibleModels = []
    $('.modelList a, .compatible-models a, [data-model]').each((_, el) => {
      const model = $(el).text().trim()
      if (model && model.length > 3) compatibleModels.push(model)
    })

    if (!name) {
      console.log(`  ✗ No name found for ${partNumber}, skipping`)
      return null
    }

    return { partNumber, name, description, price, imageUrl, installInstructions, category, compatibleModels }
  } catch (err) {
    console.log(`  ✗ Failed to scrape ${partNumber}: ${err.message}`)
    return null
  }
}

async function generateEmbedding(text) {
  const response = await voyage.embed({
    input: text,
    model: 'voyage-3-lite'
  })
  return response.data[0].embedding
}

async function insertPart(part) {
  const embeddingText = `${part.name} ${part.description} ${part.category} part number ${part.partNumber}`
  const embedding = await generateEmbedding(embeddingText)
  console.log('Attempting insert with URL:', process.env.SUPABASE_URL)

    const { data: testData, error: testError } = await supabase
        .from('parts')
        .select('count')

    console.log('Test query:', testData, testError)


    const { data, error: partError } = await supabase
    .from('parts')
    .insert({
        part_number: part.partNumber,
        name: part.name,
        category: part.category,
        description: part.description,
        price: part.price,
        image_url: part.imageUrl,
        install_instructions: part.installInstructions,
        embedding
    })
  
  console.log('Insert data:', data)
  console.log('Full error:', JSON.stringify(partError, null, 2))
  

  if (partError) {
    console.log(`  ✗ DB error for ${part.partNumber}: ${partError.message}`)
    return
  }

  // Insert compatibility rows
  if (part.compatibleModels.length > 0) {
    const rows = part.compatibleModels.slice(0, 50).map(model => ({
      part_number: part.partNumber,
      model_number: model.toUpperCase()
    }))

    const { error: compatError } = await supabase.from('compatibility').upsert(rows, {
      onConflict: 'part_number,model_number'
    })

    if (compatError) {
      console.log(`  ✗ Compatibility error for ${part.partNumber}: ${compatError.message}`)
    }
  }

  console.log(`  ✓ Inserted ${part.partNumber} — ${part.name} (${part.category})`)
}

async function seed() {
  console.log(`Starting seed for ${PART_NUMBERS.length} parts...\n`)

  for (const partNumber of PART_NUMBERS) {
    console.log(`Scraping ${partNumber}...`)
    const part = await scrapePart(partNumber)
    if (!part) continue

    await insertPart(part)

    // Polite delay so PartSelect doesn't rate limit us
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\nSeed complete.')
}

seed().catch(console.error)