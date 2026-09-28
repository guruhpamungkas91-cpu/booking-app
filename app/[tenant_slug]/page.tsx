import BookingForm from '@/components/booking/BookingForm'

interface PageProps {
  params: Promise<{ tenant_slug: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function TenantPage({ params }: PageProps) {
  // Wajib diawait di Next.js 15 untuk memenuhi kontrak async params
  await params 

  return <BookingForm />
}