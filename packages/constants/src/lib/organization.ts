/**
 * Array containing the default time formats.
 */
export const DEFAULT_TIME_FORMATS: number[] = [12, 24];

/**
 * Default standard work hours per day.
 * - Typically set to 8 hours, aligning with standard full-time work schedules.
 */
export const DEFAULT_STANDARD_WORK_HOURS_PER_DAY = 8;

/**
 * Default profit-based bonus percentage.
 * - Represents a 75% bonus based on profit metrics.
 */
export const DEFAULT_PROFIT_BASED_BONUS = 75;

/**
 * Default revenue-based bonus percentage.
 * - Represents a 10% bonus based on revenue metrics.
 */
export const DEFAULT_REVENUE_BASED_BONUS = 10;

/**
 * Default invite expiry period in days.
 * - Invitations expire after 7 days by default.
 */
export const DEFAULT_INVITE_EXPIRY_PERIOD = 7;

/**
 * Array of default date formats.
 * - 'L': Locale-specific date representation (e.g., 09/04/1986).
 * - 'LL': Full month name, day, and year (e.g., September 4, 1986).
 * - 'dddd, LL': Day of the week, full month name, day, and year (e.g., Thursday, September 4, 1986).
 */
export const DEFAULT_DATE_FORMATS: string[] = ['L', 'LL', 'dddd, LL'];

/**
 * Array of default inactivity time limits in minutes.
 * - Specifies time limits after which a user is considered inactive.
 * - Common values: 1, 5, 10, 20, 30 minutes.
 */
export const DEFAULT_INACTIVITY_TIME_LIMITS: number[] = [1, 5, 10, 20, 30];

/**
 * Array of default activity proof durations in minutes.
 * - Defines durations for capturing proof of activity.
 * - Common values: 1, 3, 5, 10 minutes.
 */
export const DEFAULT_ACTIVITY_PROOF_DURATIONS: number[] = [1, 3, 5, 10];

/**
 * Array of default screenshot frequency options in minutes.
 * - Determines how frequently screenshots are taken to monitor activity.
 * - Common values: 1, 3, 5, 10 minutes.
 */
export const DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS: number[] = [1, 3, 5, 10];
