import { render, screen } from '@testing-library/react';
import App from './App';

test('renders home screen for unauthenticated user', () => {
  localStorage.removeItem('vynedam_user');
  localStorage.removeItem('vynedam_token');

  render(<App />);
  expect(screen.getByText(/login/i)).toBeInTheDocument();
});