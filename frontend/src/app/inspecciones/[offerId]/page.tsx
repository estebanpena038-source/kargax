'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import { getInspectionReport, type InspectionReport, type InspectionPhoto } from '@/lib/inspections';

import {
    ReportHeader,
    SummarySection,
    ManifestSection,
    TimelineSection,
    PhotoGallery,
    PhotoModal,
} from './components';

export default function InspectionReportPage() {
    const params = useParams();
    const router = useRouter();
    const { t, locale } = useTranslation();
    const offerId = params?.offerId as string;

    const [report, setReport] = React.useState<InspectionReport | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [modalPhotos, setModalPhotos] = React.useState<InspectionPhoto[] | null>(null);

    const fetchReport = React.useCallback(async () => {
        if (!offerId) { setIsLoading(false); setError('ID de oferta requerido'); return; }
        setIsLoading(true); setError(null);
        try {
            const res = await getInspectionReport(offerId);
            if (res.success && res.data) { setReport(res.data); }
            else { setError(res.error || t('inspection.notFound')); }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('inspection.error'));
        }
        setIsLoading(false);
    }, [offerId, t]);

    React.useEffect(() => { fetchReport(); }, [fetchReport]);

    if (isLoading) {
        return (
            <DashboardLayout pageTitle={t('inspection.pageTitle')}>
                <div className="kx-trip-container flex min-h-[400px] flex-col items-center justify-center p-4 text-center min-[380px]:p-6 lg:p-8">
                    <Loader2 className="mb-4 h-10 w-10 animate-spin text-zinc-800" />
                    <p className="text-slate-500">{t('inspection.loading')}</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !report) {
        return (
            <DashboardLayout pageTitle={t('inspection.pageTitle')}>
                <div className="kx-trip-container flex min-h-[400px] flex-col items-center justify-center p-4 text-center min-[380px]:p-6 lg:p-8">
                    <AlertCircle className="mb-4 h-12 w-12 text-zinc-800" />
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('inspection.error')}</h2>
                    <p className="text-slate-500 mb-6 text-center max-w-md">{error}</p>
                    <Button onClick={fetchReport} variant="primary"><RefreshCw className="w-4 h-4 mr-2" />{t('inspection.retry')}</Button>
                </div>
            </DashboardLayout>
        );
    }

    const handleViewItemPhotos = (urls: string[]) => {
        const reportPhotos = report?.photos || [];
        const photos = urls
            .map((url) => reportPhotos.find((photo) => photo.url === url))
            .filter((photo): photo is InspectionPhoto => Boolean(photo));

        setModalPhotos(photos.length ? photos : null);
    };

    return (
        <DashboardLayout pageTitle={t('inspection.pageTitle')}>
            <div className="kx-trip-container space-y-6 p-3 min-[380px]:p-4 md:p-6 lg:p-8">
                <ReportHeader report={report} t={t} locale={locale} onBack={() => router.back()} />
                <SummarySection summary={report.summary} t={t} />
                <ManifestSection items={report.manifestItems} t={t} locale={locale} onViewPhotos={handleViewItemPhotos} />
                <PhotoGallery photos={report.photos} locale={locale} />
                <TimelineSection timeline={report.timeline} t={t} locale={locale} />
            </div>
            <AnimatePresence>
                {modalPhotos && <PhotoModal photos={modalPhotos} initialIndex={0} onClose={() => setModalPhotos(null)} locale={locale} />}
            </AnimatePresence>
        </DashboardLayout>
    );
}
