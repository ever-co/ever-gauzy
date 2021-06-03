import {Component, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { OrganizationContactService, Store } from '../../@core/services';
import { IOrganization, IOrganizationContact } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject } from 'rxjs/internal/Subject';

@UntilDestroy({ checkProperties: true })
@Component({
    template: `
        <ng-select
            [items]="organizationContacts"
            appendTo="body"
            bindName="name"
            bindValue="id"
            [clearable]="true"
            [closeOnSelect]="true"
            [placeholder]="'POP_UPS.ALL_CONTACTS' | translate"
            (change)="onChange($event)"
        >
            <ng-template
                ng-option-tmp
                let-item="item"
                let-index="index"
            >
                {{ item.name }}
            </ng-template>
            <ng-template ng-label-tmp let-item="item">
                <div class="selector-template">
                    <span>{{ item.name }}</span>
                </div>
            </ng-template>
        </ng-select>
    `,
})
export class OrganizationContactFilterComponent extends DefaultFilter implements OnInit, OnChanges {
    
    organizationContacts: IOrganizationContact[];
	subject$: Subject<any> = new Subject();
    organization: IOrganization;

    constructor(
        private readonly organizationContactService: OrganizationContactService,
        private readonly store: Store,
    ) {
        super();
    }

    ngOnInit() { 
        this.subject$
            .pipe(
                tap(() => this.getContacts()),
                untilDestroyed(this)
            )
            .subscribe();
        this.store.selectedOrganization$
            .pipe(
                filter((organization: IOrganization) => !!organization),
                tap((organization) => this.organization = organization),
                tap(() => this.subject$.next())
            ).subscribe();
    }

    async getContacts() {
        const { id: organizationId } = this.organization;
        const { tenantId } = this.store.user;

        const { items = [] } = await this.organizationContactService.getAll([], { 
            organizationId, 
            tenantId 
        });
        this.organizationContacts = items;
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }
}