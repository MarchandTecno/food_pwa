import type {
  AdminAuditLog,
  AdminAuditLogFilter,
  AdminAuditLogPage,
  AdminGlobalRole,
  AdminBranch,
  AdminObservabilitySnapshot,
  AdminRolePermission,
  AdminSessionLog,
  AdminSessionLogPage,
  AdminTenant,
  AdminUser,
  AdminUserFilter,
  AdminUserRecord,
  AdminSessionLogFilter,
  CreateAdminUserPayload,
  CreateBranchPayload,
  CreateTenantPayload,
  TenantSubscriptionStatus,
  UpdateAdminUserAssignmentPayload,
  UpdateBrandingPayload,
} from '../types/admin';

const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT?.trim() || 'http://localhost:4001/graphql';

interface GraphQLError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Error al consultar GraphQL (${response.status})`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message || 'Error inesperado en GraphQL');
  }

  if (!payload.data) {
    throw new Error('Respuesta GraphQL sin datos');
  }

  return payload.data;
}

const LOGIN_MUTATION = `
  mutation LoginAdmin($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        nombre
        role
      }
    }
  }
`;

const ME_QUERY = `
  query Me {
    me {
      id
      email
      nombre
      role
    }
  }
`;

const ADMIN_TENANTS_QUERY = `
  query AdminTenants($limit: Int, $offset: Int) {
    adminTenants(limit: $limit, offset: $offset) {
      id
      nombre_comercial
      razon_social
      rfc_tax_id
      email_admin
      telefono_contacto
      logo_url
      moneda
      region_code
      time_zone
      palette_css {
        key
        value
      }
      subscription_status
      subscription_note
      subscription_updated_at
      is_active
      created_at
      updated_at
    }
  }
`;

const ADMIN_CREATE_TENANT_MUTATION = `
  mutation AdminCreateTenant($input: AdminCreateTenantInput!) {
    adminCreateTenant(input: $input) {
      id
      nombre_comercial
      razon_social
      rfc_tax_id
      email_admin
      telefono_contacto
      logo_url
      moneda
      region_code
      time_zone
      palette_css {
        key
        value
      }
      subscription_status
      subscription_note
      subscription_updated_at
      is_active
      created_at
      updated_at
    }
  }
`;

const ADMIN_UPDATE_TENANT_SUBSCRIPTION_MUTATION = `
  mutation AdminUpdateTenantSubscription($tenantId: String!, $status: TenantSubscriptionStatus!, $reason: String) {
    adminUpdateTenantSubscription(tenant_id: $tenantId, status: $status, reason: $reason) {
      id
      subscription_status
      subscription_note
      subscription_updated_at
      is_active
      updated_at
    }
  }
`;

const ADMIN_UPDATE_TENANT_BRANDING_MUTATION = `
  mutation AdminUpdateTenantBranding($tenantId: String!, $input: AdminTenantBrandingInput!) {
    adminUpdateTenantBranding(tenant_id: $tenantId, input: $input) {
      id
      logo_url
      palette_css {
        key
        value
      }
      updated_at
    }
  }
`;

const ADMIN_TENANT_BRANCHES_QUERY = `
  query AdminTenantBranches($tenantId: String!) {
    adminTenantBranches(tenant_id: $tenantId) {
      id
      tenant_id
      nombre_sucursal
      direccion_fisica
      horario_apertura
      horario_cierre
      is_open
      is_suspended
      suspension_reason
    }
  }
`;

const ADMIN_CREATE_BRANCH_MUTATION = `
  mutation AdminCreateBranch($input: AdminCreateBranchInput!) {
    adminCreateBranch(input: $input) {
      id
      tenant_id
      nombre_sucursal
      direccion_fisica
      horario_apertura
      horario_cierre
      is_open
      is_suspended
      suspension_reason
    }
  }
`;

const ADMIN_SET_BRANCH_SUSPENDED_MUTATION = `
  mutation AdminSetBranchSuspended($branchId: String!, $suspended: Boolean!, $reason: String) {
    adminSetBranchSuspended(branch_id: $branchId, suspended: $suspended, reason: $reason) {
      id
      tenant_id
      nombre_sucursal
      direccion_fisica
      horario_apertura
      horario_cierre
      is_open
      is_suspended
      suspension_reason
    }
  }
`;

const ADMIN_ROLE_PERMISSIONS_QUERY = `
  query AdminRolePermissions {
    adminRolePermissions {
      role
      hierarchy_level
      label
      scope
      permissions
    }
  }
`;

const ADMIN_USERS_QUERY = `
  query AdminUsers($limit: Int, $offset: Int, $filter: AdminUserFilterInput) {
    adminUsers(limit: $limit, offset: $offset, filter: $filter) {
      id
      nombre
      email
      role
      role_label
      tenant_id
      tenant_nombre
      branch_id
      branch_nombre
      is_active
      last_login
      created_at
    }
  }
