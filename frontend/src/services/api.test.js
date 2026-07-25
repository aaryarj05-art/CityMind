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


test('login request includes selected login_mode', () => {
  const apiSource = fs.readFileSync(new URL('./api.js', import.meta.url), 'utf8');
  assert.match(apiSource, /google: \(credential, loginMode = 'user'\)/);
  assert.match(apiSource, /credential, login_mode: loginMode/);
});

test('sidebar limits user mode to Overview and User', () => {
  const sidebar = fs.readFileSync(new URL('../components/layout/Sidebar.jsx', import.meta.url), 'utf8');
  assert.match(sidebar, /loginMode === 'user'/);
  assert.match(sidebar, /item\.path === '\/' \|\| item\.path === '\/user'/);
});

import { resolveMediaUrl } from '../utils/media.js';

test('media urls resolve against the backend origin', () => {
  assert.equal(resolveMediaUrl('/api/user/report-media/example.jpg'), 'http://localhost:8000/api/user/report-media/example.jpg');
  assert.equal(resolveMediaUrl('https://cdn.example.test/example.jpg'), 'https://cdn.example.test/example.jpg');
});

test('citizen evidence form hides manual coordinates but preserves backend payload fields', () => {
  const portal = fs.readFileSync(new URL('../pages/UserPortal.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(portal, />Latitude</);
  assert.doesNotMatch(portal, />Longitude</);
  assert.doesNotMatch(portal, /Enter valid latitude and longitude values/);
  assert.match(portal, /<EvidenceLocationPicker/);
  assert.match(portal, /formData\.append\('latitude', String\(location\.latitude\)\)/);
  assert.match(portal, /formData\.append\('longitude', String\(location\.longitude\)\)/);
});
