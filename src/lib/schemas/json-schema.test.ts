import { describe, expect, it } from 'vitest';
import { auditSessionJsonSchema } from './json-schema';

describe('auditSessionJsonSchema', () => {
  it('emits a JSON Schema object named AuditSession', () => {
    const schema = auditSessionJsonSchema();
    expect(schema).toMatchObject({
      $schema: expect.stringContaining('http'),
    });
    expect(JSON.stringify(schema)).toMatch(/AuditSession|schemaVersion/);
  });
});
