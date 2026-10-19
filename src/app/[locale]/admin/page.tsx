import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';
import { localeFromParams, pageMetadata } from '../../metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return pageMetadata(await localeFromParams(params), '/admin', 'meta.adminTitle', { noindex: true });
}

export default function AdminPage() {
  return <AdminApp />;
}
