export type FetchInput = string | URL | Request;
/**
 * Merge headers from a Request object and/or a RequestInit headers value
 * into a single Headers instance.
 */
export declare function mergeHeaders(input: FetchInput, init?: RequestInit): Headers;
/**
 * Merge incoming beta headers with the required OAuth betas, deduplicating.
 */
export declare function mergeBetaHeaders(headers: Headers): string;
/**
 * Set OAuth-required headers on the request: authorization, beta, user-agent.
 * Removes x-api-key since we're using OAuth.
 */
export declare function setOAuthHeaders(headers: Headers, accessToken: string): Headers;
/**
 * Add TOOL_PREFIX to tool names in the request body.
 * Prefixes both tool definitions and tool_use blocks in messages.
 */
export declare function prefixToolNames(body: string): string;
/**
 * Strip TOOL_PREFIX from tool names in streaming response text.
 */
export declare function stripToolPrefix(text: string): string;
/**
 * Rewrite the request URL to add ?beta=true for /v1/messages requests.
 * Returns the modified input and URL (if applicable).
 */
export declare function rewriteUrl(input: FetchInput): {
    input: FetchInput;
    url: URL | null;
};
/**
 * Create a streaming response that strips the tool prefix from tool names.
 */
export declare function createStrippedStream(response: Response): Response;
