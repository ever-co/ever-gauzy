import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { SimService, SimStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim-workflows',
	templateUrl: './sim-workflows.component.html',
	styleUrls: ['./sim-workflows.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimWorkflowsComponent extends TranslationBaseComponent implements OnInit {
	private readonly _simService = inject(SimService);
	private readonly _simStoreService = inject(SimStoreService);

	readonly validating = signal<boolean>(false);
	readonly executing = signal<boolean>(false);
	readonly pollingJob = signal<boolean>(false);

	readonly validationResult = signal<{ workflowId: string; isDeployed: boolean } | null>(null);
	readonly executionResult = signal<Record<string, unknown> | null>(null);
	readonly jobStatus = signal<Record<string, unknown> | null>(null);
	readonly executionError = signal<string | null>(null);

	readonly integrationId = signal<string>('');

	// Validate form
	validateForm = new FormGroup({
		workflowId: new FormControl('', [Validators.required, Validators.pattern(/\S+/)])
	});

	// Execute form
	executeForm = new FormGroup({
		workflowId: new FormControl('', [Validators.required, Validators.pattern(/\S+/)]),
		input: new FormControl('{}'),
		runAsync: new FormControl(false),
		timeout: new FormControl(30000)
	});

	// Job status form
	jobForm = new FormGroup({
		taskId: new FormControl('', [Validators.required, Validators.pattern(/\S+/)])
	});

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._simStoreService.selectedIntegrationId$
			.pipe(
				filter((id): id is string => !!id),
				tap((id) => {
					this.integrationId.set(id);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Validate if a workflow is deployed and ready.
	 */
	validateWorkflow(): void {
		if (this.validateForm.invalid || this.validating()) return;

		this.validating.set(true);
		this.validationResult.set(null);

		const workflowId = this.validateForm.get('workflowId')?.value?.trim();

		this._simService.validateWorkflow(workflowId).pipe(untilDestroyed(this)).subscribe({
			next: (result) => {
				this.validationResult.set(result);
				this.validating.set(false);
			},
			error: () => {
				this.validationResult.set({ workflowId, isDeployed: false });
				this.validating.set(false);
			}
		});
	}

	/**
	 * Execute a SIM workflow.
	 */
	executeWorkflow(): void {
		if (this.executeForm.invalid || this.executing()) return;

		this.executing.set(true);
		this.executionResult.set(null);
		this.executionError.set(null);

		const workflowId = this.executeForm.get('workflowId')?.value?.trim();
		const inputRaw = this.executeForm.get('input')?.value?.trim() || '{}';
		const runAsync = this.executeForm.get('runAsync')?.value || false;
		const timeout = this.executeForm.get('timeout')?.value || 30000;

		let input: unknown;
		try {
			input = JSON.parse(inputRaw);
		} catch {
			this.executionError.set(this.getTranslation('INTEGRATIONS.SIM_PAGE.WORKFLOWS.INVALID_JSON'));
			this.executing.set(false);
			return;
		}

		this._simService.executeWorkflow(workflowId, { input, runAsync, timeout }).pipe(untilDestroyed(this)).subscribe({
			next: (result) => {
				this.executionResult.set(result);
				this.executing.set(false);

				// If async, pre-fill the job status form
				if (result?.taskId) {
					this.jobForm.get('taskId')?.setValue(result.taskId);
				}
			},
			error: (err) => {
				this.executionError.set(
					err?.error?.message || err?.message || this.getTranslation('INTEGRATIONS.SIM_PAGE.WORKFLOWS.EXECUTION_FAILED')
				);
				this.executing.set(false);
			}
		});
	}

	/**
	 * Check async job status.
	 */
	checkJobStatus(): void {
		if (this.jobForm.invalid || this.pollingJob()) return;

		this.pollingJob.set(true);
		this.jobStatus.set(null);

		const taskId = this.jobForm.get('taskId')?.value?.trim();

		this._simService.getJobStatus(taskId).pipe(untilDestroyed(this)).subscribe({
			next: (result) => {
				this.jobStatus.set(result);
				this.pollingJob.set(false);
			},
			error: () => {
				this.pollingJob.set(false);
			}
		});
	}
}
