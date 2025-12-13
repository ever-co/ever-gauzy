import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { IPluginCategory } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, take, tap } from 'rxjs';
import { PluginCategoryActions } from '../../+state/actions/plugin-category.action';
import { PluginCategoryQuery } from '../../+state/queries/plugin-category.query';
import { CreateCategoryDialogComponent } from '../create-category-dialog/create-category-dialog.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-category-selector',
	templateUrl: './category-selector.component.html',
	styleUrls: ['./category-selector.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategorySelectorComponent implements OnInit {
	private skip = 0;
	private hasNext = false;
	private readonly take = 20;

	@Input() public allowCreate = true;

	constructor(
		private readonly actions: Actions,
		public readonly query: PluginCategoryQuery,
		private readonly dialogService: NbDialogService
	) {}

	ngOnInit(): void {
		this.load();
		this.setupPagination();
	}

	private setupPagination(): void {
		this.query.hasNext$
			.pipe(
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): void {
		this.actions.dispatch(
			PluginCategoryActions.loadAll({
				skip: this.skip,
				take: this.take,
				order: { order: 'ASC', name: 'ASC' }
			})
		);
	}

	public loadMore(): void {
		if (this.hasNext && this.unlockInfiniteList) {
			this.skip += this.take;
			this.actions.dispatch(PluginCategoryActions.loadMore());
		}
	}

	public onCategoryChange(id: IPluginCategory['id']): void {
		const category = this.query.getCategoryById(id);
		if (category) {
			this.actions.dispatch(PluginCategoryActions.selectCategory(category));
		}
	}

	public onAddCategory = (name: string): void => {
		this.dialogService
			.open(CreateCategoryDialogComponent, {
				context: { name }
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap((newCategory: IPluginCategory) => {
					// Select the newly created category
					this.actions.dispatch(PluginCategoryActions.selectCategory(newCategory));
				}),
				untilDestroyed(this)
			)
			.subscribe();
	};

	public get unlockInfiniteList(): boolean {
		return this.query.categories.length > 0;
	}

	public reset(): void {
		this.skip = 0;
		this.hasNext = false;
		this.actions.dispatch(PluginCategoryActions.reset());
	}
}
