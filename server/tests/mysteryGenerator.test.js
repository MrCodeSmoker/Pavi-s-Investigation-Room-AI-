
import { describe, expect, it, jest } from '@jest/globals';
import { generateMystery } from '../src/services/mysteryGenerator.js';

const validMystery = {
  title: 'The Midnight Manuscript',
  summary: 'A rare manuscript vanished from a locked library.',
  suspects: [
    {
      id: 's1',
      name: 'Eleanor Blake',
      description: 'The head librarian.',
      motive: 'She wanted to hide a disputed ownership record.',
      alibi: 'She claims she was cataloguing books.'
    },
    {
      id: 's2',
      name: 'Victor Hale',
      description: 'A visiting collector.',
      motive: 'He wanted to acquire the manuscript.',
      alibi: 'He claims he left before closing.'
    },
    {
      id: 's3',
      name: 'Mara Quinn',
      description: 'A restoration specialist.',
      motive: 'She wanted to protect a damaged page.',
      alibi: 'She claims she was in the restoration room.'
    }
  ],
  evidence: [
    {
      id: 'e1',
      title: 'Entry log',
      description: 'The log records a late access-card entry.',
      type: 'document',
      relatedSuspectIds: ['s1']
    },
    {
      id: 'e2',
      title: 'Hallway photograph',
      description: 'A photograph shows a cart near the library.',
      type: 'image',
      relatedSuspectIds: ['s2']
    },
    {
      id: 'e3',
      title: 'Recorded conversation',
      description: 'A recording mentions the restoration room.',
      type: 'audio',
      relatedSuspectIds: ['s3']
    },
    {
      id: 'e4',
      title: 'Fibre sample',
      description: 'A fibre was found near the display case.',
      type: 'physical',
      relatedSuspectIds: ['s1']
    }
  ],
  solution: {
    culpritId: 's1',
    explanation:
      'The entry log and fibre evidence contradict Eleanor’s alibi.'
  }
};

describe('generateMystery', () => {
  it('validates and returns a consistent mystery', async () => {
    const generateText = jest
      .fn()
      .mockResolvedValue(JSON.stringify(validMystery));

    const result = await generateMystery({
      scenario: 'A priceless manuscript disappears from a locked library.',
      difficulty: 'easy',
      generateText
    });

    expect(result.title).toBe('The Midnight Manuscript');
    expect(result.solution.culpritId).toBe('s1');
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('rejects a culprit ID that does not match a suspect', async () => {
    const invalidMystery = {
      ...validMystery,
      solution: {
        ...validMystery.solution,
        culpritId: 'unknown-suspect'
      }
    };

    await expect(
      generateMystery({
        scenario: 'A priceless manuscript disappears from a locked library.',
        generateText: async () => JSON.stringify(invalidMystery)
      })
    ).rejects.toThrow('Generated culprit does not match a suspect.');
  });

  it('rejects malformed JSON', async () => {
    await expect(
      generateMystery({
        scenario: 'A priceless manuscript disappears from a locked library.',
        generateText: async () => 'not valid JSON'
      })
    ).rejects.toThrow('Gemini returned invalid JSON.');
  });
});
