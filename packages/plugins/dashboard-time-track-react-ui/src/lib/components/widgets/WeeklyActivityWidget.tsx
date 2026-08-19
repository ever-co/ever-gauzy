import { WidgetCard, Progress } from '@gauzy/ui-react-components';

export interface WeeklyActivityWidgetProps {
	percentage: number;
	label?: string;
}

export function WeeklyActivityWidget({ percentage, label = 'Weekly Activity' }: WeeklyActivityWidgetProps) {
	return (
		<WidgetCard label={label} value={`${percentage.toFixed(2)}%`}>
			{/* Same bar as its neighbour, so it takes the same accent. */}
			<Progress percent={percentage} />
		</WidgetCard>
	);
}
