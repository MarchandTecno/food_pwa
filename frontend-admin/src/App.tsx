import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ADMIN_GLOBAL_ROLES,
  createAdminUser,
  createBranch,
  createTenant,
  fetchAdminAuditLogsPage,
  fetchAdminObservabilitySnapshot,
  fetchAdminRolePermissions,
  fetchAdminSessionLogsPage,
  fetchAdminTenants,
  fetchAdminUsers,
  fetchMe,
  fetchTenantBranches,
  loginAdmin,
  resetAdminUserPassword,
  setBranchSuspended,
  updateAdminUserAssignment,
  updateTenantBranding,
  updateTenantSubscription,
} from './services/adminApi';
import type {
  AdminAuditLog,
  AdminBranch,
  AdminGlobalRole,
  AdminMetricPoint,
  AdminObservabilitySnapshot,
  AdminRolePermission,
  AdminSessionLog,
  AdminTenant,
  AdminUser,
  AdminUserRecord,
  CreateAdminUserPayload,
  CreateBranchPayload,
  CreateTenantPayload,
  PageInfo,
  TenantSubscriptionStatus,
  UpdateAdminUserAssignmentPayload,
  UpdateBrandingPayload,
} from './types/admin';

const TOKEN_STORAGE_KEY = 'foodflow_superadmin_token';

type MainTab = 'tenants' | 'create-tenant' | 'manage-tenant' | 'access-control' | 'system-monitor';
type TenantOpsTab = 'subscription' | 'branding' | 'branches';
type AccessOpsTab = 'hierarchy' | 'users' | 'sessions';
type MonitorOpsTab = 'audit' | 'health';

const AUDIT_ENTITY_OPTIONS = [
  { value: 'orders', label: 'Pedidos' },
  { value: 'products', label: 'Productos' },
  { value: 'users', label: 'Usuarios' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'branches', label: 'Sucursales' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'cash', label: 'Caja' },
  { value: 'coupons', label: 'Cupones' },
] as const;
type AuditEntityOption = (typeof AUDIT_ENTITY_OPTIONS)[number]['value'];

const initialTenantForm: CreateTenantPayload = {
  nombre_comercial: '',
  email_admin: '',
  razon_social: '',
  rfc_tax_id: '',
  telefono_contacto: '',
  logo_url: '',
  moneda: 'MXN',
  region_code: 'MX',
  time_zone: 'America/Mexico_City',
};

const initialBranchForm: Omit<CreateBranchPayload, 'tenant_id'> = {
  nombre_sucursal: '',
  direccion_fisica: '',
  horario_apertura: '',
  horario_cierre: '',
};

const initialCreateUserForm = {
  nombre: '',
  email: '',
  password: 'ChangeMe123!',
  role: 'OWNER' as AdminGlobalRole,
  tenant_id: '',
  branch_id: '',
  is_active: true,
};

const STRONG_PASSWORD_MIN_LENGTH = 12;
const SESSION_LOG_PAGE_SIZE = 25;
const AUDIT_LOG_PAGE_SIZE = 25;
const MONITOR_POLL_INTERVAL_MS = 10000;

function toOptional(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNullable(value: string | undefined): string | null | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Partial<T>;
}

function formatDate(value: string | null): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }

  return `${value.toFixed(0)} ms`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('es-MX').format(value);
}

function formatAuditPayload(value: string | null): string {
  if (!value) return '';

  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function toDateTimeLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTimeOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function IconTenants() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function IconCreateTenant() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h16" />
      <path d="M12 4v10" />
      <path d="M7 9h10" />
      <path d="M7 20V12" />
      <path d="M17 20V12" />
    </svg>
  );
}

function IconOperations() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 6h6" />
      <path d="M14 12h6" />
      <path d="M14 18h6" />
      <path d="M4 6h6" />
      <path d="M4 12h6" />
      <path d="M4 18h6" />
    </svg>
  );
}

function IconAccess() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l7 3v6c0 5-3.2 8.6-7 9-3.8-.4-7-4-7-9V6l7-3z" />
      <path d="M9.5 11.5h5" />
      <path d="M12 9v5" />
    </svg>
  );
}

function IconSystemMonitor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 13h4l2-4 4 8 2-4h6" />
      <path d="M4 20h16" />
      <path d="M5 4h14v6H5z" />
    </svg>
  );
}

interface MetricLineChartProps {
  title: string;
  subtitle: string;
  points: AdminMetricPoint[];
  stroke: string;
  emptyLabel: string;
}

