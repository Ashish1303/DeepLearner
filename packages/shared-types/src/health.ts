/** Process liveness only; does not assert external dependency readiness. */
export interface HealthStatus {
  status: 'ok';
  service: 'deeplearner-api';
}
