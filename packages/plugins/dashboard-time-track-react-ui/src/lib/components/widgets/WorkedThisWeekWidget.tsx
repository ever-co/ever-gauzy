import { Card, Progress, theme } from '@gauzy/ui-react-components';

export interface WorkedThisWeekWidgetProps {
	duration: string;
	progressPercent?: number;
}

export function WorkedThisWeekWidget({ duration, progressPercent = 0 }: WorkedThisWeekWidgetProps) {
	return (
		<Card label="Worked this week" value={duration}>
			<Progress percent={progressPercent} color={theme.red} />
		</Card>
	);
}
