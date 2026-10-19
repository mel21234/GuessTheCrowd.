'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GuessTiles, tileLabel } from './GuessTiles';
import { GuessInput } from './GuessInput';
import { ResultPanel } from './ResultPanel';
import { VoteCard } from './VoteCard';
import { Countdown } from './Countdown';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { BackIcon } from '../icons';
import { localeHref } from '../paths';
import { useI18n } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api';
import { getPlayerId, saveRecord, setDailyContext } from '@/lib/storage';
import { MAX_GUESSES } from '@/lib/scoring';
import type { GameState, PuzzleResponse, TodayResponse } from '@/lib/types';

type OkPuzzle = Extract<PuzzleResponse, { status: 'ok' }>;
type Load =
  | { kind: 'loading' }
  | { kind: 'error'; offline: boolean }
  | { kind: 'launch'; today: TodayResponse | null }
  | { kind: 'not_found' }
  | { kind: 'ok'; puzzle: OkPuzzle; today: TodayResponse | null };

function persist(p: OkPuzzle, game: GameState) {
  if (!game.finished) return;
  saveRecord({
    number: p.puzzle.number,
    mode: p.mode,
    prevDaily: p.mode === 'daily' ? p.prevDailyNumber : null,
    solvedIn: game.solvedIn ?? null,
    finalError: game.finalError ?? 0,
    guesses: game.guesses,
    playedAt: new Date().toISOString(),
  });
}

