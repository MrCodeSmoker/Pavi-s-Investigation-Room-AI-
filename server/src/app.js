import express from 'express';
import cors from 'cors';
import { timingSafeEqual } from 'node:crypto';

import Case from './models/Case.js';
import { generateMystery } from './services/mysteryGenerator.js';
import { generateGeminiText } from './services/geminiClient.js';

const MAX_SCENARIO_LENGTH = 500;
const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

export const createApp = ({
  CaseModel = Case,
  generateText = generateGeminiText,
} = {}) => {
  const app = express();

  const configuredOrigins = (process.env.CLIENT_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = [...new Set([...LOCAL_ORIGINS, ...configuredOrigins])];

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_request, response) =>
    response.status(200).json({ status: 'ok' })
  );

  const generateAndSaveCase = async (caseId) => {
    try {
      const mysteryCase = await CaseModel.findById(caseId);

      if (!mysteryCase || mysteryCase.status !== 'generating') return;

      const savedScenario =
        typeof mysteryCase.scenario === 'string'
          ? mysteryCase.scenario.trim()
          : '';

      console.log(
        `[Mystery ${caseId}] Saved scenario length: ${savedScenario.length}`
      );

      if (
        savedScenario.length < 10 ||
        savedScenario.length > MAX_SCENARIO_LENGTH
      ) {
        throw new Error(
          `Saved case scenario is invalid. Received ${savedScenario.length} characters.`
        );
      }

      mysteryCase.generationStage = 'generating';
      await mysteryCase.save();

      const mystery = await generateMystery({
        scenario: savedScenario,
        difficulty: mysteryCase.difficulty,
        generateText,
      });

      mysteryCase.title = mystery.title;
      mysteryCase.summary = mystery.summary;
      mysteryCase.suspects = mystery.suspects;
      mysteryCase.evidence = mystery.evidence;
      mysteryCase.solution = mystery.solution;
      mysteryCase.generationStage = 'completed';
      mysteryCase.status = 'ready';

      await mysteryCase.save();
      console.log(`[Mystery ${caseId}] Generation completed.`);
    } catch (error) {
      console.error(`[Mystery ${caseId}] Generation failed:`, error.message);

      try {
        await CaseModel.findByIdAndUpdate(caseId, {
          $set: { status: 'failed', generationStage: 'failed' },
        });
      } catch (saveError) {
        console.error(
          `[Mystery ${caseId}] Could not save failure status:`,
          saveError.message
        );
      }
    }
  };

  // Authenticate ownership of a case without exposing the stored token hash.
  const getAuthorizedCase = async (request) => {
    const authorization = request.get('authorization') ?? '';
    const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);

    if (!match) {
      return { errorStatus: 401, errorCode: 'UNAUTHORIZED', errorMessage: 'A valid case access token is required.' };
    }

    const mysteryCase = await CaseModel.findById(request.params.id)
      .select('+accessTokenHash +solution');

    if (!mysteryCase || !mysteryCase.accessTokenHash) {
      return { errorStatus: 404, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Case not found.' };
    }

    if (mysteryCase.expiresAt && mysteryCase.expiresAt.getTime() <= Date.now()) {
      return { errorStatus: 404, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Case not found.' };
    }

    const suppliedHash = CaseModel.hashAccessToken(match[1]);
    const suppliedBuffer = Buffer.from(suppliedHash, 'hex');
    const storedBuffer = Buffer.from(mysteryCase.accessTokenHash, 'hex');

    if (
      suppliedBuffer.length !== storedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, storedBuffer)
    ) {
      return { errorStatus: 404, errorCode: 'CASE_NOT_FOUND', errorMessage: 'Case not found.' };
    }

    return { mysteryCase };
  };

  const sendAuthError = (response, authResult) =>
    response.status(authResult.errorStatus).json({
      error: {
        code: authResult.errorCode,
        message: authResult.errorMessage,
      },
    });

  app.post('/api/v1/cases', async (request, response) => {
    const scenario =
      typeof request.body?.scenario === 'string'
        ? request.body.scenario.trim()
        : '';
    const difficulty = request.body?.difficulty ?? 'medium';

    if (scenario.length < 10 || scenario.length > MAX_SCENARIO_LENGTH) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Scenario must be between 10 and ${MAX_SCENARIO_LENGTH} characters. Received ${scenario.length}.`,
        },
      });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Difficulty must be easy, medium, or hard.',
        },
      });
    }

    try {
      const accessToken = CaseModel.createAccessToken();
      const accessTokenHash = CaseModel.hashAccessToken(accessToken);
      const mysteryCase = new CaseModel({
        scenario,
        difficulty,
        status: 'generating',
        generationStage: 'queued',
        accessTokenHash,
      });

      await mysteryCase.save();
      console.log(
        `[Mystery ${mysteryCase._id}] Case created with scenario length: ${scenario.length}`
      );

      void Promise.resolve().then(() =>
        generateAndSaveCase(mysteryCase._id.toString())
      );

      return response.status(201).json({
        case: {
          id: mysteryCase._id.toString(),
          scenario,
          difficulty,
          status: mysteryCase.status,
          generationStage: mysteryCase.generationStage,
          createdAt: mysteryCase.createdAt,
          expiresAt: mysteryCase.expiresAt,
        },
        accessToken,
      });
    } catch (error) {
      console.error('Case creation failed:', error.message);
      return response.status(500).json({
        error: {
          code: 'CASE_CREATION_FAILED',
          message: 'Unable to create the case right now.',
        },
      });
    }
  });

  app.get('/api/v1/cases/:id', async (request, response) => {
    try {
      const authResult = await getAuthorizedCase(request);
      if (authResult.errorStatus) return sendAuthError(response, authResult);
      const { mysteryCase } = authResult;

      return response.status(200).json({
        case: {
          id: mysteryCase._id.toString(),
          scenario: mysteryCase.scenario,
          difficulty: mysteryCase.difficulty,
          title: mysteryCase.title,
          summary: mysteryCase.summary,
          status: mysteryCase.status,
          generationStage: mysteryCase.generationStage,
          suspects: mysteryCase.suspects,
          evidence: mysteryCase.evidence,
          createdAt: mysteryCase.createdAt,
          expiresAt: mysteryCase.expiresAt,
        },
      });
    } catch (error) {
      console.error('Case status lookup failed:', error.message);
      return response.status(500).json({
        error: {
          code: 'CASE_LOOKUP_FAILED',
          message: 'Unable to retrieve the case right now.',
        },
      });
    }
  });

  // The private solution is returned only after an authenticated reveal request.
  app.post('/api/v1/cases/:id/reveal', async (request, response) => {
    const theory = typeof request.body?.theory === 'string' ? request.body.theory.trim() : '';
    if (!theory) {
      return response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Please submit your theory before revealing the solution.' },
      });
    }
    if (theory.length > 5000) {
      return response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Your theory cannot exceed 5000 characters.' },
      });
    }

    try {
      const authResult = await getAuthorizedCase(request);
      if (authResult.errorStatus) return sendAuthError(response, authResult);
      const { mysteryCase } = authResult;

      if (mysteryCase.status !== 'ready') {
        return response.status(409).json({
          error: { code: 'CASE_NOT_READY', message: 'This mystery is not ready to reveal its solution yet.' },
        });
      }

      if (!mysteryCase.solution?.culpritId || !mysteryCase.solution?.explanation) {
        return response.status(409).json({
          error: { code: 'SOLUTION_UNAVAILABLE', message: 'A verified solution is not available for this case.' },
        });
      }

      const culprit = mysteryCase.suspects.find(
        (suspect) => suspect.id === mysteryCase.solution.culpritId
      );

      if (!culprit) {
        return response.status(500).json({
          error: { code: 'INVALID_SOLUTION', message: 'The saved solution references an unknown suspect.' },
        });
      }

      return response.status(200).json({
        solution: {
          culpritId: mysteryCase.solution.culpritId,
          culpritName: culprit.name,
          explanation: mysteryCase.solution.explanation,
        },
        theoryReceived: true,
        theoryEvaluated: false,
      });
    } catch (error) {
      console.error('Solution reveal failed:', error.message);
      return response.status(500).json({
        error: { code: 'SOLUTION_REVEAL_FAILED', message: 'Unable to reveal the solution right now.' },
      });
    }
  });

  app.use((request, response) =>
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.path} was not found.`,
      },
    })
  );

  return app;
};
