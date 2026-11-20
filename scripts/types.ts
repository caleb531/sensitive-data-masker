export interface AllowedWebsite {
	id: string;
	pattern: string;
	enabled: boolean;
}

// A change from the options page to one saved website
export type WebsiteChange =
	| { action: 'add'; website: AllowedWebsite }
	| { action: 'update'; id: string; changes: Partial<Pick<AllowedWebsite, 'pattern' | 'enabled'>> }
	| { action: 'remove'; id: string };

// Requests the service worker handles in the same queue as permission changes
export type WebsiteRequest =
	| { type: 'changeWebsite'; change: WebsiteChange }
	| { type: 'revokeWebsiteAccess'; grants: string[] }
	| { type: 'syncMaskingScript' };

// The result sent back after processing a website request
export type WebsiteResponse = { ok: true } | { ok: false; error: string };

export type DataTypeId = 'currency' | 'percentage' | 'socialSecurityNumber' | 'creditCardNumber';

// The settings this extension reads and writes in Chrome Sync
export interface SyncSettings {
	// The saved website rules, if the user has saved any
	allowedWebsites?: AllowedWebsite[];
	// The user's overrides for which data types to mask
	dataTypePreferences?: Partial<Record<DataTypeId, boolean>>;
}

export interface DataType {
	id: DataTypeId;
	label: string;
}
