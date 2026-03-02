/*
 * Public API Surface of @gauzy/ui-react-components
 *
 * Reusable React UI components and design tokens for Gauzy dashboards.
 * No Angular or plugin-system dependencies — pure React + TypeScript.
 */

// Design tokens
export { theme } from './lib/theme';

// Utility functions
export { formatDuration, currentWeekRange, todayRange } from './lib/helpers/index';

// Components
export { Card, type CardProps } from './lib/components/Card';
export { Progress, type ProgressProps } from './lib/components/Progress';
export { ColorDots, type ColorDotsProps } from './lib/components/ColorDots';
