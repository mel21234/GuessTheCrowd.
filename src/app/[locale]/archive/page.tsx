import type { Metadata } from 'next';
import { ArchiveScreen } from '@/components/pages/ArchiveScreen';
import { localeFromParams, pageMetadata } from '../../metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(await localeFromParams(params), '/archive', 'meta.archiveTitle');
}

export default function ArchivePage() {
  return <ArchiveScreen />;
}
