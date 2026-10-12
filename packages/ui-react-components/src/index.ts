/*
 * Public API Surface of @gauzy/ui-react-components
 *
 * Reusable React UI components and design tokens for Gauzy dashboards.
 * No Angular or plugin-system dependencies — pure React + TypeScript.
 */

// Design tokens
export { theme } from './lib/theme';
export { themeTokens, statusColor, type NbStatus } from './lib/themeTokens';

// Utility functions
export {
	formatDuration,
	currentWeekRange,
	todayRange,
	progressStatus,
	ensureStyleTag,
	useInjectedStyles
} from './lib/helpers/index';

// Components — Card (layout, compound component)
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

// Components — theme-adaptive Nebular ports (paint with the active Gauzy theme's CSS variables)
export {
	CounterPoint,
	computeCounterPoints,
	counterPointBackground,
	type CounterPointProps
} from './lib/components/CounterPoint';
export { ProgressBar, type ProgressBarProps, type ProgressBarSize } from './lib/components/ProgressBar';
export { Badge, type BadgeProps } from './lib/components/Badge';
export { Avatar, type AvatarProps, type AvatarSize } from './lib/components/Avatar';
export { Spinner, type SpinnerProps, type SpinnerSize } from './lib/components/Spinner';
export { Popover, computePopoverPosition, type PopoverProps, type PopoverPlacement } from './lib/components/Popover';
