export interface BaseService {
  id?: number | string
  tenant_id?: number | string
  tenant_slug?: string
  client_code?: string
  name?: string
  label?: string // Tambahan agar aman saat menerima item dari TenantAddonItem
  price?: number
  desc?: string
  description?: string
  duration?: number | string
  long_description?: string
  image_url?: string
  is_active?: boolean
  is_addon?: boolean
  addon_label?: string
  addon_price?: number
}

/**
 * ServiceItem mewarisi BaseService
 */
export interface ServiceItem extends BaseService {
  // Tempat penambahan kolom khusus ServiceItem jika ada di masa depan
}

/**
 * AddonService mewarisi BaseService
 */
export interface AddonService extends BaseService {
  // Tempat penambahan kolom khusus AddonService jika ada di masa depan
}

/**
 * Tipe union untuk variabel state UI (seperti selectedServiceDetail)
 */
export type ServiceDetail = BaseService | ServiceItem | AddonService