/**
 * Admin Roles & Permissions
 *
 * Role types are stored in the `description` field of the role as JSON:
 *   { label: "Head of Operations", role_type: "manager", maxDiscount: 5000 }
 *
 * Legacy roles (plain-text description) are treated as site_admin.
 *
 * Role hierarchy:
 *  site_admin    — full access, create all user types
 *  manager       — supervisor privileges + Queue, Bypass Logs, Drinks (no PC Control)
 *  supervisor    — add games, view reports, give discounts (capped by maxDiscount)
 *  account_audit — view reports, bypass logs, operator queue
 *  ic1           — Internal Control Level 1: camera-check data entry only
 *  ic2           — Internal Control Level 2: reviews comparison dashboard only
 */

export type RoleType = 'site_admin' | 'manager' | 'supervisor' | 'account_audit' | 'ic1' | 'ic2';
export type AdminTab =
  | 'pc'
  | 'queue'
  | 'bypasses'
  | 'games'
  | 'drinks'
  | 'reports'
  | 'admins'
  | 'manual-tx'
  | 'ic-entry'
  | 'ic-dashboard';

export interface AdminRoleData {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: any[];
  [key: string]: any;
}

export interface ParsedAdminRole {
  raw: AdminRoleData;
  roleType: RoleType;
  label: string;           // human-readable description
  maxDiscount: number | null; // null = unlimited
}

// ── Tab permissions per role ──────────────────────────────────────────────────

const ROLE_TABS: Record<RoleType, AdminTab[]> = {
  site_admin:    ['pc', 'queue', 'bypasses', 'games', 'drinks', 'reports', 'admins', 'manual-tx', 'ic-entry', 'ic-dashboard'],
  manager:       ['queue', 'bypasses', 'games', 'drinks', 'reports'],
  supervisor:    ['games', 'reports'],
  account_audit: ['queue', 'bypasses', 'reports'],
  ic1:           ['ic-entry'],
  ic2:           ['ic-dashboard', 'reports', 'bypasses', 'drinks', 'queue'],
};

// ── Discount permissions ──────────────────────────────────────────────────────

const CAN_DISCOUNT: Record<RoleType, boolean> = {
  site_admin:    true,
  manager:       true,
  supervisor:    true,
  account_audit: false,
  ic1:           false,
  ic2:           false,
};

// ── Role display names ────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<RoleType, string> = {
  site_admin:    'Site Admin',
  manager:       'Manager',
  supervisor:    'Supervisor',
  account_audit: 'Account & Audit',
  ic1:           'Internal Control L1',
  ic2:           'Internal Control L2',
};

// ── Parse adminData from sessionStorage ───────────────────────────────────────

export function parseAdminRole(raw: AdminRoleData): ParsedAdminRole {
  let roleType: RoleType = 'site_admin';
  let label = raw.description || '';
  let maxDiscount: number | null = null;

  try {
    const parsed = JSON.parse(raw.description || '{}');
    if (parsed.role_type && parsed.role_type in ROLE_TABS) {
      roleType = parsed.role_type as RoleType;
    }
    maxDiscount = typeof parsed.maxDiscount === 'number' ? parsed.maxDiscount : null;
    label = parsed.label || label;
  } catch {
    // Legacy plain-text description — treat as site_admin (backward compat)
  }

  return { raw, roleType, label, maxDiscount };
}

export function getAdminRole(): ParsedAdminRole | null {
  try {
    const raw = sessionStorage.getItem('adminData');
    if (!raw) return null;
    return parseAdminRole(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ── Permission helpers ────────────────────────────────────────────────────────

export function getPermittedTabs(role: ParsedAdminRole): AdminTab[] {
  return ROLE_TABS[role.roleType] ?? ['reports'];
}

export function canAccessTab(role: ParsedAdminRole, tab: AdminTab): boolean {
  return getPermittedTabs(role).includes(tab);
}

export function canGiveDiscount(role: ParsedAdminRole): boolean {
  return CAN_DISCOUNT[role.roleType] ?? false;
}

/** Returns the max allowed discount in currency units. null = unlimited. */
export function getMaxDiscount(role: ParsedAdminRole): number | null {
  if (!canGiveDiscount(role)) return 0;
  if (role.roleType === 'site_admin') return null; // unlimited
  return role.maxDiscount;
}

export function canManageAdmins(role: ParsedAdminRole): boolean {
  return role.roleType === 'site_admin';
}

/** Encode the description JSON for storage when creating a new admin */
export function encodeRoleDescription(
  label: string,
  roleType: RoleType,
  maxDiscount: number | null
): string {
  return JSON.stringify({ label, role_type: roleType, maxDiscount });
}
