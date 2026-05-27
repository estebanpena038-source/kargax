import type * as React from 'react';

export type SidebarUserType = 'trucker' | 'business' | 'admin';

export type SidebarSectionKey =
    | 'command'
    | 'operations'
    | 'marketplace'
    | 'money'
    | 'governance'
    | 'support';

export type SidebarItemPriority = 'primary' | 'default' | 'quiet';

export interface NavItem {
    id: string;
    labelKey: string;
    fallbackLabel: string;
    icon: React.ElementType;
    href: string;
    badge?: number;
    allowedUserTypes?: SidebarUserType[];
    section?: SidebarSectionKey;
    description?: string;
    priority?: SidebarItemPriority;
    expandedOnly?: boolean;
    children?: NavItem[];
}

export interface SidebarNavCounts {
    total: number;
    applications: number;
    applicationUpdates: number;
    acceptedJobs: number;
}

export interface SidebarSectionMeta {
    title: string;
    description: string;
    collapsedLabel: string;
}
