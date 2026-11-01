import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ComponentLayoutStyleEnum, IDeal, IPipeline } from '@gauzy/contracts';
import { DealsService, ErrorHandlingService, PipelinesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { PipelineDealsComponent } from './pipeline-deals.component';

/** The deals page lists a pipeline's deals, narrowed to one stage when the stage filter says so. */
describe('PipelineDealsComponent', () => {
	const deal = (id: string, stageId: string) => ({ id, title: `Deal ${id}`, stageId }) as IDeal;

	const page = (): PipelineDealsComponent => {
		const component = new PipelineDealsComponent(
			{ instant: (key: string) => key, onLangChange: of() } as unknown as TranslateService,
			{ detectChanges: jest.fn(), markForCheck: jest.fn() } as unknown as ChangeDetectorRef,
			{} as DealsService,
			{} as NbDialogService,
			{} as PipelinesService,
			{} as ToastrService,
			{ componentLayout$: () => of(ComponentLayoutStyleEnum.TABLE) } as unknown as Store,
			{} as ActivatedRoute,
			{ handleError: jest.fn() } as unknown as ErrorHandlingService,
			{} as Router
		);
		component.pipeline = {
			id: 'pipeline-1',
			stages: [
				{ id: 'lead', name: 'Lead' },
				{ id: 'won', name: 'Won' }
			]
		} as IPipeline;
		return component;
	};

	it('keeps the list narrowed to the chosen stage when the deals are read again', async () => {
		const component = page();
		component.stageFormControl.setValue('lead');

		// The deals read again, for example once moves made on the board have saved.
		await component.getPipelineDeals([deal('a', 'lead'), deal('b', 'won'), deal('c', 'lead')]);

		const shown = (await component.smartTableSource.getElements()) as IDeal[];
		expect(shown.map(({ id }) => id)).toEqual(['a', 'c']);
	});

	it('lists every stage when no stage is chosen', async () => {
		const component = page();

		await component.getPipelineDeals([deal('a', 'lead'), deal('b', 'won')]);

		const shown = (await component.smartTableSource.getElements()) as IDeal[];
		expect(shown.map(({ id }) => id)).toEqual(['a', 'b']);
	});
});
