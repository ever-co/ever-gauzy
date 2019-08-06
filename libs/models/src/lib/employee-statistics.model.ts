export interface EmployeeStatisticsFindInput {
    valueDate: Date
}

export interface EmployeeStatistics {
    expenseStatistics: number[],
    incomeStatistics: number[],
    profitStatistics: number[],
    bonusStatistics: number[]
}