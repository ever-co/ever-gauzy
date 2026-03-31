import { WidgetCard, Progress, theme } from '@gauzy/ui-react-components';

export interface WeeklyActivityWidgetProps {
	percentage: number;
	label?: string;
}

export function WeeklyActivityWidget({ percentage, label = 'Weekly Activity' }: WeeklyActivityWidgetProps) {
	return (
		<WidgetCard label={label} value={`${percentage.toFixed(2)}%`}>
			<Progress percent={percentage} color={theme.blue} />
		</WidgetCard>
	);
}
