
import request from 'supertest';
import { createHash } from 'node:crypto';
import { createApp } from '../src/app.js';

const testToken = 'a'.repeat(64);

const hashToken = (token) =>
  createHash('sha256').update(token).digest('hex');

class FakeCaseModel {
  constructor(data) {
    Object.assign(this, data);
    this._id = 'case-123';
    this.createdAt = new Date('2026-01-01T00:00:00.000Z');
    this.expiresAt = new Date('2099-01-02T00:00:00.000Z');
  }

  static createAccessToken() {
    return testToken;
  }

  static hashAccessToken(token) {
    return hashToken(token);
  }

  async save() {
    return this;
  }
}

const makeStoredCase = () => ({
  _id: 'case-123',
  scenario: 'A priceless manuscript disappears from a locked library.',
  difficulty: 'easy',
  title: 'The Midnight Manuscript',
  summary: 'A rare manuscript has vanished from a locked library.',
  status: 'ready',
  generationStage: 'completed',
  suspects: [
    {
      id: 's1',
      name: 'Eleanor Blake',
      description: 'The head librarian.',
      motive: 'She wants to hide a disputed record.',
      alibi: 'She claims she was cataloguing books.'
    }
  ],
  evidence: [
    {
      id: 'e1',
      title: 'Entry log',
      description: 'A late entry appears in the log.',
      type: 'document',
      relatedSuspectIds: ['s1']
    }
  ],
  solution: {
    culpritId: 's1',
    explanation: 'The entry log contradicts the suspect alibi.'
  },
  accessTokenHash: hashToken(testToken),
  expiresAt: new Date('2099-01-02T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z')
});

class StatusCaseModel extends FakeCaseModel {
  static findById() {
    return {
      select() {
        return Promise.resolve(makeStoredCase());
      }
    };
  }
}

describe('case creation', () => {
  it('rejects a scenario shorter than ten characters', async () => {
    const response = await request(createApp())
      .post('/api/v1/cases')
      .send({ scenario: 'Too short', difficulty: 'easy' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a case without exposing its private solution', async () => {
    const response = await request(createApp({ CaseModel: FakeCaseModel }))
      .post('/api/v1/cases')
      .send({
        scenario: 'A priceless manuscript disappears from a locked library.',
        difficulty: 'easy'
      });

    expect(response.status).toBe(201);
    expect(response.body.case.id).toBe('case-123');
    expect(response.body.case.status).toBe('generating');
    expect(response.body.case.solution).toBeUndefined();
    expect(response.body.accessToken).toBe(testToken);
  });
});

describe('protected case status', () => {
  it('rejects a request without an access token', async () => {
    const response = await request(
      createApp({ CaseModel: StatusCaseModel })
    ).get('/api/v1/cases/case-123');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a malformed access token', async () => {
    const response = await request(
      createApp({ CaseModel: StatusCaseModel })
    )
      .get('/api/v1/cases/case-123')
      .set('Authorization', 'Bearer invalid');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns public case details without the private solution', async () => {
    const response = await request(
      createApp({ CaseModel: StatusCaseModel })
    )
      .get('/api/v1/cases/case-123')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body.case.id).toBe('case-123');
    expect(response.body.case.status).toBe('ready');
    expect(response.body.case.suspects).toHaveLength(1);
    expect(response.body.case.evidence).toHaveLength(1);
    expect(response.body.case.solution).toBeUndefined();
    expect(response.body.case.accessTokenHash).toBeUndefined();
  });
});