/** The daily game (no `number`) or an archive game (`number` given). */
export function GameScreen({ number }: { number?: number }) {
  const { t, fmt, locale } = useI18n();
  const toast = useToast();
  const archiveMode = number !== undefined;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [game, setGame] = useState<GameState | null>(null);
  const [value, setValue] = useState(50);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [justFinished, setJustFinished] = useState(false);
  const [animateFrom, setAnimateFrom] = useState(MAX_GUESSES);
  const [announce, setAnnounce] = useState('');
  const inFlight = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoad({ kind: 'loading' });
    const player = getPlayerId();
    try {
      const [puzzle, today] = await Promise.all([
        api.puzzle(locale, player, number),
        archiveMode ? Promise.resolve(null) : api.today(locale, player),
      ]);
      if (puzzle.status === 'launch') {
        setDailyContext({ dailyNumber: null, prevDailyNumber: null });
        setLoad({ kind: 'launch', today });
        return;
      }
      if (puzzle.status === 'not_found') {
        setLoad({ kind: 'not_found' });
        return;
      }
      setDailyContext({ dailyNumber: puzzle.dailyNumber, prevDailyNumber: puzzle.prevDailyNumber });
      persist(puzzle, puzzle.game);
      setGame(puzzle.game);
      setLoad({ kind: 'ok', puzzle, today });
    } catch (e) {
      setLoad({ kind: 'error', offline: e instanceof ApiError && e.offline });
    }
  }, [locale, number, archiveMode]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submit = async () => {
    if (load.kind !== 'ok' || !game || game.finished || inFlight.current) return;
    if (game.guesses.some((g) => g.value === value)) {
      setShakeKey((k) => k + 1);
      toast(t('game.repeated', { value }));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await api.guess(load.puzzle.puzzle.id, getPlayerId(), value, locale);
      if (r.status === 'rate_limited') {
        toast(t('game.rateLimited'));
        return;
      }
      if (r.status === 'repeated') {
        setShakeKey((k) => k + 1);
        toast(t('game.repeated', { value }));
        return;
      }
      if (!r.game) throw new Error('no game');
      setAnimateFrom(game.guesses.length);
      setGame(r.game);
      const last = r.game.guesses[r.game.guesses.length - 1];
      if (r.game.finished && r.game.result) {
        persist(load.puzzle, r.game);
        setJustFinished(true);
        const head = r.game.solvedIn ? t('result.solved', { count: r.game.solvedIn }) : t('result.notSolved');
        setAnnounce(`${tileLabel(t, r.game.guesses.length, last)} — ${head} ${t('result.saidYes', { pct: fmt.percent(r.game.result.answer) })}`);
      } else if (last) {
        setAnnounce(tileLabel(t, r.game.guesses.length, last));
      }
    } catch (e) {
      toast(e instanceof ApiError && e.offline ? t('common.offline') : t('game.error'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const column = 'mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4';
  const live = (
    <p className="sr-only" aria-live="assertive" aria-atomic="true">
      {announce}
    </p>
  );

  if (load.kind === 'loading') {
    return (
      <div className={`${column} items-center pt-8`} aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="h-4 w-32 animate-pulse rounded bg-surface" />
        <div className="mt-6 h-8 w-full animate-pulse rounded bg-surface" />
        <div className="mt-2 h-8 w-3/4 animate-pulse rounded bg-surface" />
        <div className="mt-8 grid w-full grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[60px] rounded-xl bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (load.kind === 'error') {
    return (
      <div className={`${column} items-center justify-center gap-4 py-12 text-center`}>
        <p className="text-lg font-semibold">{load.offline ? t('common.offline') : t('common.error')}</p>
        <button type="button" onClick={fetchAll} className="h-12 rounded-full bg-btn px-6 font-bold text-btn-fg">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (load.kind === 'not_found') {
    return (
      <div className={`${column} items-center justify-center gap-4 py-12 text-center`}>
        <p className="text-lg font-semibold">{t('archive.notFound')}</p>
        <a href={localeHref(locale, '/archive')} className="font-bold underline underline-offset-4">
          {t('archive.back')}
        </a>
      </div>
    );
  }

  if (load.kind === 'launch') {
    return (
      <div className={`${column} gap-6 py-8`}>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-tight balance">{t('launch.title')}</h1>
          <p className="mt-3 text-[17px] leading-relaxed balance">{t('launch.body')}</p>
          <p className="mt-2 text-muted balance">{t('launch.cta')}</p>
        </div>
        {load.today && <VoteCard today={load.today} />}
        <div className="text-center">
          <Countdown onZero={fetchAll} />
        </div>
      </div>
    );
  }

  const { puzzle } = load;
  const g = game ?? puzzle.game;
  const result = g.finished ? g.result : null;

  return (
    <div className={`${column} pb-8 pt-4 [@media(max-height:700px)]:pt-2`}>
      {live}
      {archiveMode && (
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <a href={localeHref(locale, '/archive')} className="-ml-1 flex items-center gap-0.5 font-semibold hover:underline">
            <BackIcon size={18} />
            {t('nav.archive')}
          </a>
          <span className="text-right text-xs text-muted">{t('puzzle.archiveBadge')}</span>
        </div>
      )}

      {puzzle.fallback && (
        <p className="mb-3 rounded-xl bg-surface px-4 py-3 text-sm leading-snug">
          {puzzle.fallback.reason === 'too_few_votes'
            ? t('fallback.tooFewVotes', { votes: puzzle.fallback.votes, needed: puzzle.fallback.needed })
            : t('fallback.noQuestion')}
        </p>
      )}

      <header className="text-center">
        <p className="text-sm font-semibold text-muted tnum">
          {t('puzzle.number', { number: puzzle.puzzle.number })}
          <span aria-hidden="true"> · </span>
          <time dateTime={puzzle.puzzle.date}>{fmt.date(puzzle.puzzle.date)}</time>
        </p>
        <p className="mt-3 text-[15px] text-muted [@media(max-height:700px)]:mt-1">
          {archiveMode || puzzle.mode === 'archive' || puzzle.fallback
            ? t('puzzle.kickerArchive', { date: fmt.date(puzzle.puzzle.date, 'long') })
            : t('puzzle.kickerDaily')}
        </p>
        <h1 className="mt-1 text-[clamp(24px,6.6vw,32px)] font-extrabold leading-[1.15] tracking-tight balance">
          {puzzle.puzzle.text}
        </h1>
        {!g.finished && <p className="mt-2 font-semibold">{t('puzzle.prompt')}</p>}
      </header>

      <div className="mt-5 [@media(max-height:700px)]:mt-3">
        <GuessTiles guesses={g.guesses} animateFrom={animateFrom} />
      </div>

      {!g.finished ? (
        <div className="mt-auto pt-5 sm:mt-10 sm:pt-0 [@media(max-height:700px)]:pt-3">
          <GuessInput
            value={value}
            onChange={setValue}
            onSubmit={submit}
            attemptsLeft={MAX_GUESSES - g.guesses.length}
            busy={busy}
            shakeKey={shakeKey}
          />
        </div>
      ) : (
        result && (
          <div className="mt-6 flex flex-col gap-6">
            <ResultPanel
              game={g}
              result={result}
              number={puzzle.puzzle.number}
              archive={puzzle.mode === 'archive'}
              animate={justFinished}
              onNewDay={fetchAll}
            />
            {!archiveMode && load.today && (
              <div className={justFinished ? 'anim-fade-up' : ''} style={justFinished ? { animationDelay: '2100ms' } : undefined}>
                <TodayPrompt today={load.today} />
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

/** After the result: one button that opens today's question in a dialog. */
function TodayPrompt({ today }: { today: TodayResponse }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState<boolean | null>(today.myVote);
  const q = today.question;

  if (!q) return <p className="text-center text-sm text-muted">{t('vote.none')}</p>;

  if (voted !== null && !open) {
    return (
      <p className="rounded-2xl bg-surface p-4 text-center text-sm leading-snug">
        <b>{t('vote.youAnswered', { answer: voted ? t('common.yes') : t('common.no') })}</b>{' '}
        <span className="text-muted">{t('vote.comeBack')}</span>
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-14 w-full rounded-full border-2 border-fg text-lg font-extrabold transition-colors hover:bg-fg hover:text-bg"
      >
        {t('vote.open')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('vote.title')}>
        <VoteCard today={{ ...today, myVote: voted }} bare onVoted={setVoted} />
        {voted !== null && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-5 h-12 w-full rounded-full bg-btn font-bold text-btn-fg hover:opacity-90"
          >
            {t('nav.close')}
          </button>
        )}
      </Modal>
    </>
  );
}
