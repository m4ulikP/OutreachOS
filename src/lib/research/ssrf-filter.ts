import * as dns from "node:dns/promises";
import * as net from "node:net";

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  parsedUrl?: URL;
}

export interface DnsValidationResult {
  safe: boolean;
  error?: string;
  ips: string[];
}

const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
]);

const FORBIDDEN_TLDS = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".arpa",
];

/**
 * Validates protocol, port, and hostname format against SSRF risks.
 */
export function validateUrlProtocolAndHost(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { valid: false, error: "Website URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Invalid website URL format." };
  }

  // Strictly permit only HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Only HTTP and HTTPS protocols are permitted. Unsupported protocol '${parsed.protocol}'.`,
    };
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "URLs with embedded user credentials are not permitted.",
    };
  }

  // Validate allowed ports (standard web ports only)
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return {
      valid: false,
      error: `Port ${parsed.port} is not allowed. Only standard web ports (80, 443) are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    return { valid: false, error: "URL is missing a valid hostname." };
  }

  // Reject known internal or reserved hostnames
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    return { valid: false, error: `Access to local or internal loopback hostnames is prohibited: Hostname '${hostname}'.` };
  }

  for (const tld of FORBIDDEN_TLDS) {
    if (hostname.endsWith(tld)) {
      return { valid: false, error: `SSRF Blocked: Domain suffix '${tld}' is reserved for private networks.` };
    }
  }

  // Direct IP in URL check
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: `SSRF Blocked: Target IP '${hostname}' resolved to prohibited address.` };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Checks if an IP address belongs to private, loopback, link-local, cloud metadata, or reserved ranges.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:")) {
    const rest = normalized.slice(7);
    if (net.isIPv4(rest)) {
      return isPrivateOrReservedIp(rest);
    }
  }

  // Handle IPv4
  if (net.isIPv4(normalized)) {
    const octets = normalized.split(".").map((n) => parseInt(n, 10));
    if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
      return true; // Malformed -> reject safely
    }

    const [a, b] = octets;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (a === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Metadata: 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 172.16.0.0/12 (Private RFC 1918: 172.16.0.0 – 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (a === 192 && b === 168) return true;

    // 100.64.0.0/10 (Shared Address / CGNAT: 100.64.0.0 - 100.127.255.255)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 0 && octets[2] === 2) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (a === 198 && b === 51 && octets[2] === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (a === 203 && b === 0 && octets[2] === 113) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 – 239.255.255.255)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use & 255.255.255.255 broadcast)
    if (a >= 240) return true;

    return false;
  }

  // Handle IPv6
  if (net.isIPv6(normalized)) {
    // ::1 (Loopback)
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

    // :: (Unspecified)
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

    // fc00::/7 (Unique Local Address - ULA)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

    // fe80::/10 (Link-Local)
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true;
    }

    // ff00::/8 (Multicast)
    if (normalized.startsWith("ff")) return true;

    return false;
  }

  return true; // Unknown format -> block
}

/**
 * Resolves hostname to all IP addresses and checks every IP against private/reserved ranges.
 * Protects against DNS rebinding and private IP spoofing.
 */
export async function resolveAndValidateHost(
  hostname: string,
  customResolver?: (host: string) => Promise<string[]>
): Promise<DnsValidationResult> {
  const host = hostname.toLowerCase().trim();

  // If already an IP address
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      return {
        safe: false,
        error: `SSRF Blocked: IP address '${host}' is private or reserved.`,
        ips: [host],
      };
    }
    return { safe: true, ips: [host] };
  }

  try {
    let resolvedIps: string[] = [];

    if (customResolver) {
      resolvedIps = await customResolver(host);
    } else {
      // Lookup all IPv4 and IPv6 addresses
      const results = await dns.lookup(host, { all: true });
      resolvedIps = results.map((r) => r.address);
    }

    if (!resolvedIps || resolvedIps.length === 0) {
      return { safe: false, error: `Could not resolve hostname '${host}'.`, ips: [] };
    }

    for (const ip of resolvedIps) {
      if (isPrivateOrReservedIp(ip)) {
        return {
          safe: false,
          error: `SSRF Blocked: Hostname '${host}' resolved to prohibited address '${ip}'.`,
          ips: resolvedIps,
        };
      }
    }

    return { safe: true, ips: resolvedIps };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { safe: false, error: `DNS resolution failed for '${host}': ${msg}`, ips: [] };
  }
}

/**
 * Validates a raw URL and resolves its hostname against SSRF constraints.
 * Throws an Error if SSRF checks fail; returns parsed URL if safe.
 */
export async function validateUrlForSSRF(
  rawUrl: string,
  customResolver?: (host: string) => Promise<string[]>
): Promise<URL> {
  const protocolCheck = validateUrlProtocolAndHost(rawUrl);
  if (!protocolCheck.valid || !protocolCheck.parsedUrl) {
    throw new Error(protocolCheck.error || "Invalid URL");
  }

  const dnsCheck = await resolveAndValidateHost(protocolCheck.parsedUrl.hostname, customResolver);
  if (!dnsCheck.safe) {
    throw new Error(dnsCheck.error || "SSRF check failed");
  }

  return protocolCheck.parsedUrl;
}

export const isPrivateOrReservedIP = isPrivateOrReservedIp;

