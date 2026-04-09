import { useEffect, useState } from 'react'
import { socket } from '../socket.js'

const initialState = {
  status: 'waiting', // waiting | playing | voting | revoting | finished
  players: [],
  round: 0,
  currentSpeakerId: null,
  speakerName: null,
  spokenThisRound: [],
  candidates: [],
  tieCandidates: [],
  tieReason: '',
  winner: null,
  role: null,
  word: null,
  eliminatedPlayer: null,
  error: null
}

export function useRoomState() {
  const [roomState, setRoomState] = useState(initialState)

  useEffect(() => {
    function onRoomUpdated(data) {
      setRoomState(prev => ({
        ...prev,
        players: data.players ?? prev.players,
        status: data.status ?? prev.status,
        round: data.round ?? prev.round,
        currentSpeakerId: data.currentSpeakerId ?? prev.currentSpeakerId
      }))
    }

    function onRoleAssigned(data) {
      setRoomState(prev => ({
        ...prev,
        role: data.role,
        word: data.word
      }))
    }

    function onSpeakerChanged(data) {
      setRoomState(prev => ({
        ...prev,
        currentSpeakerId: data.currentSpeakerId,
        speakerName: data.speakerName,
        spokenThisRound: data.spokenThisRound ?? prev.spokenThisRound,
        // Keep 'revoting' status if already in revoting phase so UI stays correct
        status: prev.status === 'revoting' ? 'revoting' : 'playing'
      }))
    }

    function onVotingStarted(data) {
      setRoomState(prev => ({
        ...prev,
        status: 'voting',
        candidates: data.candidates ?? []
      }))
    }

    function onRevoteStarted(data) {
      setRoomState(prev => ({
        ...prev,
        status: 'revoting',
        tieCandidates: data.tieCandidates ?? [],
        tieReason: data.reason ?? '',
        currentSpeakerId: null,
        speakerName: null,
        spokenThisRound: []
      }))
    }

    function onPlayerEliminated(data) {
      setRoomState(prev => ({
        ...prev,
        eliminatedPlayer: data
      }))
    }

    function onGameOver(data) {
      setRoomState(prev => ({
        ...prev,
        status: 'finished',
        winner: data.winner,
        players: data.players ?? prev.players
      }))
    }

    function onError(data) {
      setRoomState(prev => ({
        ...prev,
        error: data
      }))
    }

    socket.on('room_updated', onRoomUpdated)
    socket.on('role_assigned', onRoleAssigned)
    socket.on('speaker_changed', onSpeakerChanged)
    socket.on('voting_started', onVotingStarted)
    socket.on('revote_started', onRevoteStarted)
    socket.on('player_eliminated', onPlayerEliminated)
    socket.on('game_over', onGameOver)
    socket.on('error', onError)

    return () => {
      socket.off('room_updated', onRoomUpdated)
      socket.off('role_assigned', onRoleAssigned)
      socket.off('speaker_changed', onSpeakerChanged)
      socket.off('voting_started', onVotingStarted)
      socket.off('revote_started', onRevoteStarted)
      socket.off('player_eliminated', onPlayerEliminated)
      socket.off('game_over', onGameOver)
      socket.off('error', onError)
    }
  }, [])

  function clearError() {
    setRoomState(prev => ({ ...prev, error: null }))
  }

  function clearEliminated() {
    setRoomState(prev => ({ ...prev, eliminatedPlayer: null }))
  }

  return { roomState, setRoomState, clearError, clearEliminated }
}
