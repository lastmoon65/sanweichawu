import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../src/App';

describe('App', () => {
  it('renders the engineering skeleton without business modules', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: '三味茶屋' })).toBeInTheDocument();
    expect(screen.getByText('工程基础已就绪')).toBeInTheDocument();
    expect(screen.queryByText('登录')).not.toBeInTheDocument();
  });
});
