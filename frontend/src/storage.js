function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// localStorage 存的格式：{ [roomId]: uuid }
// 這樣每個房間有獨立身分，加入新房間會拿到新 UUID
export function getPlayerId(roomId) {
  const map = JSON.parse(localStorage.getItem('playerIds') || '{}')
  if (!map[roomId]) {
    map[roomId] = generateUUID()
    localStorage.setItem('playerIds', JSON.stringify(map))
  }
  return map[roomId]
}

export function getHostId() {
  let hostId = localStorage.getItem('hostId')
  if (!hostId) {
    hostId = generateUUID()
    localStorage.setItem('hostId', hostId)
  }
  return hostId
}
