import { StatCard } from '../ui/StatCard';

export interface WorkedTodayWidgetProps {
	duration: string;
}

export function WorkedTodayWidget({ duration }: WorkedTodayWidgetProps) {
	return <StatCard label="Worked today" value={duration} />;
}
