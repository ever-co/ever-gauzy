import { Component, OnDestroy, OnInit } from '@angular/core';
import { ComponentLayoutStyleEnum, IUser } from '@gauzy/contracts';
import { UsersService } from 'apps/gauzy/src/app/@core';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-layout-selector',
	templateUrl: './layout-selector.component.html',
	styleUrls: ['./layout-selector.component.scss']
})
export class LayoutSelectorComponent implements OnInit, OnDestroy {
	componentLayouts = Object.keys(ComponentLayoutStyleEnum);
	currentLayout: string = ComponentLayoutStyleEnum.TABLE;
	user: IUser;
	constructor(
		private readonly store: Store,
		private readonly userService: UsersService
	) {}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				untilDestroyed(this)
			)
			.subscribe((user) => {
				if (user) {
					if (
						user.preferredComponentLayout &&
						user.preferredComponentLayout !== this.currentLayout
					) {
						this.currentLayout = user.preferredComponentLayout;
					}
					this.switchComponentLayout();
				}
			});
		this.store.preferredComponentLayout$
			.pipe(
				filter((preferredLayout: string) => !!preferredLayout),
				untilDestroyed(this)
			)
			.subscribe((preferredLayout) => {
				if (preferredLayout && preferredLayout !== this.currentLayout) {
					this.currentLayout = preferredLayout;
				}
			});
	}
	switchComponentLayout(selectedStyle?: ComponentLayoutStyleEnum) {
		this.store.preferredComponentLayout =
			selectedStyle || this.currentLayout;

		this.changePreferredComponentLayout({
			preferredComponentLayout: selectedStyle || this.currentLayout
		});
	}

	resetLayoutForAllComponents() {
		this.store.componentLayout = [];
	}

	private async changePreferredComponentLayout(request: any) {
		if (!this.user) {
			return;
		}
		try {
			await this.userService.updatePreferredComponentLayout(
				this.user.id,
				request
			);
		} catch (error) {
			console.error(`Failed to update user preferred component layout`);
		}
	}

	ngOnDestroy(): void {}
}
