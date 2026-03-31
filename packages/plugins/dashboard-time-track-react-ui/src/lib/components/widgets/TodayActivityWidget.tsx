import { WidgetCard } from '@gauzy/ui-react-components';

export interface TodayActivityWidgetProps {
	percentage: number;
}

export function TodayActivityWidget({ percentage }: TodayActivityWidgetProps) {
	return <WidgetCard label="Today's Activity" value={`${percentage}%`} />;
}
