import { RecurringExpenseDefaultCategoriesEnum } from "@gauzy/contracts";

export enum COMPONENT_TYPE {
	EMPLOYEE = 'EMPLOYEE',
	ORGANIZATION = 'ORGANIZATION'
}

export const DEFAULT_CATEGORIES = [
    {
        category: RecurringExpenseDefaultCategoriesEnum.SALARY,
        types: [COMPONENT_TYPE.EMPLOYEE]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.SALARY_TAXES,
        types: [COMPONENT_TYPE.EMPLOYEE]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.RENT,
        types: [COMPONENT_TYPE.ORGANIZATION]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.EXTRA_BONUS,
        types: [COMPONENT_TYPE.EMPLOYEE, COMPONENT_TYPE.ORGANIZATION]
    }
];