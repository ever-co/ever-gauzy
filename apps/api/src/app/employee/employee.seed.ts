import { Connection } from "typeorm";
import { Employee } from './employee.entity';
import { Organization } from '../organization';
import { User } from '../user';

export const createEmployees = async (
    connection: Connection,
    defaultData: {
        org: Organization
        users: User[]
    },
    randomData: {
        orgs: Organization[]
        users: User[]
    }
): Promise<{ defaultEmployees: Employee[], randomEmployees: Employee[] }> => {
    const defaultEmployees: Employee[] = await createDefaultEmployees(
        connection, defaultData
    );

    const randomEmployees: Employee[] = await createRandomEmployees(
        connection, randomData
    );

    return { defaultEmployees, randomEmployees }
};

const createDefaultEmployees = async (connection: Connection,
    defaultData: {
        org: Organization
        users: User[]
    }): Promise<Employee[]> => {
    let employee: Employee;
    const employees: Employee[] = [];
    const defaultUsers = defaultData.users;
    const defaultOrg = defaultData.org;

    for (const user of defaultUsers) {
        employee = new Employee();
        employee.organization = defaultOrg;
        employee.user = user;

        await insertEmployee(connection, employee);

        employees.push(employee);
    }

    return employees;
}

const createRandomEmployees = async (connection: Connection,
    randomData: {
        orgs: Organization[]
        users: User[]
    }): Promise<Employee[]> => {
    let employee: Employee;
    const employees: Employee[] = [];
    const randomUsers = randomData.users;
    const randomOrgs = randomData.orgs;

    const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

    for (const orgs of randomOrgs) {
        if (randomUsers.length) {
            for (let index = 0; index < averageUsersCount; index++) {
                employee = new Employee();
                employee.organization = orgs;
                employee.user = randomUsers.pop();

                if (employee.user) {
                    await insertEmployee(connection, employee);
                    employees.push(employee);
                }
            }
        }
    }

    return employees;
}

const insertEmployee = async (connection: Connection, employee: Employee): Promise<void> => {
    await connection
        .createQueryBuilder()
        .insert()
        .into(Employee)
        .values(employee)
        .execute();
}
