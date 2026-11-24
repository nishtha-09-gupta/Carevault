const modelMetadataCache = new Map()

// Conservative tokenizer-free estimate: each ASCII code-point costs at least
// one token per three characters, while whitespace-delimited lexical pieces
// and punctuation are also counted. Non-ASCII code-points are counted one by
// one. Actual prompt_tokens returned by Groq are recorded for calibration.
export function estimateTokenCount(value) {
  const text = String(value || '')
  const ascii = text.match(/[\x00-\x7F]+/g)?.join('') || ''
  const lexical = ascii.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) || []
  const lexicalEstimate = lexical.reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / 3)), 0)
  const nonAsciiCount = [...text].filter((character) => character.codePointAt(0) > 0x7f).length
  return Math.max(lexicalEstimate + nonAsciiCount, Math.ceil([...text].length / 3))
}

export async function getModelTokenLimits(model, { client, env = process.env, now = Date.now() } = {}) {
  const cached = modelMetadataCache.get(model)
  if (cached && cached.expiresAt > now) return cached.value

  let record
  try {
    const listing = await client.models.list()
    record = listing.data?.find((candidate) => candidate.id === model)
  } catch (error) {
    const contextWindow = Number.parseInt(env.GROQ_CONTEXT_WINDOW_TOKENS || '', 10)
    if (!Number.isInteger(contextWindow) || contextWindow < 2048) {
      throw Object.assign(new Error('Groq model token limits could not be verified.'), { code: 'GROQ_MODEL_LIMITS_UNAVAILABLE', retryable: true })
    }
    return { contextWindow, maxCompletionTokens: null, source: 'backend-environment-override' }
  }

  const contextWindow = Number(record?.context_window ?? record?.context_length)
  const maxCompletionTokens = Number(record?.max_completion_tokens ?? record?.max_output_length)
  if (!record || !Number.isFinite(contextWindow) || contextWindow < 2048) {
    throw Object.assign(new Error('The configured Groq model did not report a usable context window.'), { code: 'GROQ_MODEL_LIMITS_UNAVAILABLE', retryable: false })
  }
  const value = { contextWindow, maxCompletionTokens: Number.isFinite(maxCompletionTokens) ? maxCompletionTokens : null, source: 'groq-model-metadata' }
  modelMetadataCache.set(model, { value, expiresAt: now + 60 * 60 * 1000 })
  return value
}

export function createTokenBudget({ systemPrompt, schema, modelLimits, env = process.env }) {
  const systemTokens = estimateTokenCount(systemPrompt) + 8
  const schemaTokens = estimateTokenCount(JSON.stringify(schema))
  const configuredOutput = Number.parseInt(env.GROQ_ANALYSIS_OUTPUT_TOKENS || '8192', 10)
  const outputTokens = Math.min(
    Number.isInteger(configuredOutput) && configuredOutput > 0 ? configuredOutput : 8192,
    modelLimits.maxCompletionTokens || Number.MAX_SAFE_INTEGER,
    Math.floor(modelLimits.contextWindow / 3),
  )
  const contextRemainder = Math.floor(modelLimits.contextWindow * 0.75) - systemTokens - schemaTokens - outputTokens - 32
  // Keep per-request result volume bounded as well as the input context. Large
  // output arrays can otherwise hit Groq's completion cap even when the input
  // fits the model context window.
  const configuredChunk = Number.parseInt(env.GROQ_ANALYSIS_CHUNK_TOKENS || '2000', 10)
  const chunkTokens = Math.min(Number.isInteger(configuredChunk) && configuredChunk > 0 ? configuredChunk : 2000, contextRemainder)
  if (chunkTokens < 256 || outputTokens < 256) {
    throw Object.assign(new Error('Groq token settings leave too little room for safe document analysis.'), { code: 'GROQ_TOKEN_BUDGET_INVALID', retryable: false })
  }
  return { systemTokens, schemaTokens, outputTokens, chunkTokens, contextWindow: modelLimits.contextWindow, estimatedRequestTokens: (inputText) => systemTokens + schemaTokens + outputTokens + estimateTokenCount(inputText) + 32 }
}

export function clearModelTokenLimitsCache() {
  modelMetadataCache.clear()
}
