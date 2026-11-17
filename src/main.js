import './style.css'
import { checkConnection, getDinnerReply, OpenAIError, MODEL } from './openai.js'
import { submitSurvey } from './survey.js'

const $ = (selector) => document.querySelector(selector)
const ui = {
  form: $('#intake-form'), profile: $('#profile-fields'), studentId: $('#student-id'), name: $('#student-name'),
  foods: [...document.querySelectorAll('input[name="food"]')], foodCount: $('#food-count'), foodError: $('#food-error'),
  key: $('#api-key'), toggleKey: $('#toggle-key'), connect: $('#connect-button'), connection: $('#connection-status'),
  start: $('#start-button'), startHint: $('#start-hint'), empty: $('#chat-empty'), conversation: $('#conversation'),
  messages: $('#messages'), composer: $('#chat-form'), message: $('#message-input'), send: $('#send-button'),
  typing: $('#typing-status'), chatError: $('#chat-error'), chatStatus: $('#chat-status'), progress: $('#chat-progress'),
  finish: $('#finish-button'), finishHint: $('#finish-hint'), submission: $('#submission-status'), restart: $('#restart-button'),
  profileSummary: $('#profile-summary'), consent: $('#consent'), steps: [...document.querySelectorAll('.steps li')],
  prompts: [...document.querySelectorAll('[data-prompt]')],
}
const state = {
  key: '', verified: false, checking: false, checkController: null,
  profile: null, messages: [], turns: 0, chatting: false, sending: false, submission: 'idle',
}
const selectedFoods = () => ui.foods.filter((input) => input.checked).map((input) => input.value)
const isLocked = () => state.sending || state.submission === 'sending' || state.submission === 'sent'

function setConnection(message, status = 'idle') {
  ui.connection.textContent = message
  ui.connection.dataset.status = status
}

function updateControls() {
  const ready = ui.studentId.value.trim() && ui.name.value.trim() && selectedFoods().length && ui.consent.checked
  ui.start.disabled = !ready || !state.verified || state.checking || state.chatting
  ui.start.hidden = state.chatting
  ui.startHint.hidden = state.chatting
  ui.startHint.textContent = !ready ? '학생 정보와 음식 취향을 입력하고 전송 안내에 동의해 주세요.'
    : !state.verified ? 'OpenAI API 연결을 확인하면 상담을 시작할 수 있어요.' : '준비됐어요. 오늘의 저녁 메뉴를 함께 골라 봐요.'
  ui.foodCount.textContent = `${selectedFoods().length}개 선택`
  ui.connect.disabled = !ui.key.value.trim() || state.checking || isLocked()
  ui.connect.textContent = state.checking ? '확인 중…' : state.verified ? '다시 확인' : '연결 확인'
  ui.connect.setAttribute('aria-busy', String(state.checking))
  ui.key.disabled = isLocked()
  ui.toggleKey.disabled = isLocked()
  ui.message.disabled = !state.chatting || !state.verified || state.checking || isLocked()
  ui.send.disabled = ui.message.disabled || !ui.message.value.trim()
  ui.send.setAttribute('aria-busy', String(state.sending))
  ui.prompts.forEach((button) => { button.disabled = ui.message.disabled })
  ui.finish.hidden = state.turns < 2 || state.submission === 'sent'
  ui.finish.disabled = state.checking || state.sending || state.submission === 'sending'
  ui.finish.textContent = state.submission === 'sending' ? '설문 전송 중…'
    : state.submission === 'failed' ? '설문 전송 다시 시도' : '상담 종료하기'
  ui.finish.setAttribute('aria-busy', String(state.submission === 'sending'))
  ui.progress.textContent = `대화 ${state.turns}회 완료`
  ui.finishHint.textContent = state.turns < 2
    ? `질문과 답변을 ${2 - state.turns}번 더 나누면 상담을 종료할 수 있어요.`
    : '종료하면 학생 정보, 선택한 음식, 전체 대화를 Google Form으로 전송해요.'
  ui.finishHint.hidden = !state.chatting || state.submission === 'sent'
  ui.typing.hidden = !state.sending
  ui.chatStatus.textContent = state.submission === 'sent' ? '상담 종료'
    : state.submission === 'sending' ? '설문 전송 중'
    : state.sending ? '메뉴를 생각하고 있어요'
    : state.chatting ? (state.verified ? '대화 중' : 'API 연결을 확인해 주세요') : '시작 대기'
}

function updateSteps(step) {
  ui.steps.forEach((item, index) => {
    item.dataset.state = index < step ? 'done' : index === step ? 'current' : 'upcoming'
    if (index === step) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
  })
}

function appendMessage(role, content) {
  const item = document.createElement('div')
  item.className = `message message--${role}`
  const author = document.createElement('span')
  author.className = 'message-author'
  author.textContent = role === 'user' ? '나' : '식탁 도우미'
  const text = document.createElement('p')
  text.className = 'message-content'
  text.textContent = content
  item.append(author, text)
  ui.messages.append(item)
  item.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  return item
}

