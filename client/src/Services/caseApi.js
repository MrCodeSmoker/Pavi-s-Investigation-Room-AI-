const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const getErrorMessage = (data, fallback) =>
  data?.error?.message || fallback;

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      'Unable to connect to the server. Make sure the backend is running.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, `Request failed with status ${response.status}.`)
    );
  }

  return data;
}

export async function createCase({ scenario, difficulty = 'medium' }) {
  const cleanScenario = typeof scenario === 'string' ? scenario.trim() : '';

  if (cleanScenario.length < 10 || cleanScenario.length > 500) {
    throw new Error('Scenario must be between 10 and 500 characters.');
  }

  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    throw new Error('Please select a valid difficulty.');
  }

  return request('/api/v1/cases', {
    method: 'POST',
    body: JSON.stringify({ scenario: cleanScenario, difficulty }),
  });
}

export async function getCase(caseId, accessToken) {
  if (!caseId || typeof caseId !== 'string') {
    throw new Error('A valid case ID is required.');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('The case access token is missing.');
  }

  return request(`/api/v1/cases/${encodeURIComponent(caseId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function revealCase(caseId, accessToken, theory) {
  if (!caseId || typeof caseId !== 'string') {
    throw new Error('A valid case ID is required.');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('The case access token is missing.');
  }

  if (typeof theory !== 'string' || !theory.trim()) {
    throw new Error('Please write your deduction before revealing the solution.');
  }

  return request(`/api/v1/cases/${encodeURIComponent(caseId)}/reveal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ theory: theory.trim() }),
  });
}