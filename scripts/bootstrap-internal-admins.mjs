#!/usr/bin/env node
import { createRequire } from 'node:module';

const requireFromFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
const { createClient } = requireFromFrontend('@supabase/supabase-js');

const VALID_ROLES = new Set([
  'platform_owner',
  'ops_manager',
  'support_lead',
  'support_agent',
  'payout_reviewer',
  'payout_approver',
]);

const LEGACY_ROLE_MAP = new Map([
  ['ceo', ['platform_owner']],
  ['internal_admin', ['ops_manager']],
  ['support_admin', ['support_lead']],
  ['payout_admin', ['payout_reviewer', 'payout_approver']],
]);

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAllowedSet(value) {
  return new Set(splitCsv(value).map((item) => item.toLowerCase()));
}

function parseStaffEntries() {
  const staffJsonValue = process.env.KARGAX_STAFF_JSON?.trim();

  if (staffJsonValue) {
    const parsed = JSON.parse(staffJsonValue);
    if (!Array.isArray(parsed)) {
      throw new Error('KARGAX_STAFF_JSON must be a JSON array.');
    }
    return parsed;
  }

  const legacyJsonValue = process.env.INTERNAL_ADMINS_JSON?.trim();

  if (legacyJsonValue) {
    const parsed = JSON.parse(legacyJsonValue);
    if (!Array.isArray(parsed)) {
      throw new Error('INTERNAL_ADMINS_JSON must be a JSON array.');
    }
    return parsed;
  }

  const email = process.env.KARGAX_STAFF_EMAIL?.trim() || process.env.INTERNAL_ADMIN_EMAIL?.trim();
  const password = process.env.KARGAX_STAFF_PASSWORD || process.env.INTERNAL_ADMIN_PASSWORD || '';

  if (!email && !password) {
    return [];
  }

  if (!email || !password) {
    throw new Error('KARGAX_STAFF_EMAIL and KARGAX_STAFF_PASSWORD must be set together.');
  }

  return [{
    email,
    password,
    fullName: process.env.KARGAX_STAFF_FULL_NAME || process.env.INTERNAL_ADMIN_FULL_NAME || 'Staff KargaX',
    roles: splitCsv(process.env.KARGAX_STAFF_ROLES || process.env.INTERNAL_ADMIN_ROLES || 'support_agent'),
  }];
}

function normalizeRoles(value) {
  const rawRoles = Array.isArray(value)
    ? value.map((role) => String(role).trim()).filter(Boolean)
    : splitCsv(value || 'support_agent');
  const roles = new Set();

  for (const rawRole of rawRoles) {
    const mapped = LEGACY_ROLE_MAP.get(rawRole) || [rawRole];

    for (const role of mapped) {
      if (!VALID_ROLES.has(role)) {
        throw new Error(`Invalid staff role ${role}.`);
      }
      roles.add(role);
    }
  }

  return [...roles];
}

function normalizeEntry(entry) {
  const email = String(entry?.email || '').trim().toLowerCase();
  const password = String(entry?.password || '');
  const fullName = String(entry?.fullName || entry?.full_name || 'Staff KargaX').trim();
  const roles = normalizeRoles(entry?.roles ?? entry?.role);

  if (!email) {
    throw new Error('Each staff entry requires email.');
  }

  if (!password) {
    throw new Error(`Staff user ${email} requires password.`);
  }

  if (!roles.length) {
    throw new Error(`Staff user ${email} requires at least one role.`);
  }

  return {
    email,
    password,
    fullName,
    roles,
  };
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Could not list Supabase users: ${error.message}`);
    }

    const users = data?.users || [];
    const found = users.find((user) => user.email?.toLowerCase() === email);
    if (found) {
      return found;
    }

    if (users.length < 1000) {
      return null;
    }
  }

  return null;
}

function getProfileUserType(entry) {
  return entry.roles.includes('platform_owner') ? 'admin' : 'staff';
}

async function ensureAuthUser(supabase, entry) {
  const existing = await findAuthUserByEmail(supabase, entry.email);
  const userType = getProfileUserType(entry);
  const shouldResetPassword = process.env.KARGAX_STAFF_RESET_PASSWORDS === 'true'
    || process.env.INTERNAL_ADMINS_RESET_PASSWORDS === 'true';

  if (existing) {
    if (shouldResetPassword) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: entry.password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata || {}),
          user_type: userType,
          full_name: entry.fullName,
        },
      });

      if (error || !data?.user) {
        throw new Error(`Could not update existing staff user ${entry.email}: ${error?.message || 'unknown error'}`);
      }
      return data.user;
    }

    await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        user_type: userType,
        full_name: entry.fullName,
      },
    });

    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: entry.email,
    password: entry.password,
    email_confirm: true,
    user_metadata: {
      user_type: userType,
      full_name: entry.fullName,
    },
  });

  if (error || !data?.user) {
    throw new Error(`Could not create staff user ${entry.email}: ${error?.message || 'unknown error'}`);
  }

  return data.user;
}

function assertPlatformOwnerAllowed(entry, userId) {
  if (!entry.roles.includes('platform_owner')) {
    return;
  }

  const allowedEmails = parseAllowedSet(process.env.KARGAX_CEO_EMAILS);
  const allowedUserIds = parseAllowedSet(process.env.KARGAX_CEO_USER_IDS);

  if (!allowedEmails.has(entry.email) && !allowedUserIds.has(userId.toLowerCase())) {
    throw new Error(`Refusing to grant platform_owner to ${entry.email}. Add email to KARGAX_CEO_EMAILS or user id to KARGAX_CEO_USER_IDS first.`);
  }
}

async function upsertProfileAndRoles(supabase, user, entry) {
  assertPlatformOwnerAllowed(entry, user.id);

  const userType = getProfileUserType(entry);
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: user.id,
      email: entry.email,
      full_name: entry.fullName,
      user_type: userType,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(`Could not upsert user profile for ${entry.email}: ${profileError.message}`);
  }

  for (const role of entry.roles) {
    const { error: roleError } = await supabase
      .from('staff_memberships')
      .upsert({
        user_id: user.id,
        role,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      throw new Error(`Could not upsert ${role} for ${entry.email}: ${roleError.message}`);
    }
  }

  await supabase
    .from('staff_audit_events')
    .insert({
      actor_id: user.id,
      actor_role: entry.roles[0],
      capability: 'platform:critical_settings',
      target_type: 'staff_membership',
      target_id: user.id,
      new_state: {
        email: entry.email,
        roles: entry.roles,
        user_type: userType,
      },
      reason: 'bootstrap_staff_from_env',
    });
}

async function main() {
  const entries = parseStaffEntries().map(normalizeEntry);

  if (!entries.length) {
    console.log('No KARGAX_STAFF_JSON or KARGAX_STAFF_EMAIL/PASSWORD configured. Nothing to seed.');
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const entry of entries) {
    const user = await ensureAuthUser(supabase, entry);
    await upsertProfileAndRoles(supabase, user, entry);
    console.log(`Staff user ready: ${entry.email} roles=${entry.roles.join(',')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
