
import { describe, it, expect, beforeEach } from 'vitest';

describe('AI Mystery Room frontend', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('creates the root application container', () => {
    const root = document.getElementById('root');

    expect(root).not.toBeNull();
    expect(root.tagName).toBe('DIV');
  });
});
