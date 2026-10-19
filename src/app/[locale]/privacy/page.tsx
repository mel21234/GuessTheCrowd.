import type { Metadata } from 'next';
import { PrivacyScreen } from '@/components/pages/PrivacyScreen';
import { localeFromParams, pageMetadata } from '../../metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(await localeFromParams(params), '/privacy', 'meta.privacyTitle');
}

export default function PrivacyPage() {
  return <PrivacyScreen email={process.env.CONTACT_EMAIL || 'privacy@guessthecrowd.com'} />;
}
