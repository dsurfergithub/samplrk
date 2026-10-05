/**
 * oldSchoolActions.js — activar y ajustar el modo Old School (por proyecto).
 */
import { OLD_SCHOOL_PRESETS, oldSchoolOf, DEFAULT_OLD_SCHOOL } from '../engines/oldSchool'
import { commit, getProject } from '../state/projectStore'
import { notify } from './learningActions'

export function setOldSchool(patch) {
  commit(p => ({ ...p, settings: { ...p.settings, oldSchool: { ...oldSchoolOf(p), ...patch } } }))
}

export function enableOldSchool(presetId = 'classic') {
  const preset = OLD_SCHOOL_PRESETS.find(x => x.id === presetId) ?? OLD_SCHOOL_PRESETS[0]
  const was = oldSchoolOf(getProject()).enabled
  setOldSchool({ ...DEFAULT_OLD_SCHOOL, ...preset.settings, enabled: true, preset: preset.id })
  if (!was) notify({ type: 'oldschool:on' })
}

export function disableOldSchool() { setOldSchool({ enabled: false }) }
