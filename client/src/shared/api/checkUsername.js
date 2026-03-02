import { API_URL } from './client.js';

export const checkUsernameDuplication = async (name) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${API_URL}/api/check-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
      signal: controller.signal
    });
    const data = await response.json();
    return data.duplicate;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};
