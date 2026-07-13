/** Split robots content into directive tokens (comma / whitespace; includes `none`). */
export function parseRobotsDirectiveTokens(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[,;\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
