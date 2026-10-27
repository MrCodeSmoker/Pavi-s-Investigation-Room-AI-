import { useEffect, useState } from 'react';

import { createCase, getCase } from './services/caseApi.js';

import ReactDOM from 'react-dom/client';

import './styles/index.css';

 

const demoCase = {

  id: 'MR-001',

  title: 'The Midnight Manuscript',

  location: 'Blackwood Manor',

  difficulty: 'Medium',

  story:

    'A rare manuscript vanished from a locked study at midnight. Three people were inside the manor, and each tells a different story.',

  suspects: [

    {

      name: 'Eleanor Blake',

      role: 'The Archivist',

      description: 'Had access to the manuscript catalogue and the study keys.',

      alibi: 'Claims she was organizing books in the west library.',

      detail: 'A fresh ink stain was found on her right glove.',

    },

    {

      name: 'Victor Hale',

      role: 'The Heir',

      description: 'Would inherit the collection if the manor were sold.',

      alibi: 'Says he was speaking on the telephone downstairs.',

      detail: 'The telephone log shows no outgoing call at midnight.',

    },

    {

      name: 'Mara Quinn',

      role: 'The Housekeeper',

      description: 'Was responsible for locking the manor for the night.',

      alibi: 'Claims she heard the study clock strike twelve.',

      detail: 'The study clock stopped at 11:40 PM.',

    },

  ],

  evidence: [

    {

      title: 'The Locked Door',

      type: 'Document',

      description:

        'No damage appears around the lock. Whoever entered may have had legitimate access.',

    },

    {

      title: 'The Clock Photograph',

      type: 'Image',

      description:

        'The clock hands show 11:40 PM, contradicting the claim that it struck midnight.',

    },

    {

      title: 'The Telephone Log',

      type: 'Document',

      description:

        'The log contains no outgoing call during the time Victor claimed to be on the telephone.',

    },

    {

      title: 'The Torn Note',

      type: 'Document',

      description:

        'A note reads: “The catalogue must be corrected before morning.” Its author is unknown.',

    },

  ],

  solution:

    'The current clues make Victor’s alibi questionable, while Eleanor’s access and ink stain suggest another lead. The evidence is not yet sufficient to establish the culprit conclusively. In the finished game, the generated case will contain a verified solution supported by its clues.',

};

 

 

// Convert API values to display-safe strings. React cannot render plain objects.

const displayText = (value, fallback = '') => {

  if (typeof value === 'string' || typeof value === 'number') {

    return String(value);

  }

  if (value && typeof value === 'object') {

    // The generator may return summary as { title, summary }.

    if (typeof value.summary === 'string') return value.summary;

    if (typeof value.description === 'string') return value.description;

    if (typeof value.title === 'string') return value.title;

  }

  return fallback;

};

 

const toUiCase = (record = {}) => {

  const summaryText = displayText(record.summary, '');

  const nestedTitle =

    record.summary && typeof record.summary === 'object'

      ? displayText(record.summary.title, '')

      : '';

  const suspects = Array.isArray(record.suspects) ? record.suspects : [];

  const evidence = Array.isArray(record.evidence) ? record.evidence : [];

 

  return {

    id: displayText(record.id, 'New case'),

    title: displayText(record.title, nestedTitle || 'Preparing your mystery…'),

    location: 'Generated investigation',

    difficulty:

      typeof record.difficulty === 'string'

        ? record.difficulty.charAt(0).toUpperCase() + record.difficulty.slice(1)

        : 'Medium',

    story: summaryText || displayText(record.scenario, 'Your investigation is being prepared.'),

    suspects: suspects.map((suspect, index) => ({

      id: displayText(suspect?.id, `suspect-${index + 1}`),

      name: displayText(suspect?.name, `Suspect ${index + 1}`),

      role: displayText(suspect?.role, 'Person of interest'),

      description: displayText(suspect?.description, 'No description provided.'),

      alibi: displayText(suspect?.alibi, 'No alibi has been recorded.'),

      detail: displayText(suspect?.motive || suspect?.detail, 'Motive under investigation.'),

    })),

    evidence: evidence.map((item, index) => ({

      id: displayText(item?.id, `evidence-${index + 1}`),

      title: displayText(item?.title, `Evidence ${index + 1}`),

      type: (() => {

        const type = displayText(item?.type, 'Evidence');

        return type.charAt(0).toUpperCase() + type.slice(1);

      })(),

      description: displayText(item?.description, 'No description provided.'),

    })),

    solution: null,

    isLive: true,

    status: displayText(record.status, 'generating'),

    generationStage: displayText(record.generationStage, 'queued'),

  };

};

 

