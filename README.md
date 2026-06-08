# PartSelect Chat Agent

A full-stack AI chat agent for PartSelect built as part of the Instalily AI case study. Helps customers find refrigerator and dishwasher parts, check compatibility, troubleshoot issues, and track orders.

## Demo

[Live Demo](your-deployed-url-here) · [Loom Walkthrough](your-loom-url-here)

## Tech Stack

- **Frontend**: React (CRA) with SSE streaming
- **Backend**: Express + Claude claude-sonnet-4-5 with tool-calling
- **Vector Search**: Supabase pgvector + Voyage AI embeddings
- **Data**: ~75 seeded PartSelect parts across refrigerators and dishwashers

## Architecture

The agent uses Claude's tool-calling API as the orchestrator. Each user message goes through a loop where Claude decides which tools to call, executes them against Supabase, and synthesizes a final response with relevant parts displayed as product cards.

### Tools
- `search_parts` — semantic vector search over the parts catalog
- `check_compatibility` — model number compatibility lookup  
- `get_part_details` — full part specs, price, and install instructions
- `troubleshoot` — symptom-based parts recommendation
- `get_order_status` — order tracking by order number

## Running Locally

### Prerequisites
- Node.js 18+
- Supabase account
- Anthropic API key
- Voyage AI API key

### Setup

1. Clone the repo
```bash
   git clone https://github.com/yourusername/instalily-case-study
   cd instalily-case-study
```

2. Install dependencies
```bash
   npm install
   cd server && npm install
   cd ../client && npm install
```

3. Create a `.env` file in the root:

4. Set up Supabase — run the SQL in `server/scripts/schema.sql` in your Supabase SQL editor

5. Seed the database
```bash
   cd server
   node scripts/seed.js
```

6. Run the app
```bash
   cd ..
   npm run dev
```

The client runs on `http://localhost:3000` and the server on `http://localhost:3001`.

## Example Queries

- "How can I install part number PS11752778?"
- "Is this part compatible with my WDT780SAEM1 model?"
- "The ice maker on my Whirlpool fridge is not working"
- "What's the status of order ORD-123456?"