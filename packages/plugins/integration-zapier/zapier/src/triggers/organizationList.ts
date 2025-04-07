import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
  const tenantId = bundle.inputData.tenantId;

  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  try {
    const response = await z.request({
      url: `${process.env.API_BASE_URL}/api/organization`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bundle.authData['access_token']}`,
      },
      params: {
        tenantId: tenantId
      }
    });

    return response.data.items.map((org: any) => ({
      id: org.id,
      name: org.name
    }));
  } catch (error) {
    z.console.error('Error fetching organizations:', error);
    throw new Error('Failed to fetch organizations');
  }
};

export default {
  key: 'organization_list',
  noun: 'Organization',
  display: {
    label: 'Organization List',
    description: 'Gets a list of organizations.',
    hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
  },
  operation: {
    inputFields: [
      {
        key: 'tenantId',
        type: 'string',
        label: 'Tenant',
        required: true,
        dynamic: 'tenant_list.id.name',
        helpText: 'Select the tenant to get organizations for'
      }
    ],
    perform,
    sample: {
      id: 'b894c374-7374-43cb-a1a2-afe46b9f5e28',
      name: 'Default Organization'
    }
  }
};
