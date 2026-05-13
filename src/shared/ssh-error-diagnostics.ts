export interface SshConnectionErrorDiagnostic {
  category:
    | "auth"
    | "dns"
    | "keyFile"
    | "keyFormat"
    | "network"
    | "port"
    | "timeout"
    | "hostKey"
    | "handshake"
    | "remoteClosed"
    | "unknown";
  rawMessage: string;
  suggestion: string;
  summary: string;
}

export function diagnoseSshConnectionError(error: unknown): SshConnectionErrorDiagnostic {
  const rawMessage = toRawErrorMessage(error);
  const normalized = rawMessage.toLowerCase();

  if (
    /\benoent\b/.test(normalized) ||
    /no such file or directory/.test(normalized) ||
    /cannot find the path/.test(normalized)
  ) {
    return {
      category: "keyFile",
      rawMessage,
      summary: "Private key file was not found.",
      suggestion:
        "Check the session private-key path or the imported IdentityFile value, then make sure the file exists on this computer."
    };
  }

  if (
    /\beacces\b/.test(normalized) ||
    /operation not permitted/.test(normalized) ||
    /permission denied.*(?:open|read|key|file)/.test(normalized)
  ) {
    return {
      category: "keyFile",
      rawMessage,
      summary: "Private key file cannot be read.",
      suggestion:
        "Check the key-file permissions and confirm the current OS user can read the private key."
    };
  }

  if (
    /cannot parse privatekey/.test(normalized) ||
    /invalid privatekey/.test(normalized) ||
    /unsupported key format/.test(normalized) ||
    /bad passphrase/.test(normalized) ||
    /encrypted private.*passphrase/.test(normalized)
  ) {
    return {
      category: "keyFormat",
      rawMessage,
      summary: "Private key could not be used.",
      suggestion:
        "Confirm the key format is supported and enter the key passphrase if the private key is encrypted."
    };
  }

  if (
    /all configured authentication methods failed/.test(normalized) ||
    /authentication failed/.test(normalized) ||
    /permission denied \(/.test(normalized) ||
    /permission denied, please try again/.test(normalized)
  ) {
    return {
      category: "auth",
      rawMessage,
      summary: "SSH authentication failed.",
      suggestion:
        "Check the username, password or private key, and confirm the server allows that authentication method."
    };
  }

  if (
    /\benotfound\b/.test(normalized) ||
    /getaddrinfo/.test(normalized) ||
    /could not resolve hostname/.test(normalized) ||
    /name or service not known/.test(normalized) ||
    /nodename nor servname provided/.test(normalized)
  ) {
    return {
      category: "dns",
      rawMessage,
      summary: "Host name could not be resolved.",
      suggestion:
        "Check the HostName/host value, DNS, VPN, and whether an SSH config alias was imported without the expected HostName."
    };
  }

  if (/\beconnrefused\b/.test(normalized) || /connection refused/.test(normalized)) {
    return {
      category: "port",
      rawMessage,
      summary: "Connection was refused by the server.",
      suggestion:
        "Check the SSH port, make sure sshd is running on the server, and confirm firewall rules allow this port."
    };
  }

  if (
    /\betimedout\b/.test(normalized) ||
    /timed out/.test(normalized) ||
    /timeout/.test(normalized)
  ) {
    return {
      category: "timeout",
      rawMessage,
      summary: "Connection timed out.",
      suggestion:
        "Check the host, port, VPN, firewall, cloud security group, and whether the server is reachable from this network."
    };
  }

  if (
    /\behostunreach\b/.test(normalized) ||
    /\benetunreach\b/.test(normalized) ||
    /no route to host/.test(normalized) ||
    /network is unreachable/.test(normalized)
  ) {
    return {
      category: "network",
      rawMessage,
      summary: "Server network is unreachable.",
      suggestion:
        "Check your network, VPN route, server public/private IP, and cloud firewall or security-group rules."
    };
  }

  if (
    /host key verification failed/.test(normalized) ||
    /remote host identification has changed/.test(normalized)
  ) {
    return {
      category: "hostKey",
      rawMessage,
      summary: "SSH host key verification failed.",
      suggestion:
        "Verify the server identity before changing known_hosts. If the host was rebuilt, remove the stale known_hosts entry and reconnect."
    };
  }

  if (
    /before handshake/.test(normalized) ||
    /handshake/.test(normalized) ||
    /kex_exchange_identification/.test(normalized) ||
    /no matching .*found/.test(normalized)
  ) {
    return {
      category: "handshake",
      rawMessage,
      summary: "SSH handshake failed.",
      suggestion:
        "Check server SSH compatibility, allowed algorithms, bastion/proxy requirements, and whether the server closed the connection early."
    };
  }

  if (
    /connection reset/.test(normalized) ||
    /closed by remote host/.test(normalized) ||
    /connection closed/.test(normalized)
  ) {
    return {
      category: "remoteClosed",
      rawMessage,
      summary: "Remote host closed the connection.",
      suggestion:
        "Check server-side SSH logs, allowlists, MaxStartups/connection limits, and whether a bastion or proxy is required."
    };
  }

  return {
    category: "unknown",
    rawMessage,
    summary: "SSH connection failed.",
    suggestion:
      "Check the host, port, username, authentication method, network reachability, and server SSH logs."
  };
}

export function formatSshConnectionError(error: unknown): string {
  const diagnostic = diagnoseSshConnectionError(error);
  const rawSuffix =
    diagnostic.rawMessage && diagnostic.rawMessage !== diagnostic.summary
      ? `\nRaw error: ${diagnostic.rawMessage}`
      : "";
  return `${diagnostic.summary}\nNext: ${diagnostic.suggestion}${rawSuffix}`;
}

function toRawErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message || value.name || "Connection failed.";
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || "Connection failed.";
  }
  try {
    const encoded = JSON.stringify(value);
    if (encoded) {
      return encoded;
    }
  } catch {
    // Fall through to String().
  }
  return String(value || "Connection failed.");
}
