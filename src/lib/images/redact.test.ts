import {describe, expect, it} from 'vitest';

import {sanitizeErrorMessage} from './redact';

describe('sanitizeErrorMessage', () => {
  it('redacts a Basic authorization header value', () => {
    const result = sanitizeErrorMessage('Request failed: Authorization: Basic ZmFrZTpzZWNyZXQ=');

    expect(result).not.toContain('ZmFrZTpzZWNyZXQ=');
    expect(result).toContain('Authorization: Basic [REDACTED]');
  });

  it('redacts a Bearer authorization header value', () => {
    const result = sanitizeErrorMessage('authorization: Bearer abc.def.ghi');

    expect(result).not.toContain('abc.def.ghi');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts client_secret query/body params', () => {
    const result = sanitizeErrorMessage('POST failed with body client_secret=super-secret-value&other=1');

    expect(result).not.toContain('super-secret-value');
    expect(result).toContain('client_secret=[REDACTED]');
  });

  it('redacts userinfo credentials embedded in a URL', () => {
    const result = sanitizeErrorMessage('fetch https://myuser:mypassword@sandbox.demandware.net/path failed');

    expect(result).not.toContain('myuser:mypassword');
    expect(result).toContain('://[REDACTED]@sandbox.demandware.net');
  });

  it('accepts an Error instance and redacts its message', () => {
    const result = sanitizeErrorMessage(new Error('access_token=leaked-token-value'));

    expect(result).not.toContain('leaked-token-value');
  });

  it('leaves ordinary messages unchanged', () => {
    expect(sanitizeErrorMessage('404 Not Found')).toBe('404 Not Found');
  });

  it('stringifies non-Error, non-string input', () => {
    expect(sanitizeErrorMessage({code: 'ENOENT'})).toBe('[object Object]');
  });
});
