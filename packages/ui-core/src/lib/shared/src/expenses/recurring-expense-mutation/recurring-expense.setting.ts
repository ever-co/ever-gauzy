import {
    ComponentType,
    RecurringExpenseDefaultCategoriesEnum
} from "@gauzy/contracts";

export const DEFAULT_CATEGORIES = [
    {
        category: RecurringExpenseDefaultCategoriesEnum.SALARY,
        types: [ComponentType.EMPLOYEE]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.SALARY_TAXES,
        types: [ComponentType.EMPLOYEE]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.RENT,
        types: [ComponentType.ORGANIZATION]
    },
    {
        category: RecurringExpenseDefaultCategoriesEnum.EXTRA_BONUS,
        types: [ComponentType.EMPLOYEE, ComponentType.ORGANIZATION]
    }
];