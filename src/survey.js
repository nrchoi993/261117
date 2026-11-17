export const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfvqrb3-y8SPsFodv7ssGQ6pwTLGZu0Vigm9FlFqj8sL07mKw/formResponse'

export function buildSurveyBody(profile, messages) {
  return new URLSearchParams({
    'entry.70833716': profile.studentId,
    'entry.1623743240': profile.name,
    'entry.1317938242': profile.foods.join(','),
    'entry.976474171': messages.map(({ role, content }) => `${role === 'user' ? '학생' : '챗봇'}: ${content}`).join('\n\n'),
  })
}

export async function submitSurvey(profile, messages) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(FORM_URL, {
      method: 'POST', mode: 'no-cors', credentials: 'omit',
      body: buildSurveyBody(profile, messages), signal: controller.signal,
    })
    // A no-cors opaque response cannot expose Google's status or stored result.
    if (response.type !== 'opaque' && !response.ok) throw new Error('Request failed')
  } catch {
    throw new Error('전송을 확인하지 못했어요. 대화는 이 화면에 남아 있어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요. 이미 저장됐을 수도 있으니 재시도 전 설문 응답을 확인해 주세요.')
  } finally {
    clearTimeout(timeout)
  }
}
