import { getDomain } from 'tldts';

// The HTTP or HTTPS scheme in a Chrome match pattern; * covers both
type Scheme = 'http' | 'https' | '*';

// The parts of a Chrome match pattern used to limit where masking can run
interface SiteMatch {
	// The scheme covered by the pattern
	scheme: Scheme;
	// The literal hostname, leading subdomain wildcard, or * for any hostname
	host: string;
	// The optional port covered by the pattern
	port: string;
	// The path pattern used for content script registration
	path: string;
}

// The path and host to register and the browser permission to request
interface WebsiteAccess {
	// The URLs that could match the saved rule
	match: SiteMatch;
	// The domain and its subdomains across both HTTP and HTTPS
	request: string;
}

// Return the Chrome match and permission patterns for the given website rule
export function getWebsiteAccess(pattern: string): WebsiteAccess | undefined {
	// The optional scheme, host (and port), and suffix from the saved pattern
	const [, scheme = '*', authority, suffix] =
		/^(?:([\w+.-]+|\*):\/\/)?([^/?#]+)(.*)$/.exec(pattern.trim()) ?? [];
	if (scheme !== '*' && scheme !== 'http' && scheme !== 'https') return;
	if (!authority || authority.includes('@') || authority.includes('\\') || /\s/.test(authority)) {
		return;
	}

	// Separate the port so a wildcard there doesn't widen the hostname
	const [, hostname, port = ''] = /^(\[[^\]]+\]|[^:]+)(?::(\d+|\*))?$/.exec(authority) ?? [];
	if (!hostname || (port && port !== '*' && Number(port) > 65535)) return;

	// The literal hostname, or the fixed suffix after the last wildcard label
	const wildcard = hostname.includes('*');
	// The fixed suffix must stay within a registrable domain to request access
	const fixedHost = wildcard
		? hostname.slice(hostname.lastIndexOf('*')).split('.').slice(1).join('.')
		: hostname;
	if (!fixedHost) return;

	try {
		// Parse the fixed hostname using the same normalization as Chrome URLs
		const url = new URL(`https://${fixedHost}`);
		// Match the sibling extension's scope, including private suffixes
		const domain = getDomain(url.hostname, { allowPrivateDomains: true });
		if (wildcard && !domain) return;

		// Use the fixed part of the path; the existing matcher checks the full URL
		const pathPrefix = suffix?.startsWith('/') ? suffix.split(/[?#*]/, 1)[0] : '/';
		return {
			match: {
				scheme,
				host: wildcard ? `*.${url.hostname}` : url.hostname,
				port: port === '*' ? '' : port,
				path: `${pathPrefix}*`
			},
			request: `*://${domain ? `*.${domain}` : url.hostname}/*`
		};
	} catch {
		return;
	}
}

// Return true if the host scope includes the given hostname or wildcard scope
function coversHost(scope: string, host: string): boolean {
	if (scope === '*' || scope === host) return true;
	return scope.startsWith('*.') && (host === scope.slice(2) || host.endsWith(scope.slice(1)));
}

// Return the registration pattern covered by both the rule and the given grant
export function intersectGrant(match: SiteMatch, grant: string): string | undefined {
	// The scheme, hostname, and port of Chrome's host permission; paths are ignored
	const [, scheme, host, port = ''] =
		/^(https?|\*):\/\/(\[[^\]]+\]|[^/:]+)(?::(\d+|\*))?\//.exec(grant) ?? [];
	if (!host || (scheme !== '*' && match.scheme !== '*' && scheme !== match.scheme)) return;

	// The narrower hostname scope shared by the rule and the grant
	const commonHost = coversHost(host, match.host)
		? match.host
		: coversHost(match.host, host)
			? host
			: undefined;
	if (!commonHost) return;

	// The scheme covered by both patterns
	const commonScheme = match.scheme === '*' ? scheme : match.scheme;
	// A port on the browser grant can further narrow where Chrome injects
	const grantPort = port === '*' ? '' : port;
	if (grantPort && match.port && grantPort !== match.port) return;
	// The port covered by both patterns, or the empty string if all ports apply
	const commonPort = grantPort || match.port;
	return `${commonScheme}://${commonHost}${commonPort ? `:${commonPort}` : ''}${match.path}`;
}

// Return the current browser grants that cover any part of the given rule
export function getWebsiteGrants(pattern: string, grants: string[]): string[] {
	// The match pattern that approximates the rule in Chrome
	const access = getWebsiteAccess(pattern);
	return access ? grants.filter((grant) => intersectGrant(access.match, grant)) : [];
}
