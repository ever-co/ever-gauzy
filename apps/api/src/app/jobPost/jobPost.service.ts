import { Repository } from 'typeorm';
import { JobPost } from './jobPost.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApolloServer, gql } from 'apollo-server-micro';
import { graphql, buildSchema } from 'graphql';

const schema = buildSchema(`
type Query {
	getSingleEmp(employee: String!): Course
    getAllEmp: [Course]
},
type Course {
	title: String
	description: String
	created: String
	source : String
	status : String
	employee : String,
	actions: String
}
`);

const coursesData = [
	{
		title: 'The Complete Node.js Developer Course',
		employee: '',
		description:
			'Learn Node.js by building real-world applications with Node, Express, MongoDB, Mocha, and more!',
		created: '10-10-2020',
		source: 'Upwork',
		status: 'Open',
		actions: 'Apply'
	},
	{
		title: 'Node.js, Express & MongoDB Dev to Deployment',
		employee: '123456498',
		description:
			'Learn by example building & deploying real-world Node.js applications from absolute scratch',
		created: '06-10-2020',
		source: 'Freelancer',
		status: 'Applied',
		actions: 'View'
	},
	{
		title: 'JavaScript: Understanding The Weird Parts',
		employee: '',
		description:
			'An advanced JavaScript course for everyone! Scope, closures, prototypes, this, build your own framework, and more.',
		created: '17-10-2020',
		source: 'Upwork',
		status: 'Open',
		actions: 'Apply'
	}
];

const getAll = function () {
	return coursesData;
};
const getSingle = function (args) {
	const employee = args.employee;
	return coursesData.filter((course) => {
		return course.employee === employee;
	})[0];
};

const root = {
	getSingleEmp: getSingle,
	getAllEmp: getAll
};

const listOfDisplayField =
	'title,employee, description, created, source, status, actions';

@Injectable()
export class JobPostService extends CrudService<JobPost> {
	constructor(
		@InjectRepository(JobPost)
		private readonly jobPostRepository: Repository<JobPost>
	) {
		super(jobPostRepository);
	}

	async findAllRecord(employeeId: string): Promise<any> {
		console.log('employeeId', employeeId);
		let query = '';
		if (employeeId !== ' ' && employeeId !== undefined) {
			query =
				'{ getSingleEmp(employee: ' +
				employeeId.toString() +
				') { ' +
				listOfDisplayField +
				' }}';
		} else {
			query = '{ getAllEmp { ' + listOfDisplayField + ' }}';
		}

		console.log('====>', query.toString());

		const response = await graphql(schema, query.toString(), root);

		console.log('response', response);

		return response;
	}
}
