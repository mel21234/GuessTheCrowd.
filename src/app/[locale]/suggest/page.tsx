import type { Metadata } from 'next';
import { SuggestScreen } from '@/components/pages/SuggestScreen';
import { localeFromParams, pageMetadata } from '../../metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(await localeFromParams(params), '/suggest', 'meta.suggestTitle');
}

export default function SuggestPage() {
  return <SuggestScreen />;
}
