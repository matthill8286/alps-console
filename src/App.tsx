import { useState } from 'react';
import { TENANTS, useTenant } from './data/tenant';
import { TenantProvider } from './data/TenantProvider';
import { DeviceDetailPanel } from './features/DeviceDetailPanel';
import { DeviceList } from './features/DeviceList';

export default function App() {
  return (
    <TenantProvider>
      <Header />
      <TenantConsole />
    </TenantProvider>
  );
}

function Header() {
  const { tenantId, switchTenant } = useTenant();
  return (
    <header className="app-header">
      <h1>ALPS Device Console</h1>
      <label>
        Tenant
        <select value={tenantId} onChange={(e) => switchTenant(e.target.value)}>
          {TENANTS.map((tenant) => (
            <option key={tenant} value={tenant}>
              {tenant}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}

// Keyed on tenant so a switch discards all tenant-scoped UI state in the same render.
function TenantConsole() {
  const { tenantId } = useTenant();
  return <Console key={tenantId} />;
}

function Console() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <main className="layout">
      <DeviceList selectedId={selectedId} onSelect={setSelectedId} />
      {selectedId ? (
        <DeviceDetailPanel key={selectedId} deviceId={selectedId} />
      ) : (
        <section className="panel muted">Select a device to see its details and history.</section>
      )}
    </main>
  );
}
