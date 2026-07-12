import { zodToJsonSchema } from 'zod-to-json-schema';
import { AuditSessionSchema } from './audit';

/**
 * JSON Schema projection of the audit session contract for Ticket 402 exports.
 * Runtime validation stays on Zod; this is a derived artefact.
 */
export function auditSessionJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(AuditSessionSchema, {
    name: 'AuditSession',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
}
