export interface AllowedWebsite {
	id: string;
	pattern: string;
	enabled: boolean;
}

export type DataTypeId = 'currency' | 'percentage' | 'socialSecurityNumber' | 'creditCardNumber';

export interface DataType {
	id: DataTypeId;
	label: string;
}
