import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbToggleModule,
	NbTooltipDirective,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { IOrganization } from '@gauzy/contracts';
import { OrganizationAwardsService, OrganizationLanguagesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { PublicPageOrganizationMutationComponent } from './public-page-organization-mutation.component';

/*
 * Stand-ins for the shared widgets the dialog embeds on its other tabs: they are not what this spec
 * is about, and the real ones fetch skills and languages on creation.
 */
@Component({
	selector: 'ga-rich-text-editor',
	template: '',
	providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorStubComponent), multi: true }]
})
class RichTextEditorStubComponent implements ControlValueAccessor {
	@Input() preset: string;
	@Input() outputFormat: string;
	@Input() minHeight: string;
	writeValue(): void {}
	registerOnChange(): void {}
	registerOnTouched(): void {}
}

@Component({ selector: 'ngx-skills-input', template: '' })
class SkillsInputStubComponent {
	@Input() form: unknown;
	@Input() selectedSkills: unknown;
	@Output() selectedSkillsEvent = new EventEmitter<unknown>();
}

@Component({ selector: 'ngx-language-selector', template: '' })
class LanguageSelectorStubComponent {
	@Input() clearable: boolean;
	@Input() addTag: boolean;
	@Input() template: string;
	@Input() selectBy: string;
	@Output() selectedLanguageEvent = new EventEmitter<unknown>();
}

describe('PublicPageOrganizationMutationComponent — the banner field explains itself', () => {
	let fixture: ComponentFixture<PublicPageOrganizationMutationComponent>;

	const organization = {
		id: 'organization-1',
		name: 'Ever Technologies LTD',
		banner: 'We build open-source business software',
		currency: 'USD',
		registrationDate: new Date(2015, 0, 1),
		skills: []
	} as unknown as IOrganization;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [PublicPageOrganizationMutationComponent],
			imports: [
				FormsModule,
				ReactiveFormsModule,
				NbButtonModule,
				NbCardModule,
				NbIconModule,
				NbInputModule,
				NbSelectModule,
				NbToggleModule,
				NbTooltipModule,
				NgSelectModule,
				RichTextEditorStubComponent,
				SkillsInputStubComponent,
				LanguageSelectorStubComponent
			],
			providers: [
				{ provide: Store, useValue: { user: { tenantId: 'tenant-1' } } },
				{ provide: ToastrService, useValue: { success: jest.fn(), danger: jest.fn() } },
				{ provide: OrganizationAwardsService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) } },
				{ provide: OrganizationLanguagesService, useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) } }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(PublicPageOrganizationMutationComponent);
		fixture.componentInstance.organization = organization;
		fixture.detectChanges();
	});

	const bannerInput = (): HTMLInputElement => fixture.debugElement.query(By.css('input#banner')).nativeElement;

	it('shows an example in the placeholder instead of repeating the label', () => {
		// No loader in unit tests: the translate pipe renders the key itself.
		expect(bannerInput().placeholder).toBe('POP_UPS.BANNER_PLACEHOLDER');
	});

	it('puts an info button beside the label that explains what the banner is', () => {
		const hint = fixture.debugElement.query(By.css('.label-row .hint-button'));

		expect(hint).toBeTruthy();
		expect(hint.nativeElement.getAttribute('type')).toBe('button');
		expect(hint.nativeElement.getAttribute('aria-label')).toBe('POP_UPS.BANNER_HINT');
		expect(hint.injector.get(NbTooltipDirective).content).toBe('POP_UPS.BANNER_HINT');
	});

	it('still edits the banner the organization already has', () => {
		expect(bannerInput().value).toBe('We build open-source business software');
	});
});
