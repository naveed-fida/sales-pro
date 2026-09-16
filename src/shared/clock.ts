/**
 * Clock checks compare the machine time to a trusted HTTPS Date header, and
 * to the last watermark this app wrote. Shared so main and renderer agree on
 * the limits without importing Electron.
 */

export const CLOCK_SKEW_LIMIT_MS = 5 * 60 * 1000
export const CLOCK_WATERMARK_INTERVAL_MS = 3 * 60 * 1000
export const CLOCK_ROLLBACK_SLACK_MS = 5 * 1000
export const CLOCK_TRUST_TIMEOUT_MS = 5 * 1000
