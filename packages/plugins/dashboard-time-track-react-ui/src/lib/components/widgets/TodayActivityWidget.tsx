import { Card } from '@gauzy/ui-react-components';

export interface TodayActivityWidgetProps {
	percentage: number;
}

export function TodayActivityWidget({ percentage }: TodayActivityWidgetProps) {
	return <Card label="Today's Activity" value={`${percentage}%`} />;
}
