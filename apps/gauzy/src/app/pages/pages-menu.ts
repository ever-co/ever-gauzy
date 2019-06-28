import { NbMenuItem } from '@nebular/theme';

export const MENU_ITEMS: NbMenuItem[] = [
  {
    title: 'Dashboard',
    icon: 'home-outline',
    link: '/pages/dashboard',
    home: true,
  },
  {
    title: 'Income',
    icon: 'plus-circle-outline',
    link: '/pages/income',
  },
  {
    title: 'Expenses',
    icon: 'minus-circle-outline',
    link: '/pages/expenses',
  },
  {
    title: 'Admin',
    group: true
  },
  {
    title: 'Employees',
    icon: 'people-outline',
    link: '/pages/employees',
  },
  {
    title: 'Organizations',
    // icon: '',
    link: '/pages/organizations',
  },
  {
    title: 'Settings',
    // icon: '',
    children: [
      {
        title: 'General',
        link: '/pages/settings/general',
      }
    ]
  },
];
