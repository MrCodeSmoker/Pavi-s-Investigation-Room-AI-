
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getErrorText = (error) => {
  const parts = [
    error?.message,
    error?.status,
    error?.code,
    error?.error?.message,
    error?.error?.status,
    error?.details,
  ];

  try {
    parts.push(JSON.stringify(error));
  } catch {
    // Some SDK error objects cannot be serialized.
  }

  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) =>
      typeof part === 'string' ? part : JSON.stringify(part)
    )
    .join(' ')
    .toLowerCase();
};

const getErrorStatus = (error) => {
  const candidates = [
    error?.status,
    error?.code,
    error?.error?.code,
    error?.response?.status,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);

    if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 599) {
      return parsed;
    }
  }

  const message = getErrorText(error);
  const match = message.match(/\b(408|429|500|502|503|504)\b/);

  return match ? Number(match[1]) : null;
};

const isDailyQuotaExceeded = (error) => {
  const message = getErrorText(error);

  const dailyQuotaIndicators = [
    /requests per day/,
    /request per day/,
    /per day limit exceeded/,
    /daily quota/,
    /generaterequestsperday/,
    /requestsperdayperprojectpermodel/,
    /quota.*resets? at midnight/,
  ];

  return dailyQuotaIndicators.some((pattern) => pattern.test(message));
};

const createDailyQuotaError = (originalError) => {
  const error = new Error(
    'Gemini daily request quota has been exhausted. ' +
      'Wait until your quota resets or check your Gemini API plan and limits.'
  );

  error.code = 'GEMINI_DAILY_QUOTA_EXCEEDED';
  error.cause = originalError;

  return error;
};

const isRetryableError = (error) => {
  const status = getErrorStatus(error);

  if (isDailyQuotaExceeded(error)) {
    return false;
  }

  // Retry temporary rate limits and server-side failures.
  return (
    status === 429 ||
    status === 408 ||
    (status !== null && status >= 500 && status <= 599)
  );
};

export const generateGeminiText = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from server/.env.');
  }

  if (!model) {
    throw new Error('GEMINI_TEXT_MODEL is missing from server/.env.');
  }

  const client = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (!response.text) {
        throw new Error('Gemini returned an empty response.');
      }

      return response.text;
    } catch (originalError) {
      if (isDailyQuotaExceeded(originalError)) {
        const quotaError = createDailyQuotaError(originalError);

        console.error(`[Gemini] ${quotaError.message}`);
        throw quotaError;
      }

      const shouldRetry =
        isRetryableError(originalError) && attempt < MAX_RETRIES;

      if (!shouldRetry) {
        console.error(
          `[Gemini] Generation failed after ${attempt + 1} attempt(s).`,
          originalError?.message ?? originalError
        );

        throw originalError;
      }

      const delay =
        INITIAL_RETRY_DELAY_MS * 2 ** attempt +
        Math.floor(Math.random() * 250);

      console.warn(
        `[Gemini] Temporary API failure. Retrying in ${delay}ms ` +
          `(retry ${attempt + 1}/${MAX_RETRIES}).`
      );

      await sleep(delay);
    }
  }

  throw new Error('Gemini generation failed after all retry attempts.');
};
