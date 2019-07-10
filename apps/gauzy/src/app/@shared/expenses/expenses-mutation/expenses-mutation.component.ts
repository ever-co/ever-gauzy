import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
    selector: 'ga-expenses-mutation',
    templateUrl: './expenses-mutation.component.html',
    styleUrls: ['./expenses-mutation.component.scss']
})
export class ExpensesMutationComponent implements OnInit, OnDestroy {
    

    fakeVendors = [
        {
            vendorName: 'Microsoft',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Google',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'CaffeeMania',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'CoShare',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Cleaning Company',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'Udemy',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            vendorName: 'MultiSport',
            vendorId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    fakeCategories = [
        {
            categoryName: 'Rent',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Office Supplies',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Parking',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Employees Benefits',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Courses',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Software Products',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        },
        {
            categoryName: 'Office Hardware',
            categoryId: (Math.floor(Math.random() * 101) + 1).toString()
        }
    ];

    constructor(protected dialogRef: NbDialogRef<ExpensesMutationComponent>,
                ) { }

    ngOnInit() {
        // TODO: subscribe to selectedEmployee & selectedOrganization
        
    }


    ngOnDestroy() {
        
    }
}
