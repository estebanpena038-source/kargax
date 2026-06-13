import { redirect } from 'next/navigation';

export default function AdminPayoutsRedirectPage() {
    redirect('/staff/payouts');
}
