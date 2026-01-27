export interface ImageReference {
	filename: string;
	originalMatch: string;
}

export interface ResolvedImage {
	filename: string;
	data: ArrayBuffer;
}

export type BroadcastStatus = "draft" | "send";

export interface BroadcastFrontmatter {
	subject?: string;
	tenant_email_id?: number;
	tag_ids?: number[];
	scheduled_at?: string;
	status?: BroadcastStatus;
}

export interface BroadcastMailResponse {
	id: number;
	status: string;
}

export interface BroadcastMailErrorResponse {
	errors: string[];
}
