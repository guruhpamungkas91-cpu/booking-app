export interface BaseService {
  id?: number | string // Buat 'id' jadi optional (?) agar tidak merah saat create baru
  tenant_slug?: string
  name: string
  price: number
  desc?: string
  description?: string
  duration?: number
  long_description?: string
  image_url?: string
  is_active?: boolean
}

export interface ServiceItem extends BaseService {
  label?: string
  is_addon?: boolean
}

export interface AddonService extends BaseService {
  addon_label?: string
  addon_price?: number
}