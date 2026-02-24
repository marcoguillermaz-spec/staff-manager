import type { Role } from './types';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  collaboratore: [
    { label: 'Dashboard',   href: '/',            icon: '🏠' },
    { label: 'Profilo',     href: '/profilo',     icon: '👤' },
    { label: 'Compensi',    href: '/compensi',    icon: '💶' },
    { label: 'Rimborsi',    href: '/rimborsi',    icon: '🧾' },
    { label: 'Documenti',   href: '/documenti',   icon: '📄' },
    { label: 'Ticket',      href: '/ticket',      icon: '🎫' },
    { label: 'Contenuti',   href: '/contenuti',   icon: '📋' }, // bacheca + benefit + guide + eventi
  ],

  responsabile: [
    { label: 'Profilo',      href: '/profilo',      icon: '👤' },
    { label: 'Approvazioni', href: '/approvazioni', icon: '✅' },
    { label: 'Collaboratori',href: '/collaboratori',icon: '👥' },
    { label: 'Documenti',    href: '/documenti',    icon: '📄' },
    { label: 'Ticket',       href: '/ticket',       icon: '🎫' },
    { label: 'Contenuti',    href: '/contenuti',    icon: '📋' },
  ],

  amministrazione: [
    { label: 'Dashboard',    href: '/',              icon: '🏠' },
    { label: 'Coda lavoro',  href: '/coda',         icon: '⚡' },
    { label: 'Collaboratori',href: '/collaboratori', icon: '👥' },
    { label: 'Export',       href: '/export',        icon: '📊' },
    { label: 'Documenti',    href: '/documenti',     icon: '📄' },
    { label: 'Ticket',       href: '/ticket',        icon: '🎫' },
    { label: 'Contenuti',    href: '/contenuti',     icon: '📋' },
    { label: 'Impostazioni', href: '/impostazioni',  icon: '⚙️' },
  ],

  super_admin: [
    { label: 'Dashboard',    href: '/',              icon: '🏠' },
    { label: 'Coda lavoro',  href: '/coda',         icon: '⚡' },
    { label: 'Collaboratori',href: '/collaboratori', icon: '👥' },
    { label: 'Export',       href: '/export',        icon: '📊' },
    { label: 'Documenti',    href: '/documenti',     icon: '📄' },
    { label: 'Ticket',       href: '/ticket',        icon: '🎫' },
    { label: 'Contenuti',    href: '/contenuti',     icon: '📋' },
    { label: 'Impostazioni', href: '/impostazioni',  icon: '⚙️' },
  ],
};
