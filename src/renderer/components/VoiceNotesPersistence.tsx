import { useVoiceNotesPersistence } from '../hooks/useVoiceNotesPersistence'

/**
 * Invisible component that handles voice notes persistence.
 *
 * This component should be rendered at the App level to ensure
 * voice notes are loaded/saved regardless of VoicePanel visibility.
 */
export function VoiceNotesPersistence(): null {
  useVoiceNotesPersistence()
  return null
}
