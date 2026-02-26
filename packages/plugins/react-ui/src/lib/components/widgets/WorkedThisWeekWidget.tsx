import { StatCard } from '../ui/StatCard';
import { ProgressBar } from '../ui/ProgressBar';
import { theme } from '../theme';

export interface WorkedThisWeekWidgetProps {
	duration: string;
	progressPercent?: number;
}

export function WorkedThisWeekWidget({ duration, progressPercent = 0 }: WorkedThisWeekWidgetProps) {
	return (
		<StatCard label="Worked this week" value={duration}>
			<ProgressBar percent={progressPercent} color={theme.red} />
		</StatCard>
	);
}
