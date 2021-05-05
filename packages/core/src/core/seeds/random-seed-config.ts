export const randomSeedConfig = {
	tenants: 5, //The number of random tenants to be seeded.
	organizationsPerTenant: 2, //No of random organizations seeded will be (organizationsPerTenant * tenants)
	employeesPerOrganization: 5, //No of random employees seeded will be (employeesPerOrganization * organizationsPerTenant * tenants)
	candidatesPerOrganization: 2, //No of random employees seeded will be (candidatesPerOrganization * organizationsPerTenant * tenants)
	managersPerOrganization: 2, //No of random manager seeded will be (managersPerOrganization * organizationsPerTenant * tenants)
	dataEntriesPerOrganization: 4, //No of random data entry users seeded will be (dataEntriesPerOrganization * organizationsPerTenant * tenants)
	viewersPerOrganization: 4, //No of random viewers seeded will be (viewersPerOrganization * organizationsPerTenant * tenants)
	projectsPerOrganization: 30, // No of random projects seeded will be  (projectsPerOrganization * organizationsPerTenant * tenants)
	emailsPerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	invitePerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	requestApprovalPerOrganization: 20, // No of random request to approve seeded will be  (requestApprovalPerOrganization * organizationsPerTenant * tenants)
	employeeTimeOffPerOrganization: 10, // No of time off request to approve seeded will be  (employeeTimeOffPerOrganization * organizationsPerTenant * tenants)
	equipmentPerTenant: 20, // No of equipmentPerTenant request to approve seeded will be  (equipmentPerTenant * tenants)
	equipmentSharingPerTenant: 20, // No of equipmentSharingPerTenant request to approve seeded will be  (equipmentSharingPerTenant * tenants)
	proposalsSharingPerOrganizations: 30, // No of proposalsSharingPerOrganizations request to approve seeded will be  (proposalsSharingPerOrganizations * tenants * organizations)
	contacts: 50, // The number of random contacts to be seeded.
	noOfHelpCenterArticle: 10, // The number of random Help Center Articles.
	availabilitySlotsPerOrganization: 50, // No of availability slots request to approve seeded will be  (availabilitySlotsPerOrganization * organizationsPerTenant * tenants)
	noOfTimeLogsPerTimeSheet: 5, // No of time logs entry per time sheets
	numberOfOptionPerProduct: 5, // number of product options per product
	numberOfOptionGroupPerProduct: 5, // number of product options group per product
	numberOfVariantPerProduct: 5, // number of product variant per product
	numberOfInvoicePerOrganization: 50, // number of invoice per organizations
	numberOfInvoiceItemPerInvoice: 20, // number of invoice item per invoices
	noOfRandomContacts: 5 // number of random contact per organization
};