function MetricLineChart({ title, subtitle, points, stroke, emptyLabel }: MetricLineChartProps) {
  const visiblePoints = points.slice(-24);
  const values = visiblePoints.map((point) => point.value);
  const max = values.length > 0 ? Math.max(...values, 1) : 1;
  const min = values.length > 0 ? Math.min(...values, 0) : 0;
  const range = max - min || 1;
  const width = 320;
  const height = 148;
  const lastPoint = visiblePoints.length > 0 ? visiblePoints[visiblePoints.length - 1] : null;
  const path = visiblePoints
    .map((point, index) => {
      const x = visiblePoints.length === 1 ? width / 2 : (index / (visiblePoints.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <article className="boxed stack metric-chart-card">
      <div>
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
      </div>

      <div className="chart-shell">
        {visiblePoints.length === 0 ? (
          <p className="muted">{emptyLabel}</p>
        ) : (
          <svg className="chart-svg" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="none" role="img" aria-label={title}>
            <path className="chart-grid-line" d={`M 0 ${height} L ${width} ${height}`} />
            <path className="chart-grid-line" d={`M 0 ${height / 2} L ${width} ${height / 2}`} />
            <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {lastPoint ? (
              <circle
                cx={visiblePoints.length === 1 ? width / 2 : width}
                cy={height - ((lastPoint.value - min) / range) * height}
                r="4"
                fill={stroke}
              />
            ) : null}
          </svg>
        )}
      </div>

      <div className="chart-meta-row">
        <small>Último: {lastPoint ? `${lastPoint.label} · ${formatDuration(lastPoint.value)}` : '-'}</small>
        <small>
          Rango: {formatDuration(min)} - {formatDuration(max)}
        </small>
      </div>
    </article>
  );
}

function AuditPayloadBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;

  return (
    <details className="audit-payload-block">
      <summary>{title}</summary>
      <pre>{formatAuditPayload(value)}</pre>
    </details>
  );
}

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '');
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  const [loginEmail, setLoginEmail] = useState('superadmin@foodflow.local');
  const [loginPassword, setLoginPassword] = useState('ChangeMe123!');

  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [branches, setBranches] = useState<AdminBranch[]>([]);

  const [tenantForm, setTenantForm] = useState<CreateTenantPayload>(initialTenantForm);
  const [branchForm, setBranchForm] = useState<Omit<CreateBranchPayload, 'tenant_id'>>(initialBranchForm);

  const [subscriptionStatus, setSubscriptionStatus] = useState<TenantSubscriptionStatus>('ACTIVE');
  const [subscriptionReason, setSubscriptionReason] = useState('');

  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [brandingPrimaryColor, setBrandingPrimaryColor] = useState('');
  const [brandingSecondaryColor, setBrandingSecondaryColor] = useState('');
  const [branchActionReason, setBranchActionReason] = useState('');

  const [activeMainTab, setActiveMainTab] = useState<MainTab>('tenants');
  const [activeTenantOpsTab, setActiveTenantOpsTab] = useState<TenantOpsTab>('subscription');
  const [activeAccessOpsTab, setActiveAccessOpsTab] = useState<AccessOpsTab>('hierarchy');
  const [activeMonitorOpsTab, setActiveMonitorOpsTab] = useState<MonitorOpsTab>('audit');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [rolePermissions, setRolePermissions] = useState<AdminRolePermission[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [sessionLogs, setSessionLogs] = useState<AdminSessionLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [branchesByTenant, setBranchesByTenant] = useState<Record<string, AdminBranch[]>>({});
  const [observabilitySnapshot, setObservabilitySnapshot] = useState<AdminObservabilitySnapshot | null>(null);

  const [accessSearchText, setAccessSearchText] = useState('');
  const [accessTenantFilter, setAccessTenantFilter] = useState('');
  const [accessRoleFilter, setAccessRoleFilter] = useState<'ALL' | AdminGlobalRole>('ALL');
  const [sessionTenantFilter, setSessionTenantFilter] = useState('');
  const [sessionRoleFilter, setSessionRoleFilter] = useState<'ALL' | AdminGlobalRole>('ALL');
  const [sessionActionFilter, setSessionActionFilter] = useState('');
  const [sessionSearchText, setSessionSearchText] = useState('');
  const [sessionOffset, setSessionOffset] = useState(0);
  const [sessionPageInfo, setSessionPageInfo] = useState<PageInfo | null>(null);
  const [auditTenantFilter, setAuditTenantFilter] = useState('');
  const [auditActorSearch, setAuditActorSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState<'ALL' | AuditEntityOption>('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearchText, setAuditSearchText] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditPageInfo, setAuditPageInfo] = useState<PageInfo | null>(null);
  const [monitorRefreshKey, setMonitorRefreshKey] = useState(0);

  const [createUserForm, setCreateUserForm] = useState(initialCreateUserForm);
  const [managedUserId, setManagedUserId] = useState('');
  const [managedRole, setManagedRole] = useState<AdminGlobalRole>('OWNER');
  const [managedTenantId, setManagedTenantId] = useState('');
  const [managedBranchId, setManagedBranchId] = useState('');
  const [managedUserIsActive, setManagedUserIsActive] = useState(true);

  const [passwordResetUserId, setPasswordResetUserId] = useState('');
  const [passwordResetValue, setPasswordResetValue] = useState('ChangeMe123!');
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isMonitorLoading, setIsMonitorLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  const selectedManagedUser = useMemo(
    () => adminUsers.find((user) => user.id === managedUserId) ?? null,
    [adminUsers, managedUserId],
  );

  const createUserBranchOptions = useMemo(
    () => (createUserForm.tenant_id ? branchesByTenant[createUserForm.tenant_id] ?? [] : []),
    [branchesByTenant, createUserForm.tenant_id],
  );

  const managedUserBranchOptions = useMemo(
    () => (managedTenantId ? branchesByTenant[managedTenantId] ?? [] : []),
    [branchesByTenant, managedTenantId],
  );

  const orderedRolePermissions = useMemo(
    () => [...rolePermissions].sort((left, right) => right.hierarchy_level - left.hierarchy_level),
    [rolePermissions],
  );

  const sessionPageLimit = sessionPageInfo?.limit ?? SESSION_LOG_PAGE_SIZE;
  const sessionRangeStart = sessionPageInfo && sessionLogs.length > 0 ? (sessionPageInfo.offset ?? 0) + 1 : 0;
  const sessionRangeEnd = sessionPageInfo ? (sessionPageInfo.offset ?? 0) + sessionLogs.length : 0;
  const auditPageLimit = auditPageInfo?.limit ?? AUDIT_LOG_PAGE_SIZE;
  const auditRangeStart = auditPageInfo && auditLogs.length > 0 ? (auditPageInfo.offset ?? 0) + 1 : 0;
  const auditRangeEnd = auditPageInfo ? (auditPageInfo.offset ?? 0) + auditLogs.length : 0;

  const tenantStats = useMemo(() => {
    const stats = {
      total: tenants.length,
      active: 0,
      suspended: 0,
      canceled: 0,
    };

    for (const tenant of tenants) {
      if (tenant.subscription_status === 'ACTIVE') stats.active += 1;
      if (tenant.subscription_status === 'SUSPENDED') stats.suspended += 1;
      if (tenant.subscription_status === 'CANCELED') stats.canceled += 1;
    }

    return stats;
  }, [tenants]);

  async function reloadTenantBranches(currentToken: string, tenantId: string): Promise<void> {
    const tenantBranches = await fetchTenantBranches(currentToken, tenantId);
    setBranches(tenantBranches);
    setBranchesByTenant((prev) => ({
      ...prev,
      [tenantId]: tenantBranches,
    }));
  }

  async function reloadTenants(preferredTenantId?: string): Promise<void> {
    if (!token) return;

    const list = await fetchAdminTenants(token);
    setTenants(list);

    const candidateTenantId =
      (preferredTenantId && list.some((tenant) => tenant.id === preferredTenantId) && preferredTenantId) ||
      (selectedTenantId && list.some((tenant) => tenant.id === selectedTenantId) && selectedTenantId) ||
      list[0]?.id ||
      null;

    setSelectedTenantId(candidateTenantId);
  }

  async function ensureTenantBranchesCached(currentToken: string, tenantId: string): Promise<AdminBranch[]> {
    const cached = branchesByTenant[tenantId];
    if (cached) {
      return cached;
    }

    const tenantBranches = await fetchTenantBranches(currentToken, tenantId);
    setBranchesByTenant((prev) => ({
      ...prev,
      [tenantId]: tenantBranches,
    }));

    return tenantBranches;
  }

  async function reloadAccessControlData(currentToken: string): Promise<void> {
    const userFilter = compactObject({
      search: toOptional(accessSearchText),
      tenant_id: toOptional(accessTenantFilter),
      role: accessRoleFilter === 'ALL' ? undefined : accessRoleFilter,
    });

    const sessionFilter = compactObject({
      tenant_id: toOptional(sessionTenantFilter),
      role: sessionRoleFilter === 'ALL' ? undefined : sessionRoleFilter,
      action: toOptional(sessionActionFilter),
      search: toOptional(sessionSearchText),
    });

    const [permissions, users, logsPage] = await Promise.all([
      fetchAdminRolePermissions(currentToken),
      fetchAdminUsers(currentToken, userFilter),
      fetchAdminSessionLogsPage(currentToken, {
        limit: SESSION_LOG_PAGE_SIZE,
        offset: sessionOffset,
        filter: sessionFilter,
      }),
    ]);

    setRolePermissions(permissions);
    setAdminUsers(users);
    setSessionLogs(logsPage.items);
    setSessionPageInfo(logsPage.pageInfo);
  }

  async function reloadAuditLogData(currentToken: string): Promise<void> {
    const filter = compactObject({
      tenant_id: toOptional(auditTenantFilter),
      actor_search: toOptional(auditActorSearch),
      entity: auditEntityFilter === 'ALL' ? undefined : auditEntityFilter,
      action: toOptional(auditActionFilter),
      search: toOptional(auditSearchText),
      from: toIsoDateTimeOrUndefined(auditFrom),
      to: toIsoDateTimeOrUndefined(auditTo),
    });

    const page = await fetchAdminAuditLogsPage(currentToken, {
      limit: AUDIT_LOG_PAGE_SIZE,
      offset: auditOffset,
      filter,
    });

    setAuditLogs(page.items);
    setAuditPageInfo(page.pageInfo);
  }

  async function reloadObservabilityData(currentToken: string): Promise<void> {
    const snapshot = await fetchAdminObservabilitySnapshot(currentToken);
    setObservabilitySnapshot(snapshot);
  }

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setTenants([]);
      setSelectedTenantId(null);
      setBranches([]);
      setRolePermissions([]);
      setAdminUsers([]);
      setSessionLogs([]);
      setAuditLogs([]);
      setSessionPageInfo(null);
      setAuditPageInfo(null);
      setBranchesByTenant({});
      setObservabilitySnapshot(null);
      setManagedUserId('');
      setPasswordResetUserId('');
      setSessionOffset(0);
      setAuditOffset(0);
      return;
    }

    let ignore = false;

    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const me = await fetchMe(token);
        if (!me) {
          throw new Error('Tu sesión no es válida.');
        }

        if (me.role !== 'superadmin') {
          throw new Error('Tu usuario no tiene rol superadmin.');
        }

        if (ignore) return;
        setCurrentUser(me);
        await reloadTenants();
      } catch (error) {
        if (ignore) return;

        const message = error instanceof Error ? error.message : 'No se pudo cargar el panel';
        setErrorMessage(message);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedTenant) return;

    setSubscriptionStatus(selectedTenant.subscription_status);
    setBrandingLogoUrl(selectedTenant.logo_url ?? '');

    const primary = selectedTenant.palette_css.find((entry) => entry.key === '--accent-primary');
    const secondary = selectedTenant.palette_css.find((entry) => entry.key === '--accent-secondary');

    setBrandingPrimaryColor(primary?.value ?? '');
    setBrandingSecondaryColor(secondary?.value ?? '');
  }, [selectedTenant]);

  useEffect(() => {
    if (!token || !selectedTenantId) {
      setBranches([]);
      return;
    }

    const tenantId = selectedTenantId;
    let ignore = false;
    setBranches([]);

    async function loadBranchesForTenant() {
      try {
        const tenantBranches = await fetchTenantBranches(token, tenantId);
        if (!ignore) {
          setBranches(tenantBranches);
          setBranchesByTenant((prev) => ({
            ...prev,
            [tenantId]: tenantBranches,
          }));
        }
      } catch (error) {
        if (ignore) return;
        const message =
          error instanceof Error ? error.message : 'No se pudieron cargar las sucursales del tenant seleccionado';
        setErrorMessage(message);
      }
    }

    void loadBranchesForTenant();

    return () => {
      ignore = true;
    };
  }, [token, selectedTenantId]);

  useEffect(() => {
    if (!token || activeMainTab !== 'access-control') return;

    let ignore = false;

    async function loadAccessControl() {
      setIsAccessLoading(true);

      try {
        await reloadAccessControlData(token);
      } catch (error) {
        if (ignore) return;
        const message = error instanceof Error ? error.message : 'No se pudo cargar el módulo de acceso y roles';
        setErrorMessage(message);
      } finally {
        if (!ignore) {
          setIsAccessLoading(false);
        }
      }
    }

    void loadAccessControl();

    return () => {
      ignore = true;
    };
  }, [
    token,
    activeMainTab,
    accessSearchText,
    accessTenantFilter,
    accessRoleFilter,
    sessionTenantFilter,
    sessionRoleFilter,
    sessionActionFilter,
    sessionSearchText,
    sessionOffset,
  ]);

  useEffect(() => {
    setSessionOffset(0);
  }, [sessionTenantFilter, sessionRoleFilter, sessionActionFilter, sessionSearchText]);

  useEffect(() => {
    if (!token || activeMainTab !== 'system-monitor' || activeMonitorOpsTab !== 'audit') return;

    let ignore = false;

    async function loadAuditLogs() {
      setIsAuditLoading(true);

      try {
        await reloadAuditLogData(token);
      } catch (error) {
        if (ignore) return;
        const message = error instanceof Error ? error.message : 'No se pudo cargar la auditoría del sistema';
        setErrorMessage(message);
      } finally {
        if (!ignore) {
          setIsAuditLoading(false);
        }
      }
    }

    void loadAuditLogs();

    return () => {
      ignore = true;
    };
  }, [
    token,
    activeMainTab,
    activeMonitorOpsTab,
    auditTenantFilter,
    auditActorSearch,
    auditEntityFilter,
    auditActionFilter,
    auditSearchText,
    auditFrom,
    auditTo,
    auditOffset,
    monitorRefreshKey,
  ]);

  useEffect(() => {
    if (!token || activeMainTab !== 'system-monitor') return;

    let ignore = false;
    let firstLoad = true;

    async function loadObservability(showLoading: boolean) {
      if (showLoading) {
        setIsMonitorLoading(true);
      }

      try {
        await reloadObservabilityData(token);
      } catch (error) {
        if (ignore) return;
        const message = error instanceof Error ? error.message : 'No se pudo cargar la telemetría del sistema';
        setErrorMessage(message);
      } finally {
        if (!ignore && showLoading) {
          setIsMonitorLoading(false);
        }
      }
    }

    void loadObservability(firstLoad);
    firstLoad = false;

    const intervalId = window.setInterval(() => {
      void loadObservability(false);
    }, MONITOR_POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [token, activeMainTab, monitorRefreshKey]);

  useEffect(() => {
    setAuditOffset(0);
  }, [auditTenantFilter, auditActorSearch, auditEntityFilter, auditActionFilter, auditSearchText, auditFrom, auditTo]);

  useEffect(() => {
    if (!token || !createUserForm.tenant_id) return;

    void ensureTenantBranchesCached(token, createUserForm.tenant_id).catch((error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar sucursales para crear usuario';
      setErrorMessage(message);
    });
  }, [token, createUserForm.tenant_id]);

  useEffect(() => {
    if (!token || !managedTenantId) return;

    void ensureTenantBranchesCached(token, managedTenantId).catch((error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar sucursales para actualizar usuario';
      setErrorMessage(message);
    });
  }, [token, managedTenantId]);

  useEffect(() => {
    if (!selectedManagedUser) return;

    setManagedRole(selectedManagedUser.role ?? 'OWNER');
    setManagedTenantId(selectedManagedUser.tenant_id ?? '');
    setManagedBranchId(selectedManagedUser.branch_id ?? '');
    setManagedUserIsActive(selectedManagedUser.is_active);
  }, [selectedManagedUser]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileDrawerOpen]);

  function handleMainTabChange(tab: MainTab) {
    setActiveMainTab(tab);
    setIsMobileDrawerOpen(false);
  }

  function handleSetAuditWindow(hours: number) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    setAuditFrom(toDateTimeLocalInputValue(start));
    setAuditTo(toDateTimeLocalInputValue(end));
  }

  function handleClearAuditWindow() {
    setAuditFrom('');
    setAuditTo('');
  }

  function handleRefreshMonitor() {
    setMonitorRefreshKey((current) => current + 1);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload = await loginAdmin(loginEmail.trim(), loginPassword);
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setCurrentUser(payload.user);
      setStatusMessage('Sesión iniciada en panel SuperAdmin');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setCurrentUser(null);
    setActiveMainTab('tenants');
    setActiveTenantOpsTab('subscription');
    setActiveAccessOpsTab('hierarchy');
    setActiveMonitorOpsTab('audit');
    setCreateUserForm(initialCreateUserForm);
    setManagedUserId('');
    setPasswordResetUserId('');
    setAccessSearchText('');
    setAccessTenantFilter('');
    setAccessRoleFilter('ALL');
    setSessionTenantFilter('');
    setSessionRoleFilter('ALL');
    setSessionActionFilter('');
    setSessionSearchText('');
    setSessionOffset(0);
    setSessionPageInfo(null);
    setAuditTenantFilter('');
    setAuditActorSearch('');
    setAuditEntityFilter('ALL');
    setAuditActionFilter('');
    setAuditSearchText('');
    setAuditFrom('');
    setAuditTo('');
    setAuditOffset(0);
    setAuditPageInfo(null);
    setAuditLogs([]);
    setObservabilitySnapshot(null);
    setIsMobileDrawerOpen(false);
    setStatusMessage('Sesión cerrada');
    setErrorMessage(null);
  }

  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const created = await createTenant(token, {
        nombre_comercial: tenantForm.nombre_comercial,
        email_admin: tenantForm.email_admin,
        razon_social: toOptional(tenantForm.razon_social),
        rfc_tax_id: toOptional(tenantForm.rfc_tax_id),
        telefono_contacto: toOptional(tenantForm.telefono_contacto),
        logo_url: toOptional(tenantForm.logo_url),
        moneda: toOptional(tenantForm.moneda),
        region_code: toOptional(tenantForm.region_code),
        time_zone: toOptional(tenantForm.time_zone),
      });

      setTenantForm(initialTenantForm);
      setStatusMessage(`Tenant creado: ${created.nombre_comercial}`);
      await reloadTenants(created.id);
      handleMainTabChange('manage-tenant');
      setActiveTenantOpsTab('subscription');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el tenant';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTenant) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await updateTenantSubscription(token, selectedTenant.id, subscriptionStatus, toOptional(subscriptionReason));
      setSubscriptionReason('');
      setStatusMessage('Estado de suscripción actualizado');
      await reloadTenants(selectedTenant.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la suscripción';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTenant) return;

    const paletteEntries = [
      brandingPrimaryColor.trim() ? { key: '--accent-primary', value: brandingPrimaryColor.trim() } : null,
      brandingSecondaryColor.trim() ? { key: '--accent-secondary', value: brandingSecondaryColor.trim() } : null,
    ].filter((entry): entry is { key: string; value: string } => Boolean(entry));

    const input: UpdateBrandingPayload = {
      logo_url: brandingLogoUrl.trim() ? brandingLogoUrl.trim() : null,
      ...(paletteEntries.length > 0 ? { palette_css: paletteEntries } : {}),
    };

    if (input.logo_url === undefined && input.palette_css === undefined) {
      setErrorMessage('Debes definir logo_url o una variable de color para branding');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await updateTenantBranding(token, selectedTenant.id, input);
      setStatusMessage('Branding actualizado');
      await reloadTenants(selectedTenant.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el branding';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTenant) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await createBranch(token, {
        tenant_id: selectedTenant.id,
        nombre_sucursal: branchForm.nombre_sucursal,
        direccion_fisica: toOptional(branchForm.direccion_fisica),
        horario_apertura: toOptional(branchForm.horario_apertura),
        horario_cierre: toOptional(branchForm.horario_cierre),
      });

      setBranchForm(initialBranchForm);
      setStatusMessage('Sucursal creada');
      await reloadTenantBranches(token, selectedTenant.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la sucursal';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleBranchSuspension(branch: AdminBranch) {
    if (!token || !selectedTenant) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await setBranchSuspended(token, branch.id, !branch.is_suspended, toOptional(branchActionReason));
      setBranchActionReason('');
      setStatusMessage(branch.is_suspended ? 'Sucursal reactivada' : 'Sucursal suspendida');
      await reloadTenantBranches(token, selectedTenant.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la sucursal';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload: CreateAdminUserPayload = {
        nombre: createUserForm.nombre.trim(),
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        role: createUserForm.role,
        is_active: createUserForm.is_active,
      };

      if (createUserForm.role !== 'SUPERADMIN') {
        const tenantId = toOptional(createUserForm.tenant_id);
        if (!tenantId) {
          throw new Error('Debes seleccionar un tenant para este rol.');
        }

        payload.tenant_id = tenantId;
        payload.branch_id = toOptional(createUserForm.branch_id);

        if ((createUserForm.role === 'KITCHEN' || createUserForm.role === 'DELIVERY') && !payload.branch_id) {
          throw new Error('Kitchen y Delivery requieren una sucursal asignada.');
        }
      }

      const created = await createAdminUser(token, payload);
      setCreateUserForm(initialCreateUserForm);
      setManagedUserId(created.id);
      setPasswordResetUserId(created.id);
      setStatusMessage(`Usuario creado: ${created.email}`);
      await reloadAccessControlData(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el usuario';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectManagedUser(userId: string) {
    setManagedUserId(userId);
    setPasswordResetUserId((current) => current || userId);
  }

  async function handleUpdateManagedUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !managedUserId) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload: UpdateAdminUserAssignmentPayload = {
        user_id: managedUserId,
        role: managedRole,
        is_active: managedUserIsActive,
      };

      if (managedRole === 'SUPERADMIN') {
        payload.tenant_id = null;
        payload.branch_id = null;
      } else {
        const tenantId = toOptional(managedTenantId);
        if (!tenantId) {
          throw new Error('Debes seleccionar un tenant para este rol.');
        }

        payload.tenant_id = tenantId;
        payload.branch_id = toOptionalNullable(managedBranchId);

        if ((managedRole === 'KITCHEN' || managedRole === 'DELIVERY') && !payload.branch_id) {
          throw new Error('Kitchen y Delivery requieren sucursal asignada.');
        }
      }

      await updateAdminUserAssignment(token, payload);
      setStatusMessage('Asignación de usuario actualizada');
      await reloadAccessControlData(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la asignación del usuario';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetManagedUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !passwordResetUserId) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await resetAdminUserPassword(token, passwordResetUserId, passwordResetValue);
      setStatusMessage('Contraseña reseteada correctamente');
      await reloadAccessControlData(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo resetear la contraseña';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="admin-auth">
        <section className="card auth-card">
          <h1>FoodFlow SuperAdmin</h1>
          <p>Acceso exclusivo para operación multi-tenant.</p>

          <form className="form" onSubmit={handleLogin}>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </label>

            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {errorMessage ? <p className="status status-error">{errorMessage}</p> : null}
          {statusMessage ? <p className="status">{statusMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <div className={isMobileDrawerOpen ? 'admin-frame admin-frame-drawer-open' : 'admin-frame'}>
        <aside className="card sidebar" aria-label="Navegación principal">
          <div className="sidebar-head">
            <div className="sidebar-brand">
              <strong>SuperAdmin</strong>
              <small>FoodFlow Control</small>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Secciones principales del panel">
            <button
              type="button"
              className={activeMainTab === 'tenants' ? 'sidebar-item sidebar-item-active' : 'sidebar-item'}
              onClick={() => handleMainTabChange('tenants')}
              title="Tenants"
            >
              <span className="sidebar-icon">
                <IconTenants />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">Tenants</span>
                <small className="sidebar-item-meta">{tenantStats.total} registrados</small>
              </span>
            </button>

            <button
              type="button"
              className={activeMainTab === 'create-tenant' ? 'sidebar-item sidebar-item-active' : 'sidebar-item'}
              onClick={() => handleMainTabChange('create-tenant')}
              title="Registrar negocio"
            >
              <span className="sidebar-icon">
                <IconCreateTenant />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">Registrar negocio</span>
                <small className="sidebar-item-meta">Alta de nuevos tenants</small>
              </span>
            </button>

            <button
              type="button"
              className={activeMainTab === 'manage-tenant' ? 'sidebar-item sidebar-item-active' : 'sidebar-item'}
              onClick={() => handleMainTabChange('manage-tenant')}
              title="Operación de tenant"
            >
              <span className="sidebar-icon">
                <IconOperations />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">Operación de tenant</span>
                <small className="sidebar-item-meta">
                  {selectedTenant ? selectedTenant.nombre_comercial : 'Selecciona un tenant'}
                </small>
              </span>
            </button>

            <button
              type="button"
              className={activeMainTab === 'access-control' ? 'sidebar-item sidebar-item-active' : 'sidebar-item'}
              onClick={() => handleMainTabChange('access-control')}
              title="Accesos y roles"
            >
              <span className="sidebar-icon">
                <IconAccess />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">Accesos y roles</span>
                <small className="sidebar-item-meta">RBAC global, usuarios y auditoría</small>
              </span>
            </button>

            <button
              type="button"
              className={activeMainTab === 'system-monitor' ? 'sidebar-item sidebar-item-active' : 'sidebar-item'}
              onClick={() => handleMainTabChange('system-monitor')}
              title="Salud y auditoría"
            >
              <span className="sidebar-icon">
                <IconSystemMonitor />
              </span>
              <span className="sidebar-item-copy">
                <span className="sidebar-item-label">Salud y auditoría</span>
                <small className="sidebar-item-meta">
                  {observabilitySnapshot
                    ? observabilitySnapshot.health.status === 'ok'
                      ? 'Backend estable'
                      : 'Backend degradado'
                    : 'Telemetría y movimientos críticos'}
                </small>
              </span>
            </button>
          </nav>
        </aside>

        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-label="Cerrar menú lateral"
        />

        <section className="admin-content">
          <header className="topbar card">
            <div className="topbar-main">
              <button
                className="icon-button menu-button"
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Abrir menú lateral"
                aria-expanded={isMobileDrawerOpen}
              >
                <IconMenu />
              </button>

              <div>
                <h1>Panel SuperAdmin</h1>
                <p>Gestión centralizada de tenants, branding, sucursales y suscripción.</p>
              </div>
            </div>

            <div className="topbar-actions">
              <span>
                {currentUser?.email ?? 'usuario'} · {currentUser?.role ?? 'sin rol'}
              </span>
              <button className="button" onClick={handleLogout} type="button">
                Cerrar sesión
              </button>
            </div>
          </header>

          {isLoading ? <p className="status">Cargando panel...</p> : null}
          {statusMessage ? <p className="status">{statusMessage}</p> : null}
          {errorMessage ? <p className="status status-error">{errorMessage}</p> : null}

          {activeMainTab === 'tenants' ? (
            <section className="panel-grid tenants-panel">
              <article className="card stack">
                <h2>Tenants</h2>

                <div className="kpi-grid">
                  <div className="kpi-card">
                    <strong>{tenantStats.total}</strong>
                    <small>Total</small>
                  </div>
                  <div className="kpi-card kpi-card-success">
                    <strong>{tenantStats.active}</strong>
                    <small>Activos</small>
                  </div>
                  <div className="kpi-card">
                    <strong>{tenantStats.suspended}</strong>
                    <small>Suspendidos</small>
                  </div>
                  <div className="kpi-card">
                    <strong>{tenantStats.canceled}</strong>
                    <small>Cancelados</small>
                  </div>
                </div>

                {tenants.length === 0 ? <p className="muted">Sin tenants registrados.</p> : null}

                <ul className="tenant-list tenant-list-scroll">
                  {tenants.map((tenant) => (
                    <li
                      key={tenant.id}
                      className={tenant.id === selectedTenantId ? 'tenant-item tenant-item-active' : 'tenant-item'}
                    >
                      <button type="button" className="tenant-select" onClick={() => setSelectedTenantId(tenant.id)}>
                        <strong>{tenant.nombre_comercial}</strong>
                        <span>{tenant.email_admin}</span>
                        <small>
                          {tenant.subscription_status} · {tenant.moneda ?? '-'} · {tenant.time_zone ?? '-'}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="card stack">
                <h2>Tenant seleccionado</h2>

                {!selectedTenant ? <p className="muted">Selecciona un tenant para revisar su detalle.</p> : null}

                {selectedTenant ? (
                  <>
                    <div className="meta-grid">
                      <p>
                        <strong>Negocio:</strong> {selectedTenant.nombre_comercial}
                      </p>
                      <p>
                        <strong>Admin:</strong> {selectedTenant.email_admin}
                      </p>
                      <p>
                        <strong>Moneda:</strong> {selectedTenant.moneda ?? '-'}
                      </p>
                      <p>
                        <strong>Región:</strong> {selectedTenant.region_code ?? '-'}
                      </p>
                      <p>
                        <strong>Zona horaria:</strong> {selectedTenant.time_zone ?? '-'}
                      </p>
                      <p>
                        <strong>Últ. actualización:</strong> {formatDate(selectedTenant.updated_at)}
                      </p>
                    </div>

                    <div className="inline-actions">
                      <button className="button button-primary" type="button" onClick={() => handleMainTabChange('manage-tenant')}>
                        Abrir operación de tenant
                      </button>
                      <button className="button" type="button" onClick={() => handleMainTabChange('create-tenant')}>
                        Registrar nuevo negocio
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            </section>
          ) : null}

          {activeMainTab === 'create-tenant' ? (
            <section className="panel-grid create-panel">
              <article className="card">
                <h2>Registrar negocio</h2>
                <form className="form" onSubmit={handleCreateTenant}>
                  <label className="field">
                    <span>Nombre comercial</span>
                    <input
                      className="input"
                      value={tenantForm.nombre_comercial}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, nombre_comercial: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Email admin</span>
                    <input
                      className="input"
                      type="email"
                      value={tenantForm.email_admin}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, email_admin: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Razón social</span>
                    <input
                      className="input"
                      value={tenantForm.razon_social ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, razon_social: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>RFC / Tax ID</span>
                    <input
                      className="input"
                      value={tenantForm.rfc_tax_id ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, rfc_tax_id: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Teléfono</span>
                    <input
                      className="input"
                      value={tenantForm.telefono_contacto ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, telefono_contacto: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Moneda</span>
                    <input
                      className="input"
                      value={tenantForm.moneda ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, moneda: event.target.value.toUpperCase() }))}
                      placeholder="MXN"
                    />
                  </label>

                  <label className="field">
                    <span>Región</span>
                    <input
                      className="input"
                      value={tenantForm.region_code ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, region_code: event.target.value.toUpperCase() }))}
                      placeholder="MX"
                    />
                  </label>

                  <label className="field">
                    <span>Zona horaria</span>
                    <input
                      className="input"
                      value={tenantForm.time_zone ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, time_zone: event.target.value }))}
                      placeholder="America/Mexico_City"
                    />
                  </label>

                  <label className="field">
                    <span>Logo URL</span>
                    <input
                      className="input"
                      value={tenantForm.logo_url ?? ''}
                      onChange={(event) => setTenantForm((prev) => ({ ...prev, logo_url: event.target.value }))}
                    />
                  </label>

                  <button className="button button-primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Crear tenant'}
                  </button>
                </form>
              </article>

              <aside className="card stack helper-card">
                <h3>Checklist rápida</h3>
                <p className="muted">Antes de crear el tenant, valida estos puntos operativos.</p>
                <ul className="simple-list">
                  <li>Email admin con buzón activo.</li>
                  <li>Región y zona horaria de la operación principal.</li>
                  <li>Moneda alineada a cobros y reportes.</li>
                  <li>Logo y colores listos para white label.</li>
                </ul>

                <button className="button" type="button" onClick={() => handleMainTabChange('tenants')}>
                  Volver a lista de tenants
                </button>
              </aside>
            </section>
          ) : null}

          {activeMainTab === 'manage-tenant' ? (
            <section className="panel-grid manage-panel">
              <article className="card stack">
                <div className="tenant-manage-header">
                  <div>
                    <h2>Operación de tenant</h2>
                    <p className="muted">Administra suscripción, branding y sucursales por separado.</p>
                  </div>

                  <label className="field tenant-picker">
                    <span>Tenant activo</span>
                    <select
                      className="input"
                      value={selectedTenantId ?? ''}
                      onChange={(event) => setSelectedTenantId(event.target.value || null)}
                      disabled={tenants.length === 0}
                    >
                      {tenants.length === 0 ? <option value="">Sin tenants</option> : null}
                      {tenants.length > 0 && !selectedTenantId ? <option value="">Selecciona un tenant</option> : null}
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.nombre_comercial}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {!selectedTenant ? <p className="muted">Selecciona un tenant para habilitar operaciones.</p> : null}

                {selectedTenant ? (
                  <div className="meta-grid">
                    <p>
                      <strong>Negocio:</strong> {selectedTenant.nombre_comercial}
                    </p>
                    <p>
                      <strong>Admin:</strong> {selectedTenant.email_admin}
                    </p>
                    <p>
                      <strong>Moneda:</strong> {selectedTenant.moneda ?? '-'}
                    </p>
                    <p>
                      <strong>Región:</strong> {selectedTenant.region_code ?? '-'}
                    </p>
                    <p>
                      <strong>Zona horaria:</strong> {selectedTenant.time_zone ?? '-'}
                    </p>
                    <p>
                      <strong>Últ. actualización:</strong> {formatDate(selectedTenant.updated_at)}
                    </p>
                  </div>
                ) : null}
              </article>

              {selectedTenant ? (
                <article className="card stack">
                  <nav className="subtabs" aria-label="Operaciones del tenant">
                    <button
                      type="button"
                      className={activeTenantOpsTab === 'subscription' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                      onClick={() => setActiveTenantOpsTab('subscription')}
                    >
                      Suscripción
                    </button>
                    <button
                      type="button"
                      className={activeTenantOpsTab === 'branding' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                      onClick={() => setActiveTenantOpsTab('branding')}
                    >
                      Branding
                    </button>
                    <button
                      type="button"
                      className={activeTenantOpsTab === 'branches' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                      onClick={() => setActiveTenantOpsTab('branches')}
                    >
                      Sucursales
                    </button>
                  </nav>

                  {activeTenantOpsTab === 'subscription' ? (
                    <form className="form boxed" onSubmit={handleUpdateSubscription}>
                      <h3>Estado de suscripción</h3>

                      <label className="field">
                        <span>Status</span>
                        <select
                          className="input"
                          value={subscriptionStatus}
                          onChange={(event) => setSubscriptionStatus(event.target.value as TenantSubscriptionStatus)}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                          <option value="CANCELED">CANCELED</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Motivo (opcional)</span>
                        <input
                          className="input"
                          value={subscriptionReason}
                          onChange={(event) => setSubscriptionReason(event.target.value)}
                        />
                      </label>

                      <button className="button" type="submit" disabled={isSubmitting}>
                        Actualizar suscripción
                      </button>
                    </form>
                  ) : null}

                  {activeTenantOpsTab === 'branding' ? (
                    <form className="form boxed" onSubmit={handleUpdateBranding}>
                      <h3>Branding (white label)</h3>

                      <label className="field">
                        <span>Logo URL</span>
                        <input
                          className="input"
                          value={brandingLogoUrl}
                          onChange={(event) => setBrandingLogoUrl(event.target.value)}
                        />
                      </label>

                      <label className="field">
                        <span>Color primario (--accent-primary)</span>
                        <input
                          className="input"
                          value={brandingPrimaryColor}
                          onChange={(event) => setBrandingPrimaryColor(event.target.value)}
                          placeholder="#ff7a00"
                        />
                      </label>

                      <label className="field">
                        <span>Color secundario (--accent-secondary)</span>
                        <input
                          className="input"
                          value={brandingSecondaryColor}
                          onChange={(event) => setBrandingSecondaryColor(event.target.value)}
                          placeholder="#66b2ff"
                        />
                      </label>

                      <div className="palette-preview" aria-hidden="true">
                        <span style={{ backgroundColor: brandingPrimaryColor || 'var(--accent-primary)' }} />
                        <span style={{ backgroundColor: brandingSecondaryColor || 'var(--accent-secondary)' }} />
                      </div>

                      <button className="button" type="submit" disabled={isSubmitting}>
                        Guardar branding
                      </button>
                    </form>
                  ) : null}

                  {activeTenantOpsTab === 'branches' ? (
                    <div className="branch-operations">
                      <form className="form boxed" onSubmit={handleCreateBranch}>
                        <h3>Crear sucursal</h3>

                        <label className="field">
                          <span>Nombre</span>
                          <input
                            className="input"
                            value={branchForm.nombre_sucursal}
                            onChange={(event) =>
                              setBranchForm((prev) => ({ ...prev, nombre_sucursal: event.target.value }))
                            }
                            required
                          />
                        </label>

                        <label className="field">
                          <span>Dirección</span>
                          <input
                            className="input"
                            value={branchForm.direccion_fisica ?? ''}
                            onChange={(event) =>
                              setBranchForm((prev) => ({ ...prev, direccion_fisica: event.target.value }))
                            }
                          />
                        </label>

                        <div className="grid-two">
                          <label className="field">
                            <span>Apertura (HH:mm)</span>
                            <input
                              className="input"
                              value={branchForm.horario_apertura ?? ''}
                              onChange={(event) =>
                                setBranchForm((prev) => ({ ...prev, horario_apertura: event.target.value }))
                              }
                              placeholder="08:00"
                            />
                          </label>

                          <label className="field">
                            <span>Cierre (HH:mm)</span>
                            <input
                              className="input"
                              value={branchForm.horario_cierre ?? ''}
                              onChange={(event) =>
                                setBranchForm((prev) => ({ ...prev, horario_cierre: event.target.value }))
                              }
                              placeholder="22:00"
                            />
                          </label>
                        </div>

                        <button className="button" type="submit" disabled={isSubmitting}>
                          Crear sucursal
                        </button>
                      </form>

                      <div className="boxed stack">
                        <h3>Sucursales</h3>

                        <label className="field">
                          <span>Motivo de suspensión/reactivación</span>
                          <input
                            className="input"
                            value={branchActionReason}
                            onChange={(event) => setBranchActionReason(event.target.value)}
                          />
                        </label>

                        {branches.length === 0 ? <p className="muted">Sin sucursales registradas para este tenant.</p> : null}

                        <ul className="branch-list">
                          {branches.map((branch) => (
                            <li key={branch.id} className="branch-item">
                              <div>
                                <strong>{branch.nombre_sucursal}</strong>
                                <p>{branch.direccion_fisica ?? '-'}</p>
                                <small>
                                  {branch.is_suspended ? 'SUSPENDIDA' : 'ACTIVA'} · {branch.suspension_reason ?? 'sin motivo'}
                                </small>
                              </div>

                              <button
                                className="button"
                                type="button"
                                onClick={() => void handleToggleBranchSuspension(branch)}
                                disabled={isSubmitting}
                              >
                                {branch.is_suspended ? 'Reactivar' : 'Suspender'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </section>
          ) : null}

          {activeMainTab === 'access-control' ? (
            <section className="panel-grid access-panel">
              <article className="card stack">
                <div className="tenant-manage-header">
                  <div>
                    <h2>Control de Acceso y Roles (RBAC Global)</h2>
                    <p className="muted">
                      Jerarquía por rol, gestión de credenciales y trazabilidad de accesos con IP y último login.
                    </p>
                  </div>
                </div>

                <nav className="subtabs" aria-label="Control de acceso y roles">
                  <button
                    type="button"
                    className={activeAccessOpsTab === 'hierarchy' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                    onClick={() => setActiveAccessOpsTab('hierarchy')}
                  >
                    Jerarquía RBAC
                  </button>
                  <button
                    type="button"
                    className={activeAccessOpsTab === 'users' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                    onClick={() => setActiveAccessOpsTab('users')}
                  >
                    Gestión de usuarios
                  </button>
                  <button
                    type="button"
                    className={activeAccessOpsTab === 'sessions' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                    onClick={() => setActiveAccessOpsTab('sessions')}
                  >
                    Logs de sesión
                  </button>
                </nav>

                {isAccessLoading ? <p className="status">Cargando datos de acceso y roles...</p> : null}

                {activeAccessOpsTab === 'hierarchy' ? (
                  <div className="rbac-role-grid">
                    {orderedRolePermissions.length === 0 ? (
                      <p className="muted">No hay roles disponibles para mostrar.</p>
                    ) : null}

                    {orderedRolePermissions.map((entry) => (
                      <article key={entry.role} className="boxed stack rbac-role-card">
                        <div className="rbac-role-head">
                          <strong>{entry.label}</strong>
                          <small>Nivel {entry.hierarchy_level}</small>
                        </div>

                        <p className="muted">
                          <strong>Alcance:</strong> {entry.scope}
                        </p>

                        <ul className="simple-list">
                          {entry.permissions.map((permission) => (
                            <li key={`${entry.role}-${permission}`}>{permission}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : null}

                {activeAccessOpsTab === 'users' ? (
                  <>
                    <div className="grid-two access-filter-grid">
                      <label className="field">
                        <span>Buscar usuario</span>
                        <input
                          className="input"
                          value={accessSearchText}
                          onChange={(event) => setAccessSearchText(event.target.value)}
                          placeholder="Nombre o email"
                        />
                      </label>

                      <label className="field">
                        <span>Filtrar por tenant</span>
                        <select
                          className="input"
                          value={accessTenantFilter}
                          onChange={(event) => setAccessTenantFilter(event.target.value)}
                        >
                          <option value="">Todos los tenants</option>
                          {tenants.map((tenant) => (
                            <option key={`filter-${tenant.id}`} value={tenant.id}>
                              {tenant.nombre_comercial}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Filtrar por rol</span>
                        <select
                          className="input"
                          value={accessRoleFilter}
                          onChange={(event) => setAccessRoleFilter(event.target.value as 'ALL' | AdminGlobalRole)}
                        >
                          <option value="ALL">Todos</option>
                          {ADMIN_GLOBAL_ROLES.map((role) => (
                            <option key={`role-filter-${role}`} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="access-users-layout">
                      <div className="stack">
                        <form className="form boxed" onSubmit={handleCreateAdminUser}>
                          <h3>Crear credenciales</h3>

                          <label className="field">
                            <span>Nombre</span>
                            <input
                              className="input"
                              value={createUserForm.nombre}
                              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, nombre: event.target.value }))}
                              required
                            />
                          </label>

                          <label className="field">
                            <span>Email</span>
                            <input
                              className="input"
                              type="email"
                              value={createUserForm.email}
                              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, email: event.target.value }))}
                              required
                            />
                          </label>

                          <label className="field">
                            <span>Password inicial</span>
                            <input
                              className="input"
                              type="password"
                              value={createUserForm.password}
                              onChange={(event) => setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))}
                              minLength={STRONG_PASSWORD_MIN_LENGTH}
                              required
                            />
                            <small className="field-hint">
                              Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
                            </small>
                          </label>

                          <label className="field">
                            <span>Rol</span>
                            <select
                              className="input"
                              value={createUserForm.role}
                              onChange={(event) => {
                                const role = event.target.value as AdminGlobalRole;
                                setCreateUserForm((prev) => ({
                                  ...prev,
                                  role,
                                  tenant_id: role === 'SUPERADMIN' ? '' : prev.tenant_id,
                                  branch_id: role === 'SUPERADMIN' ? '' : prev.branch_id,
                                }));
                              }}
                            >
                              {ADMIN_GLOBAL_ROLES.map((role) => (
                                <option key={`create-role-${role}`} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Tenant</span>
                            <select
                              className="input"
                              value={createUserForm.tenant_id}
                              disabled={createUserForm.role === 'SUPERADMIN'}
                              onChange={(event) =>
                                setCreateUserForm((prev) => ({
                                  ...prev,
                                  tenant_id: event.target.value,
                                  branch_id: '',
                                }))
                              }
                            >
                              <option value="">Selecciona tenant</option>
                              {tenants.map((tenant) => (
                                <option key={`create-tenant-${tenant.id}`} value={tenant.id}>
                                  {tenant.nombre_comercial}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Sucursal</span>
                            <select
                              className="input"
                              value={createUserForm.branch_id}
                              disabled={createUserForm.role === 'SUPERADMIN' || !createUserForm.tenant_id}
                              onChange={(event) =>
                                setCreateUserForm((prev) => ({
                                  ...prev,
                                  branch_id: event.target.value,
                                }))
                              }
                            >
                              <option value="">Sin sucursal</option>
                              {createUserBranchOptions.map((branch) => (
                                <option key={`create-branch-${branch.id}`} value={branch.id}>
                                  {branch.nombre_sucursal}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field checkbox-field">
                            <span>Activo</span>
                            <input
                              type="checkbox"
                              checked={createUserForm.is_active}
                              onChange={(event) =>
                                setCreateUserForm((prev) => ({
                                  ...prev,
                                  is_active: event.target.checked,
                                }))
                              }
                            />
                          </label>

                          <button className="button" type="submit" disabled={isSubmitting}>
                            Crear usuario
                          </button>
                        </form>

                        <form className="form boxed" onSubmit={handleUpdateManagedUser}>
                          <h3>Vinculación a sucursal</h3>

                          <label className="field">
                            <span>Usuario</span>
                            <select
                              className="input"
                              value={managedUserId}
                              onChange={(event) => handleSelectManagedUser(event.target.value)}
                              required
                            >
                              <option value="">Selecciona usuario</option>
                              {adminUsers.map((user) => (
                                <option key={`manage-user-${user.id}`} value={user.id}>
                                  {user.email}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Rol</span>
                            <select
                              className="input"
                              value={managedRole}
                              onChange={(event) => {
                                const role = event.target.value as AdminGlobalRole;
                                setManagedRole(role);
                                if (role === 'SUPERADMIN') {
                                  setManagedTenantId('');
                                  setManagedBranchId('');
                                }
                              }}
                            >
                              {ADMIN_GLOBAL_ROLES.map((role) => (
                                <option key={`manage-role-${role}`} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Tenant</span>
                            <select
                              className="input"
                              value={managedTenantId}
                              disabled={managedRole === 'SUPERADMIN'}
                              onChange={(event) => {
                                setManagedTenantId(event.target.value);
                                setManagedBranchId('');
                              }}
                            >
                              <option value="">Selecciona tenant</option>
                              {tenants.map((tenant) => (
                                <option key={`manage-tenant-${tenant.id}`} value={tenant.id}>
                                  {tenant.nombre_comercial}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Sucursal</span>
                            <select
                              className="input"
                              value={managedBranchId}
                              disabled={managedRole === 'SUPERADMIN' || !managedTenantId}
                              onChange={(event) => setManagedBranchId(event.target.value)}
                            >
                              <option value="">Sin sucursal</option>
                              {managedUserBranchOptions.map((branch) => (
                                <option key={`manage-branch-${branch.id}`} value={branch.id}>
                                  {branch.nombre_sucursal}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field checkbox-field">
                            <span>Activo</span>
                            <input
                              type="checkbox"
                              checked={managedUserIsActive}
                              onChange={(event) => setManagedUserIsActive(event.target.checked)}
                            />
                          </label>

                          <button className="button" type="submit" disabled={isSubmitting || !managedUserId}>
                            Guardar asignación
                          </button>
                        </form>

                        <form className="form boxed" onSubmit={handleResetManagedUserPassword}>
                          <h3>Resetear contraseña</h3>

                          <label className="field">
                            <span>Usuario</span>
                            <select
                              className="input"
                              value={passwordResetUserId}
                              onChange={(event) => setPasswordResetUserId(event.target.value)}
                              required
                            >
                              <option value="">Selecciona usuario</option>
                              {adminUsers.map((user) => (
                                <option key={`reset-user-${user.id}`} value={user.id}>
                                  {user.email}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Nueva contraseña</span>
                            <input
                              className="input"
                              type="password"
                              value={passwordResetValue}
                              onChange={(event) => setPasswordResetValue(event.target.value)}
                              minLength={STRONG_PASSWORD_MIN_LENGTH}
                              required
                            />
                            <small className="field-hint">
                              Usa una contraseña fuerte distinta a las anteriores del usuario.
                            </small>
                          </label>

                          <button className="button" type="submit" disabled={isSubmitting || !passwordResetUserId}>
                            Resetear password
                          </button>
                        </form>
                      </div>

                      <div className="boxed stack">
                        <h3>Usuarios registrados</h3>
                        <p className="muted">Selecciona uno para editar su rol, tenant, sucursal y estado.</p>

                        {adminUsers.length === 0 ? <p className="muted">No hay usuarios para los filtros actuales.</p> : null}

                        <ul className="tenant-list rbac-user-list">
                          {adminUsers.map((user) => (
                            <li
                              key={user.id}
                              className={user.id === managedUserId ? 'tenant-item tenant-item-active' : 'tenant-item'}
                            >
                              <button type="button" className="tenant-select" onClick={() => handleSelectManagedUser(user.id)}>
                                <strong>
                                  {user.nombre} · {user.role_label}
                                </strong>
                                <span>{user.email}</span>
                                <small>
                                  {user.tenant_nombre ?? 'Sin tenant'} · {user.branch_nombre ?? 'Sin sucursal'} ·{' '}
                                  {user.is_active ? 'Activo' : 'Inactivo'}
                                </small>
                                <small>Últ. acceso: {formatDate(user.last_login)}</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : null}

                {activeAccessOpsTab === 'sessions' ? (
                  <div className="stack">
                    <div className="grid-two access-filter-grid">
                      <label className="field">
                        <span>Búsqueda</span>
                        <input
                          className="input"
                          value={sessionSearchText}
                          onChange={(event) => setSessionSearchText(event.target.value)}
                          placeholder="Email, nombre, tenant, IP o acción"
                        />
                      </label>

                      <label className="field">
                        <span>Filtrar logs por tenant</span>
                        <select
                          className="input"
                          value={sessionTenantFilter}
                          onChange={(event) => setSessionTenantFilter(event.target.value)}
                        >
                          <option value="">Todos los tenants</option>
                          {tenants.map((tenant) => (
                            <option key={`session-tenant-${tenant.id}`} value={tenant.id}>
                              {tenant.nombre_comercial}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Filtrar por rol</span>
                        <select
                          className="input"
                          value={sessionRoleFilter}
                          onChange={(event) => setSessionRoleFilter(event.target.value as 'ALL' | AdminGlobalRole)}
                        >
                          <option value="ALL">Todos</option>
                          {ADMIN_GLOBAL_ROLES.map((role) => (
                            <option key={`session-role-${role}`} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Acción exacta (opcional)</span>
                        <input
                          className="input"
                          value={sessionActionFilter}
                          onChange={(event) => setSessionActionFilter(event.target.value.toUpperCase())}
                          placeholder="LOGIN_OK, USER_CREATE..."
                        />
                      </label>
                    </div>

                    <div className="boxed stack">
                      <h3>Auditoría de sesión</h3>
                      <p className="muted">Incluye IP de origen y hora de último acceso para trazabilidad de seguridad.</p>

                      <div className="session-pagination-toolbar">
                        <small>
                          {sessionPageInfo
                            ? `Mostrando ${sessionRangeStart}-${sessionRangeEnd} de ${sessionPageInfo.total}`
                            : 'Sin datos'}
                        </small>

                        <div className="session-pagination-actions">
                          <button
                            className="button"
                            type="button"
                            onClick={() => setSessionOffset((prev) => Math.max(prev - sessionPageLimit, 0))}
                            disabled={isAccessLoading || sessionOffset <= 0}
                          >
                            Anterior
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => setSessionOffset((prev) => prev + sessionPageLimit)}
                            disabled={isAccessLoading || !sessionPageInfo?.hasNextPage}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>

                      {sessionLogs.length === 0 ? <p className="muted">Sin eventos de sesión para los filtros actuales.</p> : null}

                      <ul className="session-log-list">
                        {sessionLogs.map((log) => (
                          <li key={log.id} className="session-log-item">
                            <div className="session-log-head">
                              <strong>{log.user_email ?? 'usuario-desconocido'}</strong>
                              <span className="session-action-badge">{log.action}</span>
                            </div>

                            <p>
                              {log.user_nombre ?? 'Sin nombre'} · {log.role ?? 'SIN_ROL'}
                            </p>

                            <small>
                              {log.tenant_nombre ?? 'Sin tenant'} · IP {log.ip_address ?? '-'} · evento{' '}
                              {formatDate(log.happened_at)}
                            </small>
                            <small>Último acceso: {formatDate(log.last_access)}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}

          {activeMainTab === 'system-monitor' ? (
            <section className="panel-grid monitor-panel">
              <article className="card stack">
                <div className="tenant-manage-header">
                  <div>
                    <h2>Monitor de Salud y Auditoría</h2>
                    <p className="muted">
                      Visibilidad en tiempo real del backend, la base de datos y los movimientos críticos de la operación.
                    </p>
                  </div>

                  <div className="monitor-toolbar">
                    <small className="muted">
                      Últ. snapshot: {formatDate(observabilitySnapshot?.checked_at ?? null)}
                    </small>
                    <button className="button" type="button" onClick={handleRefreshMonitor} disabled={isMonitorLoading || isAuditLoading}>
                      {isMonitorLoading ? 'Actualizando...' : 'Actualizar ahora'}
                    </button>
                  </div>
                </div>

                <nav className="subtabs" aria-label="Salud y auditoría del sistema">
                  <button
                    type="button"
                    className={activeMonitorOpsTab === 'audit' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                    onClick={() => setActiveMonitorOpsTab('audit')}
                  >
                    Visor de auditoría
                  </button>
                  <button
                    type="button"
                    className={activeMonitorOpsTab === 'health' ? 'subtab-button subtab-button-active' : 'subtab-button'}
                    onClick={() => setActiveMonitorOpsTab('health')}
                  >
                    Salud y rendimiento
                  </button>
                </nav>

                {activeMonitorOpsTab === 'audit' ? (
                  <div className="stack">
                    <div className="monitor-quick-actions">
                      <button className="button" type="button" onClick={() => handleSetAuditWindow(1)}>
                        Última hora
                      </button>
                      <button className="button" type="button" onClick={() => handleSetAuditWindow(24)}>
                        Últimas 24h
                      </button>
                      <button className="button" type="button" onClick={() => handleSetAuditWindow(24 * 7)}>
                        Últimos 7 días
                      </button>
                      <button className="button" type="button" onClick={handleClearAuditWindow}>
                        Limpiar fechas
                      </button>
                    </div>

                    <div className="monitor-filter-grid">
                      <label className="field">
                        <span>Usuario</span>
                        <input
                          className="input"
                          value={auditActorSearch}
                          onChange={(event) => setAuditActorSearch(event.target.value)}
                          placeholder="Email o nombre del actor"
                        />
                      </label>

                      <label className="field">
                        <span>Tenant</span>
                        <select
                          className="input"
                          value={auditTenantFilter}
                          onChange={(event) => setAuditTenantFilter(event.target.value)}
                        >
                          <option value="">Todos los tenants</option>
                          {tenants.map((tenant) => (
                            <option key={`audit-tenant-${tenant.id}`} value={tenant.id}>
                              {tenant.nombre_comercial}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Entidad</span>
                        <select
                          className="input"
                          value={auditEntityFilter}
                          onChange={(event) => setAuditEntityFilter(event.target.value as 'ALL' | AuditEntityOption)}
                        >
                          <option value="ALL">Todas</option>
                          {AUDIT_ENTITY_OPTIONS.map((entity) => (
                            <option key={`audit-entity-${entity.value}`} value={entity.value}>
                              {entity.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Acción exacta</span>
                        <input
                          className="input"
                          value={auditActionFilter}
                          onChange={(event) => setAuditActionFilter(event.target.value.toUpperCase())}
                          placeholder="DELETE_ORDER, TENANT_SUBS..."
                        />
                      </label>

                      <label className="field">
                        <span>Buscar contexto</span>
                        <input
                          className="input"
                          value={auditSearchText}
                          onChange={(event) => setAuditSearchText(event.target.value)}
                          placeholder="IP, registro, tenant o acción"
                        />
                      </label>

                      <label className="field">
                        <span>Desde</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={auditFrom}
                          onChange={(event) => setAuditFrom(event.target.value)}
                        />
                      </label>

                      <label className="field">
                        <span>Hasta</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={auditTo}
                          onChange={(event) => setAuditTo(event.target.value)}
                        />
                      </label>
                    </div>

                    {isAuditLoading ? <p className="status">Cargando historial de auditoría...</p> : null}

                    <div className="boxed stack">
                      <div className="session-pagination-toolbar">
                        <small>
                          {auditPageInfo
                            ? `Mostrando ${auditRangeStart}-${auditRangeEnd} de ${auditPageInfo.total}`
                            : 'Sin datos'}
                        </small>

                        <div className="session-pagination-actions">
                          <button
                            className="button"
                            type="button"
                            onClick={() => setAuditOffset((prev) => Math.max(prev - auditPageLimit, 0))}
                            disabled={isAuditLoading || auditOffset <= 0}
                          >
                            Anterior
                          </button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => setAuditOffset((prev) => prev + auditPageLimit)}
                            disabled={isAuditLoading || !auditPageInfo?.hasNextPage}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>

                      {auditLogs.length === 0 ? <p className="muted">Sin eventos de auditoría para los filtros actuales.</p> : null}

                      <ul className="audit-log-list">
                        {auditLogs.map((log) => (
                          <li key={log.id} className="audit-log-item">
                            <div className="audit-log-head">
                              <div className="audit-log-copy">
                                <strong>{log.actor_user_email ?? 'usuario-desconocido'}</strong>
                                <small>
                                  {log.actor_user_nombre ?? 'Sin nombre'} · {log.actor_role ?? 'SIN_ROL'}
                                </small>
                              </div>

                              <div className="audit-log-badges">
                                <span className="session-action-badge">{log.action}</span>
                                <span className="audit-entity-badge">{log.entity}</span>
                              </div>
                            </div>

                            <div className="audit-log-meta">
                              <small>
                                {log.tenant_nombre ?? 'Sin tenant'} · IP {log.ip_address ?? '-'} · evento {formatDate(log.happened_at)}
                              </small>
                              <small>Registro afectado: {log.record_id ?? 'n/d'}</small>
                            </div>

                            <div className="audit-log-payloads">
                              <AuditPayloadBlock title="Valor anterior" value={log.previous_value} />
                              <AuditPayloadBlock title="Valor nuevo" value={log.new_value} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                {activeMonitorOpsTab === 'health' ? (
                  <div className="stack">
                    {isMonitorLoading && !observabilitySnapshot ? <p className="status">Cargando métricas del sistema...</p> : null}

                    {observabilitySnapshot ? (
                      <>
                        <div className="kpi-grid monitor-kpi-grid">
                          <div
                            className={
                              observabilitySnapshot.health.status === 'ok'
                                ? 'kpi-card kpi-card-success'
                                : 'kpi-card kpi-card-warning'
                            }
                          >
                            <strong>{observabilitySnapshot.health.status === 'ok' ? 'OK' : 'DEGRADED'}</strong>
                            <small>Estado del backend</small>
                          </div>

                          <div className="kpi-card">
                            <strong>{formatDuration(observabilitySnapshot.health.db_ping_ms)}</strong>
                            <small>Ping a DB</small>
                          </div>

                          <div className="kpi-card">
                            <strong>{formatDuration(observabilitySnapshot.server.avg_latency_ms)}</strong>
                            <small>Latencia media</small>
                          </div>

                          <div className="kpi-card">
                            <strong>{formatNumber(observabilitySnapshot.database.total_queries)}</strong>
                            <small>Queries SQL</small>
                          </div>

                          <div className="kpi-card">
                            <strong>{formatNumber(observabilitySnapshot.database.slow_queries)}</strong>
                            <small>Slow queries</small>
                          </div>

                          <div className="kpi-card">
                            <strong>{formatDuration(observabilitySnapshot.server.peak_latency_ms)}</strong>
                            <small>Pico de respuesta</small>
                          </div>
                        </div>

                        <div className="monitor-chart-grid">
                          <MetricLineChart
                            title="Tiempo de respuesta del servidor"
                            subtitle="Últimas operaciones GraphQL capturadas por el backend"
                            points={observabilitySnapshot.server.recent_latency}
                            stroke="var(--accent-primary)"
                            emptyLabel="Todavía no hay solicitudes recientes para graficar."
                          />
                          <MetricLineChart
                            title="Uso de base de datos"
                            subtitle="Duración reciente de queries SQL observadas por Prisma"
                            points={observabilitySnapshot.database.recent_queries}
                            stroke="var(--accent-secondary)"
                            emptyLabel="Todavía no hay queries recientes para graficar."
                          />
                        </div>

                        <div className="monitor-breakdown-grid">
                          <article className="boxed stack">
                            <h3>Operaciones del servidor</h3>
                            <p className="muted">Promedio y máximos por operación GraphQL.</p>

                            {observabilitySnapshot.server.operations.length === 0 ? (
                              <p className="muted">Sin tráfico suficiente todavía.</p>
                            ) : (
                              <ul className="monitor-breakdown-list">
                                {observabilitySnapshot.server.operations.slice(0, 6).map((entry) => (
                                  <li key={`server-op-${entry.label}`} className="monitor-breakdown-item">
                                    <strong>{entry.label}</strong>
                                    <small>
                                      {entry.count} req · avg {formatDuration(entry.avg_ms)} · max {formatDuration(entry.max_ms)}
                                    </small>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </article>

                          <article className="boxed stack">
                            <h3>Patrón de queries SQL</h3>
                            <p className="muted">Tipo de operación y costo promedio sobre la base.</p>

                            {observabilitySnapshot.database.queries_by_type.length === 0 ? (
                              <p className="muted">Sin queries registradas todavía.</p>
                            ) : (
                              <ul className="monitor-breakdown-list">
                                {observabilitySnapshot.database.queries_by_type.slice(0, 6).map((entry) => (
                                  <li key={`db-op-${entry.label}`} className="monitor-breakdown-item">
                                    <strong>{entry.label}</strong>
                                    <small>
                                      {entry.count} queries · avg {formatDuration(entry.avg_ms)} · max {formatDuration(entry.max_ms)}
                                    </small>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <small className="muted">
                              Última query observada: {formatDate(observabilitySnapshot.database.last_query_at)}
                            </small>
                          </article>

                          <article className="boxed stack">
                            <h3>Errores GraphQL</h3>
                            <p className="muted">Conteo acumulado por código de error reportado.</p>

                            {observabilitySnapshot.server.errors_by_code.length === 0 ? (
                              <p className="muted">Sin errores GraphQL acumulados en esta sesión del backend.</p>
                            ) : (
                              <ul className="monitor-breakdown-list">
                                {observabilitySnapshot.server.errors_by_code.map((entry) => (
                                  <li key={`error-code-${entry.label}`} className="monitor-breakdown-item">
                                    <strong>{entry.label}</strong>
                                    <small>{formatNumber(entry.count)} eventos</small>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </article>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Sin snapshot de observabilidad todavía.</p>
                    )}
                  </div>
                ) : null}
              </article>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export default App;
