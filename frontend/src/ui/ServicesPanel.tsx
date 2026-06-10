import { ServiceManagementPage } from './WorkflowsV2';

export function ServicesPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  return <ServiceManagementPage canManage={can('service:manage')} onError={onError} />;
}
