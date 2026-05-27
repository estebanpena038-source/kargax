import { redirect } from 'next/navigation';

export default async function LegacyInspectionDetailPage({
    params,
}: {
    params: Promise<{ offerId: string }>;
}) {
    const { offerId } = await params;
    redirect(`/pod-marketplace/${offerId}`);
}
