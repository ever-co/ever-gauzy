import { WidgetCard, ColorDots } from '@gauzy/ui-react-components';

export interface ProjectsWorkedWidgetProps {
	count: number;
	colors?: string[];
}

export function ProjectsWorkedWidget({ count, colors }: ProjectsWorkedWidgetProps) {
	return (
		<WidgetCard label="Projects worked" value={count}>
			<ColorDots count={Math.min(count, 5)} colors={colors} />
		</WidgetCard>
	);
}
