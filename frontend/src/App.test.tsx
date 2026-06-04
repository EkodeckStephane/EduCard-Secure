import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

function Smoke() {
  return <h1>EduCard Secure</h1>;
}

describe('frontend phase 3', () => {
  it('renders the application identity', () => {
    render(<Smoke />);
    expect(screen.getByText('EduCard Secure')).toBeInTheDocument();
  });
});
