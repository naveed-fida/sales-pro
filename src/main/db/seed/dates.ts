import { set, subDays } from 'date-fns'

/** Shop-local wall clock for seeded purchases and bills. */
export function shopTimeDaysAgo(days: number, hour = 11, minute = 0): Date {
  return set(subDays(new Date(), days), {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  })
}
