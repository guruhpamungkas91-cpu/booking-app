export interface StaffItem {
  id?: number | string // Buat 'id' jadi optional (?) agar tidak merah saat create baru
  tenant_id?: string
  tenant_slug?: string
  name: string
  role?: string | null
  is_active?: boolean | null
  created_at?: string | null
  portfolio_urls?: string[] | null
  max_slots?: number
  photo_url?: string | null
  phone?: string | null

  staff_name?: string
  nama?: string

  [key: string]: unknown
}