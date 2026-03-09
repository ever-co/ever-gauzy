import { WidgetCard, Progress, theme } from '@gauzy/ui-react-components';

export interface WorkedThisWeekWidgetProps {
	duration: string;
	progressPercent?: number;
	label?: string;
}

export function WorkedThisWeekWidget({ duration, progressPercent = 0, label = 'Worked this week' }: WorkedThisWeekWidgetProps) {
	return (
		<WidgetCard label={label} value={duration}>
			<Progress percent={progressPercent} color={theme.red} />
		</WidgetCard>
	);
}