`;

const ADMIN_CREATE_USER_MUTATION = `
  mutation AdminCreateUser($input: AdminCreateUserInput!) {
    adminCreateUser(input: $input) {
      id
      nombre
      email
      role
      role_label
      tenant_id
      tenant_nombre
      branch_id
      branch_nombre
      is_active
      last_login
      created_at
    }
  }
`;

const ADMIN_UPDATE_USER_ASSIGNMENT_MUTATION = `
  mutation AdminUpdateUserAssignment($input: AdminUpdateUserAssignmentInput!) {
    adminUpdateUserAssignment(input: $input) {
      id
      nombre
      email
      role
      role_label
      tenant_id
      tenant_nombre
      branch_id
      branch_nombre
      is_active
      last_login
      created_at
    }
  }
`;

const ADMIN_RESET_USER_PASSWORD_MUTATION = `
  mutation AdminResetUserPassword($userId: String!, $newPassword: String!) {
    adminResetUserPassword(user_id: $userId, new_password: $newPassword)
  }
`;

const ADMIN_SESSION_LOGS_QUERY = `
  query AdminSessionLogs($limit: Int, $offset: Int, $filter: AdminSessionLogFilterInput) {
    adminSessionLogs(limit: $limit, offset: $offset, filter: $filter) {
      id
      user_id
      user_email
      user_nombre
      tenant_id
      tenant_nombre
      role
      action
      ip_address
      happened_at
      last_access
    }
  }
`;

const ADMIN_SESSION_LOGS_PAGE_QUERY = `
  query AdminSessionLogsPage($limit: Int, $offset: Int, $filter: AdminSessionLogFilterInput) {
    adminSessionLogsPage(limit: $limit, offset: $offset, filter: $filter) {
      items {
        id
        user_id
        user_email
        user_nombre
        tenant_id
        tenant_nombre
        role
        action
        ip_address
        happened_at
        last_access
      }
      pageInfo {
        total
        hasNextPage
        nextCursor
        limit
        offset
      }
    }
  }
`;

const ADMIN_AUDIT_LOGS_PAGE_QUERY = `
  query AdminAuditLogsPage($limit: Int, $offset: Int, $filter: AdminAuditLogFilterInput) {
    adminAuditLogsPage(limit: $limit, offset: $offset, filter: $filter) {
      items {
        id
        actor_user_id
        actor_user_email
        actor_user_nombre
        actor_role
        tenant_id
        tenant_nombre
        entity
        action
        record_id
        ip_address
        happened_at
        previous_value
        new_value
      }
      pageInfo {
        total
        hasNextPage
        nextCursor
        limit
        offset
      }
    }
  }
`;

const ADMIN_OBSERVABILITY_SNAPSHOT_QUERY = `
  query AdminObservabilitySnapshot {
    adminObservabilitySnapshot {
      checked_at
      health {
        status
        db
        uptime_seconds
        checked_at
        db_ping_ms
        error
      }
      server {
        total_requests
        avg_latency_ms
        peak_latency_ms
        recent_latency {
          timestamp
          label
          value
        }
        operations {
          label
          count
          avg_ms
          min_ms
          max_ms
        }
        errors_by_code {
          label
          count
        }
      }
      database {
        total_queries
        avg_query_ms
        slow_queries
        last_query_at
        recent_queries {
          timestamp
          label
          value
        }
        queries_by_type {
          label
          count
          avg_ms
          min_ms
          max_ms
        }
      }
    }
  }
