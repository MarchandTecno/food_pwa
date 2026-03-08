import type {
  AdminBranch,
  AdminTenant,
  AdminUser,
  CreateBranchPayload,
  CreateTenantPayload,
  TenantSubscriptionStatus,
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
