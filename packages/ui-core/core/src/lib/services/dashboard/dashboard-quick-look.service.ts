import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { IOrganizationProject, ITask } from '@gauzy/contracts';

/** What a dashboard section asks the dashboard to show in a quick-look drawer. */
export type DashboardQuickLookRequest =
	| { kind: 'task'; task: ITask }
	| { kind: 'project'; project: IOrganizationProject };

/**
 * Lets a dashboard section open a task or a project in the dashboard's quick-look drawers.
 *
 * The drawers (task record view, project quick look) belong to the app's dashboard layout,
 * which plugin-contributed sections such as Time Tracking cannot import; they ask through
 * this service instead and the layout's host renders the drawer.
 */
@Injectable({ providedIn: 'root' })
export class DashboardQuickLookService {
	private readonly _requests$ = new Subject<DashboardQuickLookRequest>();

	/** Every open request, in order; the dashboard layout's host listens. */
	public readonly requests$: Observable<DashboardQuickLookRequest> = this._requests$.asObservable();

	public openTask(task: ITask): void {
		if (task?.id) {
			this._requests$.next({ kind: 'task', task });
		}
	}

	public openProject(project: IOrganizationProject): void {
		if (project?.id) {
			this._requests$.next({ kind: 'project', project });
		}
	}
}
