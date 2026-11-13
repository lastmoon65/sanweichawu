import { describe, expect, it } from 'vitest';

import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module.js';

describe('AppModule', () => {
  it('compiles as an empty engineering skeleton', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
