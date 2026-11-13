import { describe, expect, it } from 'vitest';

import { buildStatus, ENGINEERING_PHASE } from '../src/utils/build-info';

describe('build info', () => {
  it('reports the current engineering phase without business logic', () => {
    expect(ENGINEERING_PHASE).toBe('P1-01');
    expect(buildStatus(ENGINEERING_PHASE)).toBe('工程阶段 P1-01');
  });
});