`;

export async function loginAdmin(email: string, password: string): Promise<{ token: string; user: AdminUser }> {
  const data = await graphqlRequest<{ login: { token: string; user: AdminUser } | null }>(
    LOGIN_MUTATION,
    { email, password },
  );

  if (!data.login) {
    throw new Error('No se pudo iniciar sesión');
  }

  return data.login;
}

export async function fetchMe(token: string): Promise<AdminUser | null> {
  const data = await graphqlRequest<{ me: AdminUser | null }>(ME_QUERY, {}, token);
  return data.me;
}

export async function fetchAdminTenants(token: string): Promise<AdminTenant[]> {
  const data = await graphqlRequest<{ adminTenants: AdminTenant[] | null }>(ADMIN_TENANTS_QUERY, { limit: 100, offset: 0 }, token);
  return data.adminTenants ?? [];
}

export async function createTenant(token: string, input: CreateTenantPayload): Promise<AdminTenant> {
  const data = await graphqlRequest<{ adminCreateTenant: AdminTenant }>(
    ADMIN_CREATE_TENANT_MUTATION,
    { input },
    token,
  );

  return data.adminCreateTenant;
}

export async function updateTenantSubscription(
  token: string,
  tenantId: string,
  status: TenantSubscriptionStatus,
  reason?: string,
): Promise<void> {
  await graphqlRequest<{ adminUpdateTenantSubscription: AdminTenant }>(
    ADMIN_UPDATE_TENANT_SUBSCRIPTION_MUTATION,
    { tenantId, status, reason },
    token,
  );
}

export async function updateTenantBranding(
  token: string,
  tenantId: string,
  input: UpdateBrandingPayload,
): Promise<void> {
  await graphqlRequest<{ adminUpdateTenantBranding: AdminTenant }>(
    ADMIN_UPDATE_TENANT_BRANDING_MUTATION,
    { tenantId, input },
    token,
  );
}

export async function fetchTenantBranches(token: string, tenantId: string): Promise<AdminBranch[]> {
  const data = await graphqlRequest<{ adminTenantBranches: AdminBranch[] | null }>(
    ADMIN_TENANT_BRANCHES_QUERY,
    { tenantId },
    token,
  );

  return data.adminTenantBranches ?? [];
}

export async function createBranch(token: string, input: CreateBranchPayload): Promise<AdminBranch> {
  const data = await graphqlRequest<{ adminCreateBranch: AdminBranch }>(
    ADMIN_CREATE_BRANCH_MUTATION,
    { input },
    token,
  );

  return data.adminCreateBranch;
}

export async function setBranchSuspended(
  token: string,
  branchId: string,
  suspended: boolean,
  reason?: string,
): Promise<void> {
  await graphqlRequest<{ adminSetBranchSuspended: AdminBranch }>(
    ADMIN_SET_BRANCH_SUSPENDED_MUTATION,
    { branchId, suspended, reason },
    token,
  );
}

export async function fetchAdminRolePermissions(token: string): Promise<AdminRolePermission[]> {
  const data = await graphqlRequest<{ adminRolePermissions: AdminRolePermission[] | null }>(
    ADMIN_ROLE_PERMISSIONS_QUERY,
    {},
    token,
  );

  return data.adminRolePermissions ?? [];
}

export async function fetchAdminUsers(
  token: string,
  filter?: AdminUserFilter,
): Promise<AdminUserRecord[]> {
  const data = await graphqlRequest<{ adminUsers: AdminUserRecord[] | null }>(
    ADMIN_USERS_QUERY,
    {
      limit: 100,
      offset: 0,
      filter,
    },
    token,
  );

  return data.adminUsers ?? [];
}

export async function createAdminUser(token: string, input: CreateAdminUserPayload): Promise<AdminUserRecord> {
  const data = await graphqlRequest<{ adminCreateUser: AdminUserRecord }>(
    ADMIN_CREATE_USER_MUTATION,
    { input },
    token,
  );

  return data.adminCreateUser;
}

export async function updateAdminUserAssignment(
  token: string,
  input: UpdateAdminUserAssignmentPayload,
): Promise<AdminUserRecord> {
  const data = await graphqlRequest<{ adminUpdateUserAssignment: AdminUserRecord }>(
    ADMIN_UPDATE_USER_ASSIGNMENT_MUTATION,
    { input },
    token,
  );

  return data.adminUpdateUserAssignment;
}

export async function resetAdminUserPassword(token: string, userId: string, newPassword: string): Promise<boolean> {
  const data = await graphqlRequest<{ adminResetUserPassword: boolean }>(
    ADMIN_RESET_USER_PASSWORD_MUTATION,
    { userId, newPassword },
    token,
  );

  return data.adminResetUserPassword;
}

export async function fetchAdminSessionLogs(
  token: string,
  filter?: AdminSessionLogFilter,
): Promise<AdminSessionLog[]> {
  const page = await fetchAdminSessionLogsPage(token, {
    limit: 120,
    offset: 0,
    filter,
  });

  return page.items;
}

interface SessionLogPageRequest {
  limit?: number;
  offset?: number;
  filter?: AdminSessionLogFilter;
}

interface AuditLogPageRequest {
  limit?: number;
  offset?: number;
  filter?: AdminAuditLogFilter;
}

export async function fetchAdminSessionLogsPage(
  token: string,
  request?: SessionLogPageRequest,
): Promise<AdminSessionLogPage> {
  const data = await graphqlRequest<{ adminSessionLogsPage: AdminSessionLogPage }>(
    ADMIN_SESSION_LOGS_PAGE_QUERY,
    {
      limit: request?.limit ?? 25,
      offset: request?.offset ?? 0,
      filter: request?.filter,
    },
    token,
  );

  return data.adminSessionLogsPage;
}

export async function fetchAdminAuditLogsPage(
  token: string,
  request?: AuditLogPageRequest,
): Promise<AdminAuditLogPage> {
  const data = await graphqlRequest<{ adminAuditLogsPage: AdminAuditLogPage }>(
    ADMIN_AUDIT_LOGS_PAGE_QUERY,
    {
      limit: request?.limit ?? 25,
      offset: request?.offset ?? 0,
      filter: request?.filter,
    },
    token,
  );

  return data.adminAuditLogsPage;
}

export async function fetchAdminObservabilitySnapshot(token: string): Promise<AdminObservabilitySnapshot> {
  const data = await graphqlRequest<{ adminObservabilitySnapshot: AdminObservabilitySnapshot }>(
    ADMIN_OBSERVABILITY_SNAPSHOT_QUERY,
    {},
    token,
  );

  return data.adminObservabilitySnapshot;
}

export const ADMIN_GLOBAL_ROLES: AdminGlobalRole[] = ['SUPERADMIN', 'OWNER', 'KITCHEN', 'DELIVERY'];