const NOTES_STORAGE_PREFIX = 'ai-mystery-room:notes:';

 

function readCaseNotes(caseId) {

  if (!caseId || typeof window === 'undefined') return '';

 

  try {

    return window.localStorage.getItem(`${NOTES_STORAGE_PREFIX}${caseId}`) || '';

  } catch (error) {

    console.warn('Unable to read investigation notes from browser storage.', error);

    return '';

  }

}

 

function saveCaseNotes(caseId, value) {

  if (!caseId || typeof window === 'undefined') return false;

 

  try {

    window.localStorage.setItem(`${NOTES_STORAGE_PREFIX}${caseId}`, value);

    return true;

  } catch (error) {

    console.warn('Unable to save investigation notes to browser storage.', error);

    return false;

  }

}

 

export function App() {

  const [page, setPage] = useState('home');

  const [scenario, setScenario] = useState('');

  const [difficulty, setDifficulty] = useState('Medium');

  const [genre, setGenre] = useState('Classic detective');

  const [caseData, setCaseData] = useState(null);

  const [caseAccessToken, setCaseAccessToken] = useState('');

  const [generationStatus, setGenerationStatus] = useState('idle');

  const [generationMessage, setGenerationMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [theoryMessage, setTheoryMessage] = useState('');

  const [activeTab, setActiveTab] = useState('Evidence');

  const [selectedEvidence, setSelectedEvidence] = useState(0);

  const [selectedSuspect, setSelectedSuspect] = useState(0);

  const [notes, setNotes] = useState('');

  const [theory, setTheory] = useState('');

  const [revealed, setRevealed] = useState(false);

  const [notice, setNotice] = useState('');

 

  function goTo(nextPage) {

    setNotice('');

    setPage(nextPage);

    window.scrollTo({ top: 0, behavior: 'smooth' });

  }

 

  function startDemo() {

    setCaseData(demoCase);

    setCaseAccessToken('');

    setGenerationStatus('ready');

    setGenerationMessage('');

    setTheoryMessage('');

    setScenario(demoCase.story);

    setDifficulty(demoCase.difficulty);

    setSelectedEvidence(0);

    setSelectedSuspect(0);

    setActiveTab('Evidence');

    setNotes(readCaseNotes(demoCase.id));

    setTheory('');

    setRevealed(false);

    goTo('investigate');

  }

 

  async function createDemoCase(event) {

    event.preventDefault();

    setNotice('');

    setGenerationMessage('');

 

    if (scenario.trim().length < 10 || scenario.trim().length > 500) {

      setNotice('Please enter a scenario between 10 and 500 characters.');

      return;

    }

 

    setIsSubmitting(true);

 

    try {

      const result = await createCase({

        scenario: scenario.trim(),

        difficulty: difficulty.toLowerCase(),

      });

 

      const liveCase = toUiCase(result.case);

 

      setCaseData(liveCase);

      setCaseAccessToken(result.accessToken);

      setGenerationStatus(result.case.status || 'generating');

      setSelectedEvidence(0);

      setSelectedSuspect(0);

      setActiveTab('Evidence');

      setNotes(readCaseNotes(liveCase.id));

      setTheory('');

      setTheoryMessage('');

      setRevealed(false);

      setPage('investigate');

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {

      setNotice(

        error instanceof Error

          ? error.message

          : 'Unable to create your mystery. Please try again.'

      );

    } finally {

      setIsSubmitting(false);

    }

  }

 

  const liveCaseId = caseData?.isLive ? caseData.id : null;

 

  useEffect(() => {

    if (

      !liveCaseId ||

      !caseAccessToken ||

      !['queued', 'generating'].includes(generationStatus)

    ) {

      return undefined;

    }

 

    let cancelled = false;

    let requestInProgress = false;

 

    const refreshCase = async () => {

      if (requestInProgress || cancelled) return;

      requestInProgress = true;

 

      try {

        const result = await getCase(liveCaseId, caseAccessToken);

        if (cancelled) return;

 

        const updatedCase = toUiCase(result.case);

        setCaseData((current) =>

          current?.id === liveCaseId ? updatedCase : current

        );

        setGenerationStatus(result.case.status || 'generating');

 

        if (result.case.status === 'failed') {

          setGenerationMessage(

            'Mystery generation failed. Please create a new case and try again.'

          );

        } else if (result.case.status === 'ready') {

          setGenerationMessage('');

        }

      } catch (error) {

        if (!cancelled) {

          setGenerationMessage(

            error instanceof Error

              ? error.message

              : 'Unable to refresh the case status.'

          );

        }

      } finally {

        requestInProgress = false;

      }

    };

 

    void refreshCase();

    const intervalId = window.setInterval(() => {

      void refreshCase();

    }, 2500);

 

    return () => {

      cancelled = true;

      window.clearInterval(intervalId);

    };

  }, [liveCaseId, caseAccessToken, generationStatus]);

 

  function submitTheory() {

    if (!theory.trim()) {

      setTheoryMessage('Please write your theory before submitting.');

      return;

    }

 

    if (currentCase.isLive) {

      setTheoryMessage(

        'Your theory has been recorded for this page session. ' +

          'Automated accusation checking and solution reveal are not ' +

          'available for generated cases yet.'

      );

      return;

    }

 

    setTheoryMessage('');

    setRevealed(true);

  }

 

  const currentCase = caseData || demoCase;

 

  return (

    <div className="min-h-screen bg-[#080b14] text-slate-100">

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080b14]/95 backdrop-blur-xl">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">

          <button

            onClick={() => goTo('home')}

            className="flex items-center gap-3 text-left"

          >

            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-xl text-violet-300">

              ◈

            </span>

            <span>

              <span className="block text-base font-bold tracking-wide">

                MYSTERY ROOM

              </span>

              <span className="block text-xs text-slate-500">

                Every clue tells a story

              </span>

            </span>

          </button>

 

          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">

            <button onClick={() => goTo('home')} className="hover:text-white">

              Home

            </button>

            <button onClick={() => goTo('create')} className="hover:text-white">

              Create mystery

            </button>

            <button onClick={() => goTo('cases')} className="hover:text-white">

              Case files

            </button>

          </nav>

 

          <button

            onClick={() => goTo('create')}

            className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400"

          >

            Start investigating ↗

          </button>

        </div>

      </header>

 

      <main>

        {page === 'home' && (

          <>

            <section className="relative overflow-hidden border-b border-white/5">

              <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />

 

              <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 md:py-28 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8">

                <div>

                  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-xs font-medium tracking-wide text-violet-300">

                    <span className="h-2 w-2 rounded-full bg-violet-400" />

                    AN AI-POWERED INVESTIGATION GAME

                  </div>

 

                  <h1 className="max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">

                    Every mystery

                    <br />

                    leaves a <span className="text-violet-400">trace.</span>

                  </h1>

 

                  <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">

                    Enter a story. Explore the evidence. Question every alibi.

                    Discover the truth hidden between the clues.

                  </p>

 

                  <div className="mt-9 flex flex-wrap gap-3">

                    <button

                      onClick={() => goTo('create')}

                      className="rounded-xl bg-violet-500 px-6 py-3.5 font-semibold hover:bg-violet-400"

                    >

                      Create your mystery <span className="ml-2">→</span>

                    </button>

                    <button

                      onClick={() => goTo('cases')}

                      className="rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-slate-300 hover:bg-white/5"

                    >

                      Explore case files

                    </button>

                  </div>

 

                  <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-6 text-sm text-slate-500">

                    <span>◈ Interactive evidence</span>

                    <span>◎ Multiple suspects</span>

                    <span>⌕ Logical deduction</span>

                  </div>

                </div>

 

                <div className="relative">

                  <div className="absolute -inset-5 rounded-[32px] bg-violet-500/10 blur-3xl" />

                  <div className="relative rounded-3xl border border-white/10 bg-[#111625] p-5 shadow-2xl sm:p-7">

                    <div className="flex items-center justify-between border-b border-white/10 pb-5">

                      <div>

                        <p className="text-xs uppercase tracking-[.2em] text-violet-300">

                          Featured case

                        </p>

                        <h2 className="mt-2 text-xl font-bold">

                          The Midnight Manuscript

                        </h2>

                      </div>

                      <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200">

                        Unsolved

                      </span>

                    </div>

 

                    <div className="my-6 grid grid-cols-3 gap-3">

                      {[

                        ['03', 'Suspects'],

                        ['04', 'Clues'],

                        ['01', 'Secret'],

                      ].map(([number, label]) => (

                        <div

                          key={label}

                          className="rounded-xl border border-white/5 bg-white/[.03] p-4"

                        >

                          <p className="text-2xl font-bold">{number}</p>

                          <p className="mt-1 text-xs text-slate-500">{label}</p>

                        </div>

                      ))}

                    </div>

 

                    <div className="space-y-3">

                      {[

                        ['▤', 'The locked study', 'No signs of forced entry'],

                        ['◷', 'The stopped clock', '11:40 PM'],

                        ['✉', 'The torn note', 'The catalogue must be corrected'],

                      ].map(([icon, title, description]) => (

                        <div

                          key={title}

                          className="flex items-center gap-4 rounded-xl border border-white/5 bg-black/20 p-4"

                        >

                          <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-400/10 text-xl text-violet-300">

                            {icon}

                          </span>

                          <div className="min-w-0 flex-1">

                            <p className="font-medium">{title}</p>

                            <p className="mt-1 text-sm text-slate-500">

                              {description}

                            </p>

                          </div>

                          <span className="text-slate-600">↗</span>

                        </div>

                      ))}

                    </div>

 

                    <button

                      onClick={startDemo}

                      className="mt-5 w-full rounded-xl border border-violet-400/30 bg-violet-500/10 py-3.5 font-semibold text-violet-200 transition hover:bg-violet-500/20"

                    >

                      Open featured investigation →

                    </button>

                    <p className="mt-3 text-center text-xs text-slate-600">

                      Interactive demonstration · Sample case

                    </p>

                  </div>

                </div>

              </div>

            </section>

 

            <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">

              <div className="max-w-2xl">

                <p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">

                  Your investigation

                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">

                  Think like a detective.

                </h2>

                <p className="mt-4 leading-7 text-slate-400">

                  Every detail matters. Follow the evidence instead of trusting

                  the first story you hear.

                </p>

              </div>

 

              <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                {[

                  ['01', 'Build a mystery', 'Start with a scenario or an idea.'],

                  ['02', 'Meet the suspects', 'Compare motives, statements and alibis.'],

                  ['03', 'Inspect the evidence', 'Review documents, images and clues.'],

                  ['04', 'Make your deduction', 'Submit your theory and review the answer.'],

                ].map(([number, title, description]) => (

                  <article

                    key={number}

                    className="rounded-2xl border border-white/10 bg-white/[.025] p-6"

                  >

                    <p className="text-sm text-violet-300">{number}</p>

                    <h3 className="mt-5 text-lg font-semibold">{title}</h3>

                    <p className="mt-3 text-sm leading-6 text-slate-500">

                      {description}

                    </p>

                  </article>

                ))}

              </div>

            </section>

          </>

        )}

 

        {page === 'create' && (

          <section className="mx-auto max-w-4xl px-5 py-14 sm:py-20">

            <button

              onClick={() => goTo('home')}

              className="mb-8 text-sm text-slate-500 hover:text-white"

            >

              ← Back to home

            </button>

 

            <p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">

              Case creation

            </p>

            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">

              Create your mystery.

            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-slate-400">

              Describe the incident you want to investigate. Choose your

              preferred style and difficulty to prepare the case.

            </p>

 

            <form

              onSubmit={createDemoCase}

              className="mt-10 space-y-8 rounded-3xl border border-white/10 bg-[#101522] p-6 sm:p-9"

            >

              <div>

                <label

                  htmlFor="scenario"

                  className="mb-3 block font-semibold"

                >

                  Your story or scenario

                </label>

                <textarea

                  id="scenario"

                  value={scenario}

                  onChange={(event) => setScenario(event.target.value)}

                  minLength={10}

                  maxLength={500}

                  required

                  rows={6}

                  placeholder="Example: A priceless painting disappears from a locked museum room. Three visitors were nearby, and each gives a different explanation..."

                  className="w-full resize-y rounded-xl border border-white/10 bg-[#090d17] p-4 leading-7 text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400"

                />

                <div className="mt-2 flex justify-between text-xs text-slate-500">

                  <span>Describe the incident, people and setting.</span>

                  <span>{scenario.length}/500</span>

                </div>

              </div>

 

              <div>

                <p className="mb-3 font-semibold">Mystery genre</p>

                <div className="grid gap-3 sm:grid-cols-3">

                  {[

                    ['Classic detective', '🔎', 'Clues and alibis'],

                    ['Psychological', '🧠', 'Secrets and motives'],

                    ['Supernatural', '🌒', 'Unexplained events'],

                  ].map(([value, icon, description]) => (

                    <button

                      key={value}

                      type="button"

                      onClick={() => setGenre(value)}

                      className={`rounded-xl border p-4 text-left transition ${

                        genre === value

                          ? 'border-violet-400 bg-violet-400/10'

                          : 'border-white/10 bg-black/10 hover:border-white/25'

                      }`}

                    >

                      <span className="text-xl">{icon}</span>

                      <span className="mt-3 block font-medium">{value}</span>

                      <span className="mt-1 block text-xs text-slate-500">

                        {description}

                      </span>

                    </button>

                  ))}

                </div>

              </div>

 

              <div>

                <p className="mb-3 font-semibold">Difficulty</p>

                <div className="grid grid-cols-3 gap-3">

                  {['Easy', 'Medium', 'Hard'].map((value) => (

                    <button

                      key={value}

                      type="button"

                      onClick={() => setDifficulty(value)}

                      className={`rounded-xl border px-3 py-3 font-medium transition ${

                        difficulty === value

                          ? 'border-violet-400 bg-violet-400/10 text-violet-200'

                          : 'border-white/10 text-slate-400 hover:border-white/25'

                      }`}

                    >

                      {value}

                    </button>

                  ))}

                </div>

              </div>

 

              {notice && (

                <p

                  role="status"

                  className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-200"

                >

                  {notice}

                </p>

              )}

 

              <button

                type="submit"

                disabled={isSubmitting}

                className="w-full rounded-xl bg-violet-500 px-6 py-4 font-semibold transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"

              >

                {isSubmitting ? 'Creating your case…' : 'Prepare investigation →'}

              </button>

 

              <p className="text-center text-xs leading-5 text-slate-600">

                Your scenario will be sent to the AI Mystery Room backend. Generation may take a short while.

              </p>

            </form>

          </section>

        )}

 

        {page === 'cases' && (

          <section className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">

            <p className="text-xs font-semibold uppercase tracking-[.2em] text-violet-300">

              Investigation archive

            </p>

            <h1 className="mt-3 text-4xl font-bold">Case files</h1>

            <p className="mt-4 max-w-2xl leading-7 text-slate-400">

              Choose a case to explore its evidence, investigate the suspects,

              and build a theory.

            </p>

 

            <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">

              <article className="rounded-2xl border border-white/10 bg-[#101522] p-6">

                <div className="flex items-center justify-between">

                  <span className="text-xs text-violet-300">MR-001</span>

                  <span className="rounded-lg bg-amber-400/10 px-3 py-1 text-xs text-amber-200">

                    Sample case

                  </span>

                </div>

                <h2 className="mt-5 text-xl font-bold">

                  The Midnight Manuscript

                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-400">

                  A rare manuscript vanishes from a locked study. Three

                  witnesses. Conflicting stories. One mystery.

                </p>

                <div className="mt-5 flex gap-4 text-xs text-slate-500">

                  <span>3 suspects</span>

                  <span>4 clues</span>

                  <span>Medium</span>

                </div>

                <button

                  onClick={startDemo}

                  className="mt-6 w-full rounded-xl border border-violet-400/30 py-3 font-semibold text-violet-200 hover:bg-violet-500/10"

                >

                  Investigate case →

                </button>

              </article>

 

              <article className="flex min-h-64 flex-col justify-center rounded-2xl border border-dashed border-white/15 p-6 text-center">

                <span className="text-3xl text-slate-600">＋</span>

                <h2 className="mt-4 font-semibold">Your next mystery</h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">

                  Create your own scenario and prepare another investigation.

                </p>

                <button

                  onClick={() => goTo('create')}

                  className="mt-5 text-sm font-semibold text-violet-300 hover:text-violet-200"

                >

                  Create a case →

                </button>

              </article>

            </div>

          </section>

        )}

 

        {page === 'investigate' && (

          <section className="mx-auto max-w-7xl px-5 py-8 sm:py-12 lg:px-8">

            <button

              onClick={() => goTo('cases')}

              className="mb-6 text-sm text-slate-500 hover:text-white"

            >

              ← Back to case files

            </button>

 

            <div className="flex flex-wrap items-start justify-between gap-5">

              <div>

                <p className="text-xs uppercase tracking-[.2em] text-violet-300">

                  Case {currentCase.id}

                </p>

                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">

                  {currentCase.title}

                </h1>

                <p className="mt-3 text-slate-400">{currentCase.location}</p>

              </div>

              <span className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-200">

                Investigation in progress

              </span>

            </div>

 

            <div className="mt-8 rounded-2xl border border-white/10 bg-[#101522] p-5 sm:p-7">

              <p className="text-xs uppercase tracking-widest text-slate-500">

                Incident report

              </p>

              <p className="mt-4 leading-8 text-slate-300">

                {currentCase.story}

              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">

                <span className="rounded-lg bg-white/5 px-3 py-2">

                  {currentCase.difficulty} difficulty

                </span>

                <span className="rounded-lg bg-white/5 px-3 py-2">

                  {currentCase.suspects.length} suspects

                </span>

                <span className="rounded-lg bg-white/5 px-3 py-2">

                  {currentCase.evidence.length} evidence items

                </span>

              </div>

            </div>

 

            {currentCase.isLive && generationStatus !== 'ready' && (

              <div

                className={`mt-8 rounded-2xl border p-5 ${

                  generationStatus === 'failed'

                    ? 'border-red-400/25 bg-red-400/[.06]'

                    : 'border-violet-400/25 bg-violet-500/[.06]'

                }`}

                role="status"

                aria-live="polite"

              >

                <p className="font-semibold">

                  {generationStatus === 'failed'

                    ? 'Mystery generation failed'

                    : 'Preparing your mystery…'}

                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">

                  {generationStatus === 'failed'

                    ? generationMessage || 'Please create a new mystery and try again.'

                    : 'Gemini is building the suspects and evidence. This page will update automatically when the case is ready.'}

                </p>

                {generationMessage && generationStatus !== 'failed' && (

                  <p className="mt-2 text-sm text-amber-200">{generationMessage}</p>

                )}

              </div>

            )}

 

            {(!currentCase.isLive || generationStatus === 'ready') && (

            <div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.4fr]">

              <section className="rounded-2xl border border-white/10 bg-[#101522] p-5 sm:p-6">

                <h2 className="text-lg font-bold">Persons of interest</h2>

                <p className="mt-2 text-sm text-slate-500">

                  Select a person to inspect their statement.

                </p>

                <div className="mt-5 space-y-3">

                  {currentCase.suspects.map((suspect, index) => (

                    <button

                      key={suspect.name}

                      onClick={() => {

                        setSelectedSuspect(index);

                        setActiveTab('Suspects');

                      }}

                      className={`w-full rounded-xl border p-4 text-left transition ${

                        selectedSuspect === index && activeTab === 'Suspects'

                          ? 'border-violet-400/60 bg-violet-400/10'

                          : 'border-white/10 hover:bg-white/[.03]'

                      }`}

                    >

                      <span className="flex items-center gap-3">

                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800 font-semibold text-violet-200">

                          {suspect.name.charAt(0)}

                        </span>

                        <span>

                          <span className="block font-medium">

                            {suspect.name}

                          </span>

                          <span className="mt-1 block text-xs text-slate-500">

                            {suspect.role}

                          </span>

                        </span>

                      </span>

                    </button>

                  ))}

                </div>

              </section>

 

              <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101522] p-5 sm:p-6">

                <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">

                  {['Evidence', 'Suspects', 'Notebook'].map((tab) => (

                    <button

                      key={tab}

                      onClick={() => setActiveTab(tab)}

                      className={`rounded-lg px-4 py-2 text-sm font-medium ${

                        activeTab === tab

                          ? 'bg-violet-500 text-white'

                          : 'text-slate-400 hover:bg-white/5'

                      }`}

                    >

                      {tab}

                    </button>

                  ))}

                </div>

 

                {activeTab === 'Evidence' && (

                  <div className="pt-5">

                    <div className="grid gap-3 sm:grid-cols-2">

                      {currentCase.evidence.map((item, index) => (

                        <button

                          key={item.title}

                          onClick={() => setSelectedEvidence(index)}

                          className={`rounded-xl border p-4 text-left ${

                            selectedEvidence === index

                              ? 'border-violet-400/60 bg-violet-400/[.07]'

                              : 'border-white/10 hover:bg-white/[.025]'

                          }`}

                        >

                          <span className="text-xs text-violet-300">

                            {item.type}

                          </span>

                          <span className="mt-2 block font-medium">

                            {item.title}

                          </span>

                          <span className="mt-2 block text-xs text-slate-500">

                            Select to examine →

                          </span>

                        </button>

                      ))}

                    </div>

 

                    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-5">

                      <p className="text-xs uppercase tracking-widest text-slate-500">

                        Evidence examination

                      </p>

                      <h3 className="mt-3 text-lg font-semibold">

                        {currentCase.evidence[selectedEvidence]?.title}

                      </h3>

                      <p className="mt-3 leading-7 text-slate-400">

                        {currentCase.evidence[selectedEvidence]?.description}

                      </p>

                      <p className="mt-4 text-xs text-slate-600">

                        {currentCase.evidence[selectedEvidence]?.type} · Sample

                        evidence description

                      </p>

                    </div>

                  </div>

                )}

 

                {activeTab === 'Suspects' && (

                  <div className="pt-6">

                    <p className="text-xs uppercase tracking-widest text-violet-300">

                      Suspect profile

                    </p>

                    <h3 className="mt-3 text-2xl font-bold">

                      {currentCase.suspects[selectedSuspect]?.name}

                    </h3>

                    <p className="mt-1 text-sm text-slate-500">

                      {currentCase.suspects[selectedSuspect]?.role}

                    </p>

                    <p className="mt-5 leading-7 text-slate-300">

                      {currentCase.suspects[selectedSuspect]?.description}

                    </p>

                    <div className="mt-5 rounded-xl border border-white/10 p-4">

                      <p className="text-sm font-semibold">Reported alibi</p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">

                        {currentCase.suspects[selectedSuspect]?.alibi}

                      </p>

                    </div>

                    <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[.04] p-4">

                      <p className="text-sm font-semibold text-amber-200">

                        Observation

                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-400">

                        {currentCase.suspects[selectedSuspect]?.detail}

                      </p>

                    </div>

                  </div>

                )}

 

                {activeTab === 'Notebook' && (

                  <div className="pt-6">

                    <h3 className="text-xl font-bold">Investigation notes</h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">

                      Record contradictions, connections and questions to

                      investigate.

                    </p>

                    <textarea

                      value={notes}

                      onChange={(event) => {

                        const nextNotes = event.target.value;

                        setNotes(nextNotes);

                        saveCaseNotes(currentCase.id, nextNotes);

                      }}

                      rows={9}

                      placeholder="What seems suspicious? Which details contradict each other?"

                      className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 p-4 leading-7 outline-none placeholder:text-slate-600 focus:border-violet-400"

                    />

                    <p className="mt-2 text-xs text-slate-600">

                      Notes are saved automatically in this browser for this case. They remain on this device unless browser storage is cleared.

                    </p>

                  </div>

                )}

              </section>

            </div>

            )}

 

            <section className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/[.05] p-5 sm:p-7">

              <p className="text-xs uppercase tracking-widest text-violet-300">

                Your deduction

              </p>

              <h2 className="mt-3 text-2xl font-bold">What do you believe happened?</h2>

              <p className="mt-3 max-w-2xl leading-7 text-slate-400">

                Write your theory using the clues and statements you have

                examined. In the completed product, this will be evaluated

                against the case's verified solution.

              </p>

              <textarea

                value={theory}

                onChange={(event) => {

                  setTheory(event.target.value);

                  setTheoryMessage('');

                }}

                rows={4}

                placeholder="I believe... because the evidence shows..."

                className="mt-5 w-full rounded-xl border border-white/10 bg-[#090d17] p-4 leading-7 outline-none placeholder:text-slate-600 focus:border-violet-400"

              />

 

              {(!revealed || currentCase.isLive) && (

                <button

                  type="button"

                  onClick={submitTheory}

                  disabled={

                    !theory.trim() ||

                    (currentCase.isLive && generationStatus !== 'ready')

                  }

                  className="mt-4 rounded-xl bg-violet-500 px-6 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"

                >

                  {currentCase.isLive

                    ? 'Submit theory →'

                    : 'Submit theory & reveal demo answer →'}

                </button>

              )}

 

              {theoryMessage && (

                <p

                  role="status"

                  aria-live="polite"

                  className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-200"

                >

                  {theoryMessage}

                </p>

              )}

 

              {revealed && !currentCase.isLive && (

                <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-5">

                  <p className="font-semibold text-emerald-200">

                    Demo answer revealed

                  </p>

                  <p className="mt-3 leading-7 text-slate-300">

                    {currentCase.solution}

                  </p>

                  <p className="mt-4 text-xs leading-5 text-slate-500">

                    This sample does not contain a validated culprit. The

                    connected AI version will generate a solution and ensure

                    the clues support it.

                  </p>

                </div>

              )}

            </section>

 

            <button

              onClick={() => goTo('create')}

              className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold hover:bg-white/5"

            >

              Create another mystery →

            </button>

          </section>

        )}

      </main>

 

      <footer className="border-t border-white/10">

        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">

          <p>◈ Mystery Room · Every clue tells a story.</p>

          <p>AI-powered case generation · Investigation workspace</p>

        </div>

      </footer>

    </div>

  );

}

 

ReactDOM.createRoot(document.getElementById('root')).render(<App />);