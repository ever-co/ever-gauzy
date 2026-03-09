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

// Components — Card (layout, shadcn-style compound)
export {
	Card, type CardProps,
	CardHeader, type CardHeaderProps,
	CardTitle, type CardTitleProps,
	CardDescription, type CardDescriptionProps,
	CardAction, type CardActionProps,
	CardContent, type CardContentProps,
	CardFooter, type CardFooterProps
} from './lib/components/ui';

// Components — WidgetCard (stat/metric card built on Card + CardContent)
export { WidgetCard, type WidgetCardProps } from './lib/components/WidgetCard';

export { Progress, type ProgressProps } from './lib/components/Progress';
export { ColorDots, type ColorDotsProps } from './lib/components/ColorDots';
