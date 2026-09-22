import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbComponentStatus, NbProgressBarModule } from '@nebular/theme';
import { Observable } from 'rxjs';
import { IProjectsStatistics } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/ui-core/common';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { DurationFormatPipe } from '@gauzy/ui-core/shared';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';

/**
 * List widget: how the tracked time of the selected range splits across projects.
 *
 * Wraps the legacy dashboard's "Projects" window. Unlike the Tasks panel it has
 * no "view all" action, because the legacy window had none either — the project
 * breakdown is the report.
 *
 * NOTE: this is the LIST panel. The single number "how many projects were worked
 * on" lives in the separate `time-tracking.projects-worked` counter widget.
 */
@Component({
	selector: 'gz-projects-list-widget',
	templateUrl: './projects-list-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss'],
	standalone: true,
	// No `TranslateModule`: this panel renders no label of its own — the host owns
	// the title, and `gz-time-track-widget-state` translates the empty/error copy.
	imports: [NbProgressBarModule, DurationFormatPipe, TimeTrackWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsListWidgetComponent extends BaseTimeTrackListWidgetComponent<IProjectsStatistics> {
	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_PROJECT_ACTIVITY';

	/**
	 * Reads the per-project statistics for the current scope.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The project rows, highest duration first.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<IProjectsStatistics[]> {
		return this.statisticsCache.getProjects(context);
	}

	/**
	 * Rounded share of the range's tracked time that went into a project.
	 *
	 * @param project - The row being rendered.
	 * @returns A percentage between 0 and 100.
	 */
	protected sharePercentage(project: IProjectsStatistics): number {
		return Math.round(project?.durationPercentage ?? 0);
	}

	/**
	 * Nebular status for a percentage, so the bars use the same
	 * danger/warning/info/success scale as the rest of the app.
	 *
	 * @param value - A percentage between 0 and 100.
	 * @returns The matching Nebular status name.
	 */
	protected statusFor(value: number): NbComponentStatus {
		return progressStatus(value ?? 0);
	}
}
