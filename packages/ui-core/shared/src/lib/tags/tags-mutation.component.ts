import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbThemeService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ITag } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TagsService } from '@gauzy/ui-core/core';
import { NotesWithTagsComponent } from '../table-components';

@Component({
	selector: 'ngx-tags-mutation',
	templateUrl: './tags-mutation.component.html',
	styleUrls: ['./tags-mutation.component.scss']
})
export class TagsMutationComponent extends NotesWithTagsComponent implements OnInit {
	/**
	 * Tag mutation form
	 */
	public form: UntypedFormGroup = TagsMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [null, Validators.required],
			color: [null, Validators.required],
			isTenantLevel: [false],
			description: []
		});
	}

	/*
	 * Getter & Setter for tag to edit
	 */
	_tag: ITag;
	get tag(): ITag {
		return this._tag;
	}
	@Input() public set tag(tag: ITag) {
		this._tag = tag;
		this._patchFormValue();
	}

	/**
	 * Getter for color form control
	 */
	get color() {
		return this.form.get('color').value || '';
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<TagsMutationComponent>,
		private readonly tagsService: TagsService,
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		public readonly themeService: NbThemeService,
		private readonly store: Store
	) {
		super(themeService, translateService);
	}

	ngOnInit(): void {}

	async addTag() {
		if (!this.store.selectedOrganization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;
		const { name, description, color, isTenantLevel } = this.form.getRawValue();

		const tag = await firstValueFrom(
			this.tagsService.create({
				name,
				description,
				color,
				tenantId,
				...(isTenantLevel
					? {
							organizationId: null
					  }
					: {
							organizationId
					  })
			})
		);
		this.closeDialog(tag);
	}

	async editTag() {
		if (!this.store.selectedOrganization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { name, description, color, isTenantLevel } = this.form.getRawValue();

		const tag = await firstValueFrom(
			this.tagsService.update(this.tag.id, {
				name,
				description,
				color,
				tenantId,
				...(isTenantLevel
					? {
							organizationId: null
					  }
					: {
							organizationId
					  })
			})
		);
		this.closeDialog(tag);
	}

	async closeDialog(tag?: ITag) {
		this.dialogRef.close(tag);
	}

	private _patchFormValue() {
		if (this.tag) {
			const { name, color, description, organizationId } = this.tag;
			this.form.patchValue({
				name,
				color,
				description,
				isTenantLevel: organizationId ? false : true
			});
		}
	}

	/**
	 * On changed color input
	 *
	 * @param color
	 */
	onChangeColor(color: ITag['color']) {
		this.form.get('color').setValue(color);
		this.form.get('color').updateValueAndValidity();
	}
}
