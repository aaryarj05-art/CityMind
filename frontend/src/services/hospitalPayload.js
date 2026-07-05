export const buildLiveHospitalRankingPayload = (incidentId, limit = 10) => {
  const normalizedIncidentId = Number(incidentId);
  const normalizedLimit = Number(limit);
  if (!Number.isInteger(normalizedIncidentId) || normalizedIncidentId < 1) {
    throw new TypeError('incident_id must be a positive integer.');
  }
  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 20) {
    throw new TypeError('limit must be an integer between 1 and 20.');
  }
  return { incident_id: normalizedIncidentId, limit: normalizedLimit };
};