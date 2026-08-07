import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
	BaseEntityEnum,
	ID,
	IDocument,
	IDocumentLink,
	IEmployee,
	IInvoice,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationTeam,
	ITask
} from '@gauzy/contracts';
import {
	EmployeesService,
	InvoicesService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	Store,
	TasksService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { DOCS_LINK_ENTITIES, IDocsLinkCandidate, IDocsLinkEntityDescriptor } from '../models/docs-link.model';
import { DocumentsService } from '../services/documents.service';

/**
 * Add-link flow for the detail panel's **Linked records** section
 * (`01-ux-spec.md` §8.9, `02-domain-model.md` `DocumentLink`): pick an entity
 * type, pick a record, create the link. `DOCS_UPDATE` — the caller gates the
 * entry point, this dialog is never reachable without it.
 *
 * Records are loaded per entity type through the existing `@gauzy/ui-core/core`
 * services rather than embedding six different shared selector components: the
 * selectors disagree on value shape (`ISelectedEmployee` vs id vs entity), two
 * of them write global navigation state, and `ga-employee-multi-select` cannot
 * render at all on Documents routes (see `share-dialog.component.ts`). One
 * uniform `nb-select` over `IDocsLinkCandidate` is both smaller and predictable.
 *
 * The label the user picked is persisted into `DocumentLink.metadata.label`, so
 * the panel can render the link without N follow-up fetches — and a record that
 * is later renamed or deleted still shows *something* instead of a bare UUID.
 */
@Component({
	selector: 'gz-docs-link-dialog',
	templateUrl: './link-dialog.component.html',
	styleUrls: ['./link-dialog.component.scss'],
	providers: [EmployeesService, InvoicesService],
	standalone: false
})
export class DocumentLinkDialogComponent extends TranslationBaseComponent implements OnInit {
	/** The document the new link hangs off. Required. */
	@Input() document!: IDocument;
	/** Links that already exist — their targets are filtered out of the picker. */
	@Input() existing: IDocumentLink[] = [];

	public readonly entities: IDocsLinkEntityDescriptor[] = DOCS_LINK_ENTITIES;

	public entity: BaseEntityEnum = DOCS_LINK_ENTITIES[0].entity;
	public candidates: IDocsLinkCandidate[] = [];
	public selectedId: ID | null = null;
	public search = '';

	public loading = false;
	public saving = false;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocumentLinkDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly tasksService: TasksService,
		private readonly projectsService: OrganizationProjectsService,
		private readonly teamsService: OrganizationTeamsService,
		private readonly employeesService: EmployeesService,
		private readonly contactsService: OrganizationContactService,
		private readonly invoicesService: InvoicesService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		void this.loadCandidates();
	}

	// ─── Entity type / record loading ────────────────────────────

	async onEntityChange(entity: BaseEntityEnum): Promise<void> {
		this.entity = entity;
		this.selectedId = null;
		this.search = '';
		await this.loadCandidates();
	}

	/**
	 * Loads the pickable records for the current entity type. Every loader is
	 * fault-isolated: a service the tenant cannot read (e.g. invoices without the
	 * accounting permission) yields an empty picker, never a broken dialog.
	 */
	async loadCandidates(): Promise<void> {
		const { organizationId, tenantId } = this.orgContext();
		if (!organizationId) {
			this.candidates = [];
			return;
		}
		this.loading = true;
		try {
			this.candidates = await this.fetchCandidates(this.entity, organizationId, tenantId);
		} catch {
			this.candidates = [];
		} finally {
			this.loading = false;
		}
	}

	private async fetchCandidates(
		entity: BaseEntityEnum,
		organizationId: ID,
		tenantId?: ID
	): Promise<IDocsLinkCandidate[]> {
		const where = { organizationId, tenantId };
		switch (entity) {
			case BaseEntityEnum.Task: {
				const result = await firstValueFrom(
					this.tasksService.getAllTasks(where).pipe(catchError(() => of({ items: [], total: 0 })))
				);
				return (result?.items ?? []).map((task: ITask) => ({
					id: task.id as ID,
					// `prefix`/`number` render the human task key (e.g. "EG-42") when present.
					label: task.number ? `${task.prefix ? `${task.prefix}-` : '#'}${task.number} · ${task.title}` : task.title
				}));
			}
			case BaseEntityEnum.OrganizationProject: {
				const result = await this.projectsService.getAll([], where);
				return (result?.items ?? []).map((project: IOrganizationProject) => ({
					id: project.id as ID,
					label: project.name
				}));
			}
			case BaseEntityEnum.OrganizationTeam: {
				const result = await this.teamsService.getAll([], where);
				return (result?.items ?? []).map((team: IOrganizationTeam) => ({
					id: team.id as ID,
					label: team.name
				}));
			}
			case BaseEntityEnum.Employee: {
				const result = await firstValueFrom(
					this.employeesService
						.getAll(['user'], where)
						.pipe(catchError(() => of({ items: [], total: 0 })))
				);
				return (result?.items ?? []).map((employee: IEmployee) => ({
					id: employee.id as ID,
					label:
						employee.fullName ||
						employee.user?.name ||
						[employee.user?.firstName, employee.user?.lastName].filter(Boolean).join(' ') ||
						String(employee.id)
				}));
			}
			case BaseEntityEnum.OrganizationContact: {
				const result = await this.contactsService.getAll([], where);
				return (result?.items ?? []).map((contact: IOrganizationContact) => ({
					id: contact.id as ID,
					label: contact.name
				}));
			}
			case BaseEntityEnum.Invoice: {
				const result = await this.invoicesService.getAll(where);
				return (result?.items ?? []).map((invoice: IInvoice) => ({
					id: invoice.id as ID,
					label: `#${invoice.invoiceNumber ?? invoice.id}`
				}));
			}
			default:
				return [];
		}
	}

	// ─── Picker ──────────────────────────────────────────────────

	/** Already-linked targets are hidden — `DocumentLink` is idempotent per (document, entity, entityId). */
	get filtered(): IDocsLinkCandidate[] {
		const linked = new Set(
			(this.existing ?? [])
				.filter((link) => link.entity === this.entity)
				.map((link) => String(link.entityId))
		);
		const term = this.search.trim().toLowerCase();
		return this.candidates
			.filter((candidate) => !linked.has(String(candidate.id)))
			.filter((candidate) => !term || candidate.label.toLowerCase().includes(term));
	}

	get canConfirm(): boolean {
		return !!this.selectedId && !this.saving;
	}

	async confirm(): Promise<void> {
		if (!this.canConfirm || !this.document) return;
		const candidate = this.candidates.find((entry) => String(entry.id) === String(this.selectedId));
		const { organizationId, tenantId } = this.orgContext();
		this.saving = true;
		try {
			const link = await firstValueFrom(
				this.documentsService.createLink({
					documentId: this.document.id as ID,
					entity: this.entity,
					entityId: this.selectedId as ID,
					// Display label captured at link time (spec 02 `DocumentLink.metadata`).
					metadata: { label: candidate?.label ?? '' },
					organizationId,
					tenantId
				})
			);
			this.toastrService.success(this.getTranslation('DOCS.LINKS.TOAST_ADDED'));
			this.dialogRef.close(link);
		} catch (error) {
			this.toastrService.danger(error);
			this.saving = false;
		}
	}

	cancel(): void {
		this.dialogRef.close(null);
	}

	trackCandidate(_: number, candidate: IDocsLinkCandidate): string {
		return String(candidate.id);
	}

	private orgContext(): { organizationId?: ID; tenantId?: ID } {
		const organization = this.store.selectedOrganization;
		return organization ? { organizationId: organization.id, tenantId: organization.tenantId } : {};
	}
}
