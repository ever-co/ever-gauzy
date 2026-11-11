import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TaskBuiltInViewEnum } from '@gauzy/contracts';
import { TASK_VIEWS_BUILT_IN_SEGMENT, TASK_VIEWS_LINK } from '../task-views-ui.constants';
import { ShortcutRegistryService } from './shortcut-registry.service';

/** Where each "go to" command leads. */
export const GO_TO_LINKS: Readonly<Record<string, string>> = {
	goTasks: '/pages/tasks/dashboard',
	goViews: TASK_VIEWS_LINK,
	goMine: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.MINE}`,
	goThisWeek: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.THIS_WEEK}`,
	goOverdue: `${TASK_VIEWS_LINK}/${TASK_VIEWS_BUILT_IN_SEGMENT}/${TaskBuiltInViewEnum.OVERDUE}`,
	goInbox: '/pages/inbox',
	goChat: '/pages/chat',
	goDocs: '/pages/documents',
	goHome: '/pages/dashboard',
	goProjects: '/pages/organization/projects',
	goTimesheets: '/pages/employees/timesheets',
	settingsOpen: '/pages/settings'
};

/**
 * Registers the commands that run anywhere: the "go to" links, the `?` help (a toggle) and `G R` (go to a task by
 * reference). The dialogs load on first use. Answers the function that removes them again.
 */
export function registerGlobalShortcuts(injector: Injector): () => void {
	const registry = injector.get(ShortcutRegistryService);
	const router = injector.get(Router);
	const dialogs = injector.get(NbDialogService);
	let help: NbDialogRef<unknown> | null = null;
	let goTo: NbDialogRef<unknown> | null = null;

	const links = Object.fromEntries(Object.entries(GO_TO_LINKS).map(([commandId, link]) => [commandId, () => void router.navigateByUrl(link)]));

	return registry.registerAll({
		...links,
		helpOpen: () => {
			if (help) {
				help.close();
				return;
			}
			void import('./shortcut-help-dialog.component').then(({ ShortcutHelpDialogComponent }) => {
				help = dialogs.open(ShortcutHelpDialogComponent, { closeOnEsc: true }) as NbDialogRef<unknown>;
				help.onClose.subscribe(() => (help = null));
			});
		},
		taskGoTo: () => {
			if (goTo) return;
			void import('../components/go-to-task/go-to-task-dialog.component').then(({ GoToTaskDialogComponent }) => {
				goTo = dialogs.open(GoToTaskDialogComponent, { closeOnEsc: true }) as NbDialogRef<unknown>;
				goTo.onClose.subscribe(() => (goTo = null));
			});
		}
	});
}
