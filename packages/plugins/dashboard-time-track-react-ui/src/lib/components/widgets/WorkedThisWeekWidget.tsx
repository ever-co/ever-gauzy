import { WidgetCard, Progress } from '@gauzy/ui-react-components';

export interface WorkedThisWeekWidgetProps {
	duration: string;
	progressPercent?: number;
	label?: string;
}

export function WorkedThisWeekWidget({ duration, progressPercent = 0, label = 'Worked this week' }: WorkedThisWeekWidgetProps) {
	return (
		<WidgetCard label={label} value={duration}>
			{/* No colour: a bar measuring worked time is not an error state. */}
			<Progress percent={progressPercent} />
		</WidgetCard>
	);
}
