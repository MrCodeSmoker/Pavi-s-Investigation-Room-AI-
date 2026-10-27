
import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';

const suspectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    motive: { type: String, required: true },
    alibi: { type: String, required: true }
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ['document', 'image', 'audio', 'video', 'physical'],
      required: true
    },
    relatedSuspectIds: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const evidenceReferenceSchema = new mongoose.Schema(
  {
    evidenceId: { type: String, required: true },
    supports: { type: String, required: true }
  },
  { _id: false }
);

const solutionSchema = new mongoose.Schema(
  {
    culpritId: { type: String, required: true },
    explanation: { type: String, required: true },
    evidenceReferences: {
      type: [evidenceReferenceSchema],
      default: []
    }
  },
  { _id: false }
);

const caseSchema = new mongoose.Schema(
  {
    scenario: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 500
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      required: true
    },
    title: {
      type: String,
      default: ''
    },
    summary: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['generating', 'ready', 'failed', 'expired'],
      default: 'generating',
      required: true
    },
    generationStage: {
      type: String,
      default: 'queued'
    },
    suspects: {
      type: [suspectSchema],
      default: []
    },
    evidence: {
      type: [evidenceSchema],
      default: []
    },
    solution: {
      type: solutionSchema,
      default: undefined,
      select: false
    },
    accessTokenHash: {
      type: String,
      required: true,
      select: false
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      expires: 0
    }
  },
  {
    timestamps: true,
    minimize: false
  }
);

caseSchema.statics.createAccessToken = function () {
  return randomBytes(32).toString('hex');
};

caseSchema.statics.hashAccessToken = function (token) {
  return createHash('sha256').update(token).digest('hex');
};

const Case =
  mongoose.models.Case || mongoose.model('Case', caseSchema);

export default Case;
