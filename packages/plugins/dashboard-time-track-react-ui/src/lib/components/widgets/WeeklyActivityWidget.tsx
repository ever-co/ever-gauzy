import { Card, Progress, theme } from '@gauzy/ui-react-components';

export interface WeeklyActivityWidgetProps {
	percentage: number;
}

export function WeeklyActivityWidget({ percentage }: WeeklyActivityWidgetProps) {
	return (
		<Card label="Weekly Activity" value={`${percentage.toFixed(2)}%`}>
			<Progress percent={percentage} color={theme.blue} />
		</Card>
	);
}
