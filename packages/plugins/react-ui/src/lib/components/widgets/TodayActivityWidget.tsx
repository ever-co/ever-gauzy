import { StatCard } from '../ui/StatCard';

export interface TodayActivityWidgetProps {
	percentage: number;
}

export function TodayActivityWidget({ percentage }: TodayActivityWidgetProps) {
	return <StatCard label="Today's Activity" value={`${percentage}%`} />;
}
