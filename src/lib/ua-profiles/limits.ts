export type UaProfileLimits = {
  /** Max characters accepted for a custom User-Agent string (trimmed, local-only). */
  maxCustomUaChars: number;
};

export const UA_PROFILE_LIMITS: UaProfileLimits = {
  maxCustomUaChars: 256,
};
