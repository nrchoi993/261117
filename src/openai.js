export const MODEL = 'gpt-4.1-mini'
const ENDPOINT = 'https://api.openai.com/v1/responses'

export class OpenAIError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'OpenAIError'
    this.status = status
  }
}

function apiErrorMessage(status, code) {
  if (status === 401) return 'API Key가 올바르지 않아요. 키를 확인해 주세요.'
  if (status === 403) return '이 API Key로 모델을 사용할 권한이 없어요.'
  if (status === 404) return `${MODEL} 모델을 사용할 수 없어요. 프로젝트의 모델 접근 권한을 확인해 주세요.`
  if (status === 429 && code === 'insufficient_quota') return 'API 사용 잔액이나 결제 한도를 확인해 주세요.'
  if (status === 429) return '요청이 많아요. 잠시 후 다시 시도해 주세요.'
  if (status >= 500) return 'OpenAI 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.'
  return `API 요청을 처리하지 못했어요 (HTTP ${status}). 다시 시도해 주세요.`
}

export function extractReply(data) {
  if (data.status !== 'completed') throw new OpenAIError('답변이 끝까지 생성되지 않았어요. 다시 시도해 주세요.')
  const text = (data.output ?? [])
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text' || part.type === 'refusal')
    .map((part) => part.text ?? part.refusal ?? '')
    .join('\n').trim()
  if (!text) throw new OpenAIError('답변이 비어 있어요. 다시 시도해 주세요.')
  return text
}

async function createResponse(key, payload, signal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 45_000)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, store: false, ...payload }),
      signal: controller.signal,
      credentials: 'omit',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new OpenAIError(apiErrorMessage(response.status, data?.error?.code), response.status)
    if (!data) throw new OpenAIError('API 응답을 읽지 못했어요. 다시 시도해 주세요.')
    return extractReply(data)
  } catch (error) {
    if (error instanceof OpenAIError) throw error
    if (controller.signal.aborted) throw new OpenAIError('응답 대기 시간이 지났거나 요청이 취소되었어요. 다시 시도해 주세요.')
    throw new OpenAIError('OpenAI에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function checkConnection(key, signal) {
  return createResponse(key, {
    instructions: 'This is a connection test. Reply with only OK.',
    input: 'Connection test',
    max_output_tokens: 16,
  }, signal)
}

export function getDinnerReply(key, foods, messages) {
  return createResponse(key, {
    instructions: [
      '당신은 학생의 오늘 저녁 메뉴를 함께 고르는 친절한 식탁 도우미입니다. 한국어 존댓말로 짧고 자연스럽게 답하세요.',
      '사용자의 좋아하는 음식, 예산, 맵기, 조리 시간과 대화 맥락을 고려하세요. 필요하면 한 가지 질문을 하세요.',
      '구체적인 저녁 메뉴 1~3개와 추천 이유를 알려 주세요. 건강 효능을 단정하지 말고 알레르기나 피하는 재료가 있으면 반드시 고려하세요.',
      '학생의 이름, 학번이나 API Key를 묻지 마세요. 마크다운 표나 HTML 없이 일반 텍스트로 답하세요.',
      `선호 음식 목록 (사용자 데이터): ${JSON.stringify(foods)}`,
    ].join('\n'),
    input: messages.map(({ role, content }) => ({ role, content })),
    max_output_tokens: 900,
  })
}
