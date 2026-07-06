import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLiveHospitalRankingPayload } from './hospitalPayload.js';

test('live hospital ranking payload uses supported snake_case integers and default limit', () => {
  assert.deepEqual(buildLiveHospitalRankingPayload('7'), { incident_id: 7, limit: 10 });
  assert.deepEqual(buildLiveHospitalRankingPayload(9, '20'), { incident_id: 9, limit: 20 });
});

test('live hospital ranking payload rejects invalid incident and limit values', () => {
  assert.throws(() => buildLiveHospitalRankingPayload(''), /incident_id/);
  assert.throws(() => buildLiveHospitalRankingPayload(1, 21), /limit/);
});
import fs from 'node:fs';
import { buildResourceParams, DASHBOARD_POLL_MS, shouldPollDashboard } from '../utils/operations.js';

test('Overview polling is 20 seconds and pauses while hidden', () => {
  assert.equal(DASHBOARD_POLL_MS, 20000);
  assert.equal(shouldPollDashboard('visible'), true);
  assert.equal(shouldPollDashboard('hidden'), false);
});

test('resource pagination parameters preserve active filters', () => {
  const params = buildResourceParams({ page: 3, search: 'MYP', category: 'Police', type: '', status: 'Available', baseId: '4', capability: 'traffic', sortBy: 'status', sortOrder: 'desc' });
  assert.equal(params.page_size, 20);
  assert.equal(params.category, 'Police');
  assert.equal(params.status, 'Available');
  assert.equal(params.base_id, '4');
});

test('judge banner appears once and Live Response uses a bounded shortlist', () => {
  const banner = fs.readFileSync(new URL('../components/layout/PageContainer.jsx', import.meta.url), 'utf8');
  const live = fs.readFileSync(new URL('../pages/LiveResponseIntelligence.jsx', import.meta.url), 'utf8');
  assert.equal((banner.match(/Hackathon Judge Mode/g) || []).length, 1);
  assert.match(live, /slice\(0, 8\)/);
  assert.match(live, /resourcesAPI\.getPage/);
});
