import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GameScreen } from '@/components/game/GameScreen';
import { localeFromParams, pageMetadata } from '../../../metadata';

type Params = Promise<{ locale: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  return pageMetadata(await localeFromParams(params), `/archive/${number}`, 'meta.archiveTitle', { noindex: true });
}

export default async function ArchiveGamePage({ params }: { params: Params }) {
  const { number } = await params;
  if (!/^\d{1,6}$/.test(number)) notFound();
  return <GameScreen number={Number(number)} />;
}
