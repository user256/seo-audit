export { UA_PROFILE_LIMITS, type UaProfileLimits } from './limits';
export {
  DEFAULT_UA_PROFILE_PREFERENCE,
  loadUaProfilePreference,
  saveUaProfilePreference,
  type UaProfilePreference,
} from './preference-storage';
export {
  GOOGLEBOT_STYLE_USER_AGENT,
  GOOGLEBOT_STYLE_USER_AGENT_SOURCE_NOTE,
  UA_PROFILE_DEFINITIONS,
} from './profiles';
export { resolveUaProfile } from './resolve-profile';
export type {
  UaProfileDefinition,
  UaProfileId,
  UaProfileMethod,
  UaProfileResult,
  UaProfileSelection,
} from './types';
