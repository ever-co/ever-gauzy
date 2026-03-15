export { DashboardTimeTrackReactUiPage } from './DashboardTimeTrackReactUiPage';
export { DashboardHeader, type DashboardHeaderProps } from './DashboardHeader';
export * from './widgets';

// Re-export from @gauzy/ui-react-components for convenience
export { theme, formatDuration, currentWeekRange, todayRange } from '@gauzy/ui-react-components';
export {
	Card, type CardProps, CardHeader, type CardHeaderProps, CardTitle, type CardTitleProps,
	CardDescription, type CardDescriptionProps, CardAction, type CardActionProps,
	CardContent, type CardContentProps, CardFooter, type CardFooterProps
} from '@gauzy/ui-react-components';
export { WidgetCard, type WidgetCardProps, Progress, type ProgressProps, ColorDots, type ColorDotsProps } from '@gauzy/ui-react-components';
