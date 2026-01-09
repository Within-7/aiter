import { AppState, AppAction } from '../AppContext'

/**
 * Handles UI state actions (panels, settings, sidebar)
 */
export function uiReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      }

    case 'TOGGLE_PLUGIN_PANEL':
      return { ...state, showPluginPanel: !state.showPluginPanel }

    case 'SET_PLUGIN_PANEL':
      return { ...state, showPluginPanel: action.payload }

    case 'TOGGLE_ABOUT_PANEL':
      return { ...state, showAboutPanel: !state.showAboutPanel }

    case 'SET_ABOUT_PANEL':
      return { ...state, showAboutPanel: action.payload }

    case 'TOGGLE_SETTINGS_PANEL':
      return { ...state, showSettingsPanel: !state.showSettingsPanel }

    case 'SET_SETTINGS_PANEL':
      return { ...state, showSettingsPanel: action.payload }

    case 'TOGGLE_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: !state.showWorkspaceManager }

    case 'SET_WORKSPACE_MANAGER':
      return { ...state, showWorkspaceManager: action.payload }

    case 'TOGGLE_VOICE_PANEL':
      return { ...state, showVoicePanel: !state.showVoicePanel }

    case 'SET_VOICE_PANEL':
      return { ...state, showVoicePanel: action.payload }

    case 'ADD_VOICE_TRANSCRIPTION':
      return {
        ...state,
        voiceTranscriptions: [...state.voiceTranscriptions, action.payload]
      }

    case 'UPDATE_VOICE_TRANSCRIPTION':
      return {
        ...state,
        voiceTranscriptions: state.voiceTranscriptions.map(t =>
          t.id === action.payload.id ? { ...t, text: action.payload.text } : t
        )
      }

    case 'DELETE_VOICE_TRANSCRIPTION':
      return {
        ...state,
        voiceTranscriptions: state.voiceTranscriptions.filter(t => t.id !== action.payload)
      }

    case 'CLEAR_VOICE_TRANSCRIPTIONS':
      return { ...state, voiceTranscriptions: [] }

    case 'SET_VOICE_TRANSCRIPTIONS':
      return { ...state, voiceTranscriptions: action.payload }

    case 'SET_SIDEBAR_VIEW':
      return { ...state, sidebarView: action.payload }

    default:
      return state
  }
}
