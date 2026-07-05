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