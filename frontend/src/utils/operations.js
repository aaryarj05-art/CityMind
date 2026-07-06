export const DASHBOARD_POLL_MS = 20000;
export const shouldPollDashboard = (visibilityState) => visibilityState === 'visible';
export const RESOURCE_PAGE_SIZE = 20;
export const buildResourceParams = ({ page, search, category, type, status, baseId, capability, sortBy, sortOrder }) => ({
  page, page_size: RESOURCE_PAGE_SIZE, search: search || undefined,
  category: category || undefined, type: type || undefined, status: status || undefined,
  base_id: baseId || undefined, capability: capability || undefined,
  sort_by: sortBy, sort_order: sortOrder,
});
