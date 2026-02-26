import { StatCard } from '../ui/StatCard';
import { ProjectDots } from '../ui/ProjectDots';

export interface ProjectsWorkedWidgetProps {
	count: number;
	colors?: string[];
}

export function ProjectsWorkedWidget({ count }: ProjectsWorkedWidgetProps) {
	return (
		<StatCard label="Projects worked" value={count}>
			<ProjectDots count={Math.min(count, 5)} />
		</StatCard>
	);
}
