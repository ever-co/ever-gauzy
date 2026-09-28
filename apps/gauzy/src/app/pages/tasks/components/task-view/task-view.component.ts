import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ITag, ITask, TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { taskDescriptionToHtml } from './task-description.util';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'basic';

export interface ITaskViewPill {
	text: string;
	tone: Tone;
	/** Tenant-defined colour from the status / priority / size row, when it has one. */
	color?: string;
	icon?: string;
}

export interface ITaskViewPerson {
	id?: string;
	name: string;
	imageUrl?: string;
	initials: string;
	hue: number;
}

const PLACEHOLDER_AVATAR = /avatar-default\.svg|dummyimage\.com/i;

/**
 * Read-only task detail, laid out like an issue tracker's issue view: key and
 * project on top, the title, the workflow pills, a details panel, then the
 * description rendered from markdown or rich text.
 *
 * Everything the template shows is derived once per `task` change, so the
 * template itself holds no method calls.
 */
@Component({
	selector: 'ngx-task-view',
	templateUrl: './task-view.component.html',
	styleUrls: ['./task-view.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class TaskViewComponent implements OnChanges {
	@Input() task: ITask;

	taskNumber: string;
	parentNumber: string;
	parentTitle: string;
	status: ITaskViewPill;
	priority: ITaskViewPill;
	size: ITaskViewPill;
	assignees: ITaskViewPerson[] = [];
	reporter: ITaskViewPerson;
	teams: { name: string; count: number }[] = [];
	tagsHost: { tags: ITag[] };
	estimate: string;
	isOverdue = false;
	descriptionHtml = '';
	detailsOpen = true;
	/** Avatar URLs that failed to load — those people fall back to their initials. */
	readonly brokenImages = new Set<string>();

	constructor(private readonly translate: TranslateService) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['task']) {
			this.build(this.task);
		}
	}

	private build(task: ITask): void {
		if (!task) {
			return;
		}
		// `taskNumber` is a server-side virtual column (prefix + number), absent from ITask.
		const { taskNumber, parent } = task as any;
		this.taskNumber = taskNumber;
		this.parentNumber = parent?.taskNumber;
		this.parentTitle = parent?.title;

		this.status = this.toStatus(task);
		this.priority = this.toPriority(task);
		this.size = this.toSize(task);

		this.assignees = (task.members || []).map((member) => this.toPerson(member)).filter(Boolean);
		this.reporter = this.toPerson(task.createdByUser);
		this.teams = (task.teams || []).map((team) => ({ name: team.name, count: team.members?.length || 0 }));
		this.tagsHost = task.tags?.length ? { tags: task.tags } : null;
		this.estimate = this.formatEstimate(task.estimate);

		const finished = [TaskStatusEnum.COMPLETED, TaskStatusEnum.DONE, TaskStatusEnum.CANCELLED];
		this.isOverdue =
			!!task.dueDate && !finished.includes(task.status) && new Date(task.dueDate).getTime() < Date.now();

		this.descriptionHtml = taskDescriptionToHtml(task.description);
	}

	private toStatus(task: ITask): ITaskViewPill {
		const raw = task.taskStatus?.name || task.status;
		if (!raw) {
			return null;
		}
		// A standard status arrives as its enum slug ('in-progress'); a tenant one is already a name.
		const text = raw.replace(/-/g, ' ');
		const color = task.taskStatus?.color;
		switch (task.status) {
			case TaskStatusEnum.COMPLETED:
			case TaskStatusEnum.DONE:
				return { text, color, tone: 'success' };
			case TaskStatusEnum.BLOCKED:
			case TaskStatusEnum.CANCELLED:
				return { text, color, tone: 'danger' };
			case TaskStatusEnum.IN_PROGRESS:
			case TaskStatusEnum.READY_FOR_REVIEW:
			case TaskStatusEnum.IN_REVIEW:
				return { text, color, tone: 'info' };
			default:
				return { text, color, tone: 'basic' };
		}
	}

	private toPriority(task: ITask): ITaskViewPill {
		const text = task.taskPriority?.name || task.priority;
		if (!text) {
			return null;
		}
		const color = task.taskPriority?.color;
		switch (task.priority) {
			case TaskPriorityEnum.URGENT:
				return { text, color, tone: 'danger', icon: 'arrowhead-up-outline' };
			case TaskPriorityEnum.HIGH:
				return { text, color, tone: 'warning', icon: 'arrow-upward-outline' };
			case TaskPriorityEnum.LOW:
				return { text, color, tone: 'success', icon: 'arrow-downward-outline' };
			default:
				return { text, color, tone: 'info', icon: 'minus-outline' };
		}
	}

	private toSize(task: ITask): ITaskViewPill {
		const text = task.taskSize?.name || task.size;
		return text ? { text, color: task.taskSize?.color, tone: 'primary', icon: 'maximize-outline' } : null;
	}

	/** Accepts an employee or a user and flattens it to a name + avatar. */
	private toPerson(value: any): ITaskViewPerson {
		if (!value) {
			return null;
		}
		const user = value.user || value;
		const name =
			value.fullName ||
			[user.firstName, user.lastName].filter(Boolean).join(' ') ||
			user.name ||
			user.email;
		if (!name) {
			return null;
		}
		const initials = name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part: string) => part[0].toUpperCase())
			.join('');
		const imageUrl = value.imageUrl || user.imageUrl;
		return {
			id: value.id,
			name,
			// The seeded / generated placeholders are a grey silhouette or a letter
			// on black — coloured initials read better than either.
			imageUrl: PLACEHOLDER_AVATAR.test(imageUrl || '') ? null : imageUrl,
			initials,
			hue: TaskViewComponent.hueOf(name)
		};
	}

	/** A stable hue per name, so the same person always gets the same colour. */
	private static hueOf(name: string): number {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash * 31 + name.charCodeAt(i)) | 0;
		}
		return Math.abs(hash) % 360;
	}

	/** Estimate is stored in seconds — shown as days / hours / minutes, zero parts skipped. */
	private formatEstimate(estimate: number): string {
		if (!estimate) {
			return null;
		}
		const days = Math.floor(estimate / (24 * 60 * 60));
		const hours = Math.floor((estimate % (24 * 60 * 60)) / (60 * 60));
		const minutes = Math.floor((estimate % (60 * 60)) / 60);
		return [
			days ? `${days} ${this.translate.instant('TASKS_PAGE.ESTIMATE_DAYS')}` : null,
			hours ? `${hours} ${this.translate.instant('TASKS_PAGE.ESTIMATE_HOURS')}` : null,
			minutes ? `${minutes} ${this.translate.instant('TASKS_PAGE.ESTIMATE_MINUTES')}` : null
		]
			.filter(Boolean)
			.join(' ');
	}
}
