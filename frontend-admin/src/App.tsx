import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createBranch,
  createTenant,
  fetchAdminTenants,
  fetchMe,
  fetchTenantBranches,
  loginAdmin,
  setBranchSuspended,
  updateTenantBranding,
  updateTenantSubscription,
} from './services/adminApi';
import type {
  AdminBranch,
  AdminTenant,
  AdminUser,
  CreateBranchPayload,
  CreateTenantPayload,
  TenantSubscriptionStatus,
  UpdateBrandingPayload,
} from './types/admin';

const TOKEN_STORAGE_KEY = 'foodflow_superadmin_token';

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

function toOptional(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenants],
  );

  async function reloadTenantBranches(currentToken: string, tenantId: string): Promise<void> {
    const tenantBranches = await fetchTenantBranches(currentToken, tenantId);
    setBranches(tenantBranches);
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

    if (candidateTenantId) {
      await reloadTenantBranches(token, candidateTenantId);
    } else {
      setBranches([]);
    }
  }

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setTenants([]);
      setSelectedTenantId(null);
      setBranches([]);
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
      <header className="topbar card">
        <div>
          <h1>Panel SuperAdmin</h1>
          <p>Gestión centralizada de tenants, branding, sucursales y suscripción.</p>
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

      <section className="layout">
        <article className="card">
          <h2>Tenants</h2>
          {tenants.length === 0 ? <p className="muted">Sin tenants registrados.</p> : null}

          <ul className="tenant-list">
            {tenants.map((tenant) => (
              <li key={tenant.id} className={tenant.id === selectedTenantId ? 'tenant-item tenant-item-active' : 'tenant-item'}>
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

        <article className="card">
          <h2>Tenant seleccionado</h2>

          {!selectedTenant ? <p className="muted">Selecciona un tenant para administrarlo.</p> : null}

          {selectedTenant ? (
            <div className="stack">
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

                <button className="button" type="submit" disabled={isSubmitting}>
                  Guardar branding
                </button>
              </form>

              <form className="form boxed" onSubmit={handleCreateBranch}>
                <h3>Crear sucursal</h3>

                <label className="field">
                  <span>Nombre</span>
                  <input
                    className="input"
                    value={branchForm.nombre_sucursal}
                    onChange={(event) => setBranchForm((prev) => ({ ...prev, nombre_sucursal: event.target.value }))}
                    required
                  />
                </label>

                <label className="field">
                  <span>Dirección</span>
                  <input
                    className="input"
                    value={branchForm.direccion_fisica ?? ''}
                    onChange={(event) => setBranchForm((prev) => ({ ...prev, direccion_fisica: event.target.value }))}
                  />
                </label>

                <div className="grid-two">
                  <label className="field">
                    <span>Apertura (HH:mm)</span>
                    <input
                      className="input"
                      value={branchForm.horario_apertura ?? ''}
                      onChange={(event) => setBranchForm((prev) => ({ ...prev, horario_apertura: event.target.value }))}
                      placeholder="08:00"
                    />
                  </label>

                  <label className="field">
                    <span>Cierre (HH:mm)</span>
                    <input
                      className="input"
                      value={branchForm.horario_cierre ?? ''}
                      onChange={(event) => setBranchForm((prev) => ({ ...prev, horario_cierre: event.target.value }))}
                      placeholder="22:00"
                    />
                  </label>
                </div>

                <button className="button" type="submit" disabled={isSubmitting}>
                  Crear sucursal
                </button>
              </form>

              <div className="boxed">
                <h3>Sucursales</h3>

                <label className="field">
                  <span>Motivo de suspensión/reactivación</span>
                  <input
                    className="input"
                    value={branchActionReason}
                    onChange={(event) => setBranchActionReason(event.target.value)}
                  />
                </label>

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
      </section>
    </main>
  );
}

export default App;
