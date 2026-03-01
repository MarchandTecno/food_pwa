import type { tenants, users } from '@prisma/client';
import { toAuthPayloadOutput } from '../../src/models/auth.model';
import { toTenantListOutput, toTenantOutput } from '../../src/models/tenant.model';
import { toUserOutput } from '../../src/models/user.model';

describe('models/auth-tenant-user', () => {
  it('maps user output and keeps nullable created_at fallback', () => {
    const user = {
      id: 'u_1',
      email: 'user@test.com',
      nombre: 'User Test',
    } as unknown as users;

    const output = toUserOutput(user);

    expect(output.id).toBe('u_1');
    expect(output.email).toBe('user@test.com');
    expect(output.nombre).toBe('User Test');
    expect(output.created_at).toBeNull();
  });

  it('maps auth payload using user output mapper', () => {
    const user = {
      id: 'u_2',
      email: 'auth@test.com',
      nombre: 'Auth User',
    } as unknown as users;

    const payload = toAuthPayloadOutput('jwt-token', user);

    expect(payload.token).toBe('jwt-token');
    expect(payload.user.id).toBe('u_2');
    expect(payload.user.email).toBe('auth@test.com');
    expect(payload.user.created_at).toBeNull();
  });

  it('maps tenant output and tenant list output', () => {
    const tenant = {
      id: 't_1',
      nombre_comercial: 'Tenant One',
      email_admin: 'tenant@test.com',
      telefono_contacto: '+521111111111',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    } as unknown as tenants;

    const output = toTenantOutput(tenant);
    expect(output.id).toBe('t_1');
    expect(output.nombre).toBe('Tenant One');
    expect(output.email).toBe('tenant@test.com');
    expect(output.whatsapp).toBe('+521111111111');
    expect(output.created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));

    const list = toTenantListOutput([tenant]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('t_1');
  });
});
