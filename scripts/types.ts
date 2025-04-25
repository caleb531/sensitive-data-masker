export interface AllowedWebsite {
	pattern: string;
	enabled: boolean;
}

export type DataTypeId = 'currency' | 'percentage' | 'socialSecurityNumber' | 'creditCardNumber';

export interface DataType {
	id: DataTypeId;
	label: string;
}
