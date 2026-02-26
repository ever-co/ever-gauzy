import { StatCard } from '../ui/StatCard';
import { ProgressBar } from '../ui/ProgressBar';
import { theme } from '../theme';

export interface WeeklyActivityWidgetProps {
	percentage: number;
}

export function WeeklyActivityWidget({ percentage }: WeeklyActivityWidgetProps) {
	return (
		<StatCard label="Weekly Activity" value={`${percentage.toFixed(2)}%`}>
			<ProgressBar percent={percentage} color={theme.blue} />
		</StatCard>
	);
}
