import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import {
	NbButtonModule,
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbOverlayContainerAdapter,
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
	// The overview editor's value is not under test: the stand-in only has to be a form control.
	writeValue(): void {
		/* nothing to render */
	}
	registerOnChange(): void {
		/* never changes */
	}
	registerOnTouched(): void {
		/* never touched */
	}
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
				{
					provide: OrganizationAwardsService,
					useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) }
				},
				{
					provide: OrganizationLanguagesService,
					useValue: { getAll: jest.fn().mockResolvedValue({ items: [] }) }
				}
			]
		}).compileComponents();

		// The app's <nb-layout> hosts Nebular's overlays; without one here, the body does, so tooltips can open.
		TestBed.inject(NbOverlayContainerAdapter).setContainer(document.body);

		fixture = TestBed.createComponent(PublicPageOrganizationMutationComponent);
		fixture.componentInstance.organization = organization;
		fixture.detectChanges();
	});

	afterEach(() => {
		TestBed.inject(NbOverlayContainerAdapter).clearContainer();
		document.body.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
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

	describe('the hint opens for every way of reaching the button', () => {
		const hint = () => fixture.debugElement.query(By.css('.label-row .hint-button'));
		const tooltip = (): NbTooltipDirective => hint().injector.get(NbTooltipDirective);

		it.each([
			['mouseenter', 'mouseleave'],
			['focus', 'blur']
		])('opens on %s and closes on %s', (open, close) => {
			expect(tooltip().isShown).toBe(false);

			hint().triggerEventHandler(open, {});
			expect(tooltip().isShown).toBe(true);

			hint().triggerEventHandler(close, {});
			expect(tooltip().isShown).toBe(false);
		});

		it('opens on click or tap, and Escape closes it', () => {
			hint().nativeElement.click();
			expect(tooltip().isShown).toBe(true);

			hint().nativeElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
			expect(tooltip().isShown).toBe(false);
		});

		it('Escape on an open hint does not also close the dialog (and lose the edits)', () => {
			// The dialog closes on an Escape keyup that reaches the document.
			const reachesDialog = jest.fn();
			document.addEventListener('keyup', reachesDialog);
			const escape = () =>
				hint().nativeElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

			try {
				hint().nativeElement.click();
				escape();
				expect(tooltip().isShown).toBe(false);
				expect(reachesDialog).not.toHaveBeenCalled();

				// With the hint already closed, Escape closes the dialog as before.
				escape();
				expect(reachesDialog).toHaveBeenCalledTimes(1);
			} finally {
				document.removeEventListener('keyup', reachesDialog);
			}
		});

		it('Escape closes a hint opened by hover while focus stays in the banner field, and only the hint', () => {
			const reachesDialog = jest.fn();
			document.addEventListener('keyup', reachesDialog);

			try {
				bannerInput().focus();
				hint().triggerEventHandler('mouseenter', {});
				expect(tooltip().isShown).toBe(true);

				bannerInput().dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

				expect(tooltip().isShown).toBe(false);
				expect(reachesDialog).not.toHaveBeenCalled();
			} finally {
				document.removeEventListener('keyup', reachesDialog);
			}
		});
	});

	it('still edits the banner the organization already has', () => {
		expect(bannerInput().value).toBe('We build open-source business software');
	});
});
