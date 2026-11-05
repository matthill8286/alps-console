// Operations from Appendix B. The mock dispatches on operation name.

export const LIST_DEVICES = /* GraphQL */ `
  query ListDevices(
    $tenantId: String
    $imei: String
    $serialNumber: String
    $stateId: Int
    $page: Int
    $pageSize: Int
  ) {
    listDevices(
      tenantId: $tenantId
      imei: $imei
      serialNumber: $serialNumber
      stateId: $stateId
      page: $page
      pageSize: $pageSize
    ) {
      pageInfo {
        total_count
      }
      deviceList {
        id
        serialNumber
        modelMarketingName
        brandName
        IMEIs {
          imei
          isPrimary
        }
        state {
          id
          name
        }
        policy {
          id
          name
          color
        }
        lastCheckin
      }
    }
  }
`;

export const DEVICE_DETAIL = /* GraphQL */ `
  query DeviceDetail($tenantId: String!, $deviceId: String!) {
    deviceDetail(tenantId: $tenantId, deviceId: $deviceId) {
      id
      serialNumber
      deviceBrandName
      deviceModelMarketingName
      imsi
      locale
      firstEnrollAt
      IMEIs {
        imei
        isPrimary
      }
      state {
        id
        name
      }
      policy {
        id
        name
        color
      }
      lastCheckin {
        label
        date
        color
      }
    }
  }
`;

export const LIST_DEVICE_HISTORY = /* GraphQL */ `
  query ListDeviceHistory($tenantId: String!, $deviceId: String!, $page: Int, $pageSize: Int) {
    listDeviceHistory(tenantId: $tenantId, deviceId: $deviceId, page: $page, pageSize: $pageSize) {
      pageInfo {
        total_count
      }
      histories {
        type
        createdAt
        email
        policyName
        nextPolicyName
        actionName
      }
    }
  }
`;

export const LIST_AVAILABLE_ACTIONS = /* GraphQL */ `
  query ListAvailableActions($tenantId: String, $stateId: String) {
    listAvailableActions(tenantId: $tenantId, stateId: $stateId) {
      id
      actionName
      policyName
      stateId
    }
  }
`;

export const ASSIGN_ACTION = /* GraphQL */ `
  mutation AssignAction($tenantId: String!, $deviceId: String!, $actionId: String!) {
    assignAction(tenantId: $tenantId, deviceId: $deviceId, actionId: $actionId)
  }
`;

export const QK = {
  deviceList: 'device-list',
  deviceDetail: 'device-detail',
  deviceHistory: 'device-history',
  availableActions: 'available-actions',
} as const;

// Hand-written from schema.graphql.

export type State = { id: number; name: string | null };
export type Policy = { id: string; name: string | null; color: string | null };
export type IMEI = { imei: string | null; isPrimary: boolean | null };

export type DeviceRow = {
  id: string;
  serialNumber: string | null;
  modelMarketingName: string | null;
  brandName: string | null;
  IMEIs: IMEI[] | null;
  state: State | null;
  policy: Policy;
  lastCheckin: string | null;
};

export type ListDevicesData = {
  listDevices: {
    pageInfo: { total_count: number | null } | null;
    deviceList: (DeviceRow | null)[] | null;
  } | null;
};
export type ListDevicesVars = {
  tenantId: string;
  imei?: string;
  serialNumber?: string;
  stateId?: number;
  page: number;
  pageSize: number;
};

export type DeviceDetail = {
  id: string;
  serialNumber: string | null;
  deviceBrandName: string | null;
  deviceModelMarketingName: string | null;
  imsi: string | null;
  locale: string | null;
  firstEnrollAt: string | null;
  IMEIs: IMEI[] | null;
  state: State | null;
  policy: Policy | null;
  lastCheckin: { label: string | null; date: string | null; color: string | null } | null;
};
export type DeviceDetailData = { deviceDetail: DeviceDetail | null };
export type DeviceDetailVars = { tenantId: string; deviceId: string };

export type History = {
  type: string | null;
  createdAt: string | null;
  email: string | null;
  policyName: string | null;
  nextPolicyName: string | null;
  actionName: string | null;
};
export type DeviceHistoryData = {
  listDeviceHistory: {
    pageInfo: { total_count: number | null } | null;
    histories: (History | null)[] | null;
  } | null;
};
export type DeviceHistoryVars = {
  tenantId: string;
  deviceId: string;
  page: number;
  pageSize: number;
};

export type Action = {
  id: string;
  actionName: string | null;
  policyName: string | null;
  stateId: number | null;
};
export type AvailableActionsData = { listAvailableActions: (Action | null)[] | null };
export type AvailableActionsVars = { tenantId: string; stateId: string };

export type AssignActionData = { assignAction: boolean | null };
export type AssignActionVars = { tenantId: string; deviceId: string; actionId: string };

// TODO: the schema has no way to list states, so these mirror the mock's seed.
export const STATE_NAMES: Record<number, string> = {
  1: 'ENROLLED',
  2: 'ACTIVE',
  3: 'LOCKED',
  4: 'RELEASED',
};
