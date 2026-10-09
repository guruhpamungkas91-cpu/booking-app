export interface BankAccount {
  bank_name: string
  account_number: string
  holder_name: string
}

export interface EWalletAccount {
  wallet_name: string
  phone_number: string
  holder_name: string
}

export interface TenantAddonItem {
  id?: string | number
  name?: string
  label?: string
  addon_label?: string
  price: number
  desc?: string
  description?: string
  long_description?: string
  image_url?: string
  duration?: number
  is_addon?: boolean
}

export interface Tenant {
  id?: string
  name?: string
  business_name?: string
  tenant_slug?: string
  tenantSlug?: string
  client_code?: string
  clientCode?: string
  admin_wa?: string
  adminWa?: string
  waGatewayUrl?: string
  waApiKey?: string
  domain_url?: string
  logo_url?: string
  custom_terms_text?: string
  subscription_plan?: 'PROFESIONAL' | 'ULTIMATE' | string | null
  subscriptionPlan?: string
  is_active?: boolean
  prevent_double_booking?: boolean
  preventDoubleBooking?: boolean
  enable_slot_blocking?: boolean
  enableSlotBlocking?: boolean
  enable_auto_disable_time_slots?: boolean
  enableAutoDisableTimeSlots?: boolean
  hide_booked_slots?: boolean
  hideBookedSlots?: boolean
  auto_wa_reminder?: boolean
  require_consent?: boolean
  requireConsent?: boolean
  show_extra_addon?: boolean
  showExtraAddon?: boolean
  is_system_maintenance?: boolean
  is_maintenance_mode?: boolean
  isMaintenance?: boolean
  enable_maintenance_feature?: boolean
  maintenance_message?: string
  force_otp_verification?: boolean
  auto_lunch_break?: boolean
  custom_payment_dp?: boolean
  public_reviews?: boolean
  enable_multi_staff?: boolean
  enable_multi_service?: boolean
  enable_notes?: boolean
  enableNotes?: boolean
  financial_reports?: boolean
  custom_dashboard_theme?: boolean | string
  staff_performance?: boolean
  business_performance?: boolean
  layout_type?: string
  layoutType?: string
  enable_guest_count?: boolean
  enableGuestCount?: boolean
  maxPersonPerBooking?: number | string
  max_person_per_booking?: number | string
  category?: string
  staff_label?: string
  staffLabel?: string
  control_center_label?: string
  theme_color?: string
  themeColor?: string
  super_admin_toggle?: boolean
  is_super_admin_active?: boolean
  admin_email?: string
  bank_accounts?: BankAccount[]
  ewallet_accounts?: EWalletAccount[]
  dp_type?: string
  dpType?: string
  dp_value?: number | string
  dpValue?: number | string
  qris_url?: string
  qrisUrl?: string
  addons?: TenantAddonItem[]
  [key: string]: unknown
}