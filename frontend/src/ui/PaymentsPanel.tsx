import { PaymentsManagementPage } from './WorkflowsV2';

export function PaymentsPanel({ can, onError }: { can: (permission: string) => boolean; onError: (value: string) => void }) {
  return <PaymentsManagementPage canCreate={can('payment:create')} canReconcile={can('payment:reconcile')} onError={onError} />;
}