ui.form.addEventListener('input', () => { ui.foodError.hidden = true; updateControls() })
ui.key.addEventListener('input', () => {
  state.checkController?.abort()
  state.checkController = null
  state.checking = false
  state.verified = false
  state.key = ''
  setConnection(ui.key.value.trim() ? '연결 확인이 필요해요.' : 'API Key를 입력해 주세요.')
  updateControls()
})
ui.key.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); ui.connect.click() }
})
ui.toggleKey.addEventListener('click', () => {
  const show = ui.key.type === 'password'
  ui.key.type = show ? 'text' : 'password'
  ui.toggleKey.textContent = show ? '숨기기' : '보기'
  ui.toggleKey.setAttribute('aria-pressed', String(show))
})
ui.connect.addEventListener('click', async () => {
  const key = ui.key.value.trim()
  if (!key || state.checking || isLocked()) return
  const controller = new AbortController()
  state.checkController = controller
  state.checking = true
  state.verified = false
  state.key = ''
  setConnection('실제 API 응답을 확인하고 있어요…', 'loading')
  updateControls()
  try {
    await checkConnection(key, controller.signal)
    if (state.checkController !== controller) return
    state.key = key
    state.verified = true
    setConnection(`${MODEL} 정상 작동 중`, 'success')
  } catch (error) {
    if (state.checkController !== controller) return
    setConnection(error.message, 'error')
  } finally {
    if (state.checkController === controller) { state.checkController = null; state.checking = false; updateControls() }
  }
})
ui.form.addEventListener('submit', (event) => {
  event.preventDefault()
  if (state.chatting || !state.verified || state.checking || !ui.form.reportValidity()) return
  const foods = selectedFoods()
  if (!foods.length) { ui.foodError.hidden = false; ui.foods[0].focus(); return }
  if (!ui.studentId.value.trim() || !ui.name.value.trim()) return
  state.profile = { studentId: ui.studentId.value.trim(), name: ui.name.value.trim(), foods }
  state.chatting = true
  ui.profile.disabled = true
  ui.empty.hidden = true
  ui.conversation.hidden = false
  ui.profileSummary.hidden = false
  ui.profileSummary.textContent = `${state.profile.name} 님이 고른 음식: ${foods.join(', ')}`
  const greeting = `반가워요! 오늘 저녁 메뉴를 함께 골라 볼게요. 좋아하는 음식은 ${foods.join(', ')}이군요. 오늘은 어떤 메뉴가 당기나요? 예산이나 맵기, 피하고 싶은 재료도 알려 주세요.`
  state.messages.push({ role: 'assistant', content: greeting })
  appendMessage('assistant', greeting)
  updateSteps(1)
  updateControls()
  ui.message.focus()
})
ui.message.addEventListener('input', updateControls)
ui.message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    if (!ui.send.disabled) ui.composer.requestSubmit()
  }
})
ui.prompts.forEach((button) => {
  button.addEventListener('click', () => {
    if (ui.message.disabled) return
    ui.message.value = button.dataset.prompt
    updateControls()
    ui.message.focus()
  })
})
ui.composer.addEventListener('submit', async (event) => {
  event.preventDefault()
  const content = ui.message.value.trim()
  if (!content || ui.message.disabled || isLocked()) return
  state.sending = true
  ui.chatError.hidden = true
  ui.message.value = ''
  const userMessage = { role: 'user', content }
  const pendingBubble = appendMessage('user', content)
  updateControls()
  try {
    const reply = await getDinnerReply(state.key, state.profile.foods, [...state.messages, userMessage])
    state.messages.push(userMessage, { role: 'assistant', content: reply })
    appendMessage('assistant', reply)
    state.turns += 1
  } catch (error) {
    pendingBubble.remove()
    ui.message.value = content
    ui.chatError.textContent = `${error.message} 입력한 메시지는 보관했어요. 다시 보내 주세요.`
    ui.chatError.hidden = false
    if (error instanceof OpenAIError && [401, 403].includes(error.status)) {
      state.verified = false
      state.key = ''
      setConnection('API Key 또는 모델 사용 권한을 확인하고 다시 연결해 주세요.', 'error')
    }
  } finally {
    state.sending = false
    updateControls()
    if (!ui.message.disabled) ui.message.focus()
  }
})
ui.finish.addEventListener('click', async () => {
  if (!state.chatting || state.turns < 2 || state.checking || isLocked()) return
  state.submission = 'sending'
  ui.submission.hidden = false
  ui.submission.dataset.status = 'loading'
  ui.submission.textContent = '전체 상담 내용을 Google Form으로 전송하고 있어요…'
  ui.chatError.hidden = true
  updateControls()
  try {
    await submitSurvey(state.profile, state.messages)
    state.submission = 'sent'
    state.key = ''
    state.verified = false
    ui.key.value = ''
    ui.key.type = 'password'
    ui.toggleKey.textContent = '보기'
    ui.toggleKey.setAttribute('aria-pressed', 'false')
    setConnection('상담이 종료되어 API Key를 지웠어요.')
    ui.submission.dataset.status = 'sent'
    ui.submission.textContent = '전송 요청을 보냈어요. 브라우저에서는 Google Form의 실제 저장 여부를 확인할 수 없어요. 설문 관리자의 응답 화면에서 확인해 주세요.'
    ui.restart.hidden = false
    updateSteps(2)
  } catch (error) {
    state.submission = 'failed'
    ui.submission.dataset.status = 'error'
    ui.submission.textContent = error.message
  } finally { updateControls() }
})
ui.restart.addEventListener('click', () => {
  state.checkController?.abort()
  Object.assign(state, { key: '', verified: false, checking: false, checkController: null, profile: null, messages: [], turns: 0, chatting: false, sending: false, submission: 'idle' })
  ui.form.reset()
  ui.profile.disabled = false
  ui.key.type = 'password'
  ui.messages.replaceChildren()
  ui.message.value = ''
  ui.empty.hidden = false
  ui.conversation.hidden = true
  ui.profileSummary.hidden = true
  ui.submission.hidden = true
  ui.restart.hidden = true
  ui.chatError.hidden = true
  setConnection('API Key를 입력해 주세요.')
  updateSteps(0)
  updateControls()
  ui.studentId.focus()
})
updateSteps(0)
updateControls()
