import { readdir, readFile, stat } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";

import type { SessionAuthType, SshConfigImportCandidate, SshConfigParseResult } from "../../shared/session.js";

interface SshOptionState {
  hostName?: string;
  username?: string;
  port?: number;
  identityFile?: string;
  identityFileLine?: number;
  identityFileSourcePath?: string;
}

type SshOptionKey = "hostName" | "username" | "port" | "identityFile";

interface SshHostBlock {
  line: number;
  patterns: string[];
  sourcePath: string;
}

interface SshDirectiveRecord {
  line: number;
  sourcePath: string;
  hostBlock: SshHostBlock | null;
  option: SshOptionKey;
  value: string | number;
}

interface AliasDeclaration {
  alias: string;
  sourcePath: string;
  line: number;
}

interface ParseContext {
  directives: SshDirectiveRecord[];
  aliases: Map<string, AliasDeclaration>;
  warnings: string[];
  includeStack: string[];
}

const UNSUPPORTED_DIRECTIVE_WARNINGS: Record<string, string> = {
  certificatefile: "CertificateFile is not imported; configure certificate auth manually after import.",
  dynamicforward: "DynamicForward is not imported; recreate the SOCKS5 forward in Port Forwarding after connecting.",
  identitiesonly: "IdentitiesOnly is not imported; verify the selected private key after import.",
  localforward: "LocalForward is not imported; recreate the local forward in Port Forwarding after connecting.",
  proxycommand: "ProxyCommand is not imported yet; sessions that require a proxy command may need manual setup.",
  proxyjump: "ProxyJump is not imported yet; sessions that require a bastion host may need manual setup.",
  remoteforward: "RemoteForward is not imported; recreate the remote forward in Port Forwarding after connecting."
};

export async function parseSshConfigFile(inputPath?: string): Promise<SshConfigParseResult> {
  const resolvedPath = resolveSshConfigPath(inputPath);
  const context: ParseContext = {
    directives: [],
    aliases: new Map<string, AliasDeclaration>(),
    warnings: [],
    includeStack: []
  };
  await parseConfigFile(resolvedPath, null, context, true);
  const candidates = await buildCandidates(context.aliases, context.directives, context.warnings);
  return {
    filePath: resolvedPath,
    candidates,
    warnings: Array.from(new Set(context.warnings))
  };
}

function resolveSshConfigPath(inputPath?: string): string {
  const normalized = typeof inputPath === "string" ? inputPath.trim() : "";
  if (!normalized) {
    return join(homedir(), ".ssh", "config");
  }
  if (normalized.startsWith("~/")) {
    return resolve(join(homedir(), normalized.slice(2)));
  }
  return isAbsolute(normalized) ? normalized : resolve(normalized);
}

async function parseConfigFile(
  filePath: string,
  inheritedHostBlock: SshHostBlock | null,
  context: ParseContext,
  isRoot = false
): Promise<SshHostBlock | null> {
  const normalizedFilePath = resolve(filePath);
  const filePathKey = toPathKey(normalizedFilePath);
  if (context.includeStack.includes(filePathKey)) {
    context.warnings.push(
      `${normalizedFilePath}: Include cycle detected (${formatIncludeCycle(context.includeStack, filePathKey)}).`
    );
    return inheritedHostBlock;
  }

  context.includeStack.push(filePathKey);
  let content = "";
  try {
    content = await readFile(normalizedFilePath, "utf-8");
  } catch (error) {
    context.includeStack.pop();
    if (isRoot) {
      throw error;
    }
    context.warnings.push(`${normalizedFilePath}: Include file could not be read and was skipped.`);
    return inheritedHostBlock;
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let currentBlock: SshHostBlock | null = inheritedHostBlock;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const withoutComment = stripInlineComment(lines[index]).trim();
    if (!withoutComment) {
      continue;
    }
    const match = withoutComment.match(/^([A-Za-z][A-Za-z0-9]*)\s+(.*)$/);
    if (!match) {
      context.warnings.push(`${normalizedFilePath}:${lineNumber}: ignored unparsable line.`);
      continue;
    }
    const directive = match[1].toLowerCase();
    const rawValue = match[2].trim();
    if (!rawValue) {
      continue;
    }

    if (directive === "host") {
      const patterns = tokenizeSshValue(rawValue)
        .map((token) => unquoteToken(token).trim())
        .filter((token) => token.length > 0);
      if (patterns.length === 0) {
        context.warnings.push(`${normalizedFilePath}:${lineNumber}: empty Host directive ignored.`);
        currentBlock = null;
        continue;
      }
      currentBlock = {
        line: lineNumber,
        patterns,
        sourcePath: normalizedFilePath
      };
      registerAliasDeclarations(patterns, currentBlock, context);
      continue;
    }

    if (directive === "include") {
      const includeTargets = await resolveIncludeTargets(rawValue, normalizedFilePath);
      if (includeTargets.length === 0) {
        context.warnings.push(
          `${normalizedFilePath}:${lineNumber}: Include "${rawValue}" matched no files.`
        );
        continue;
      }
      for (const includeTarget of includeTargets) {
        currentBlock = await parseConfigFile(includeTarget, currentBlock, context, false);
      }
      continue;
    }

    const unsupportedWarning = getUnsupportedDirectiveWarning(directive);
    if (unsupportedWarning) {
      context.warnings.push(`${normalizedFilePath}:${lineNumber}: ${unsupportedWarning}`);
      continue;
    }

    const parsedDirective = parseOptionDirective(
      directive,
      rawValue,
      normalizedFilePath,
      lineNumber,
      context.warnings
    );
    if (!parsedDirective) {
      continue;
    }
    context.directives.push({
      line: lineNumber,
      sourcePath: normalizedFilePath,
      hostBlock: currentBlock
        ? {
            line: currentBlock.line,
            patterns: [...currentBlock.patterns],
            sourcePath: currentBlock.sourcePath
          }
        : null,
      option: parsedDirective.option,
      value: parsedDirective.value
    });
  }

  context.includeStack.pop();
  return currentBlock;
}

function parseOptionDirective(
  directive: string,
  rawValue: string,
  sourcePath: string,
  lineNumber: number,
  warnings: string[]
): {
  option: SshOptionKey;
  value: string | number;
} | null {
  if (directive === "hostname") {
    const value = unquoteToken(rawValue).trim();
    if (!value) {
      return null;
    }
    return {
      option: "hostName",
      value
    };
  }
  if (directive === "user") {
    const value = unquoteToken(rawValue).trim();
    if (!value) {
      return null;
    }
    return {
      option: "username",
      value
    };
  }
  if (directive === "port") {
    const parsedPort = Number.parseInt(unquoteToken(rawValue), 10);
    if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      warnings.push(`${sourcePath}:${lineNumber}: invalid Port "${rawValue}" ignored.`);
      return null;
    }
    return {
      option: "port",
      value: parsedPort
    };
  }
  if (directive === "identityfile") {
    const token = tokenizeSshValue(rawValue)[0];
    if (!token) {
      return null;
    }
    const normalized = unquoteToken(token).trim();
    if (!normalized) {
      return null;
    }
    return {
      option: "identityFile",
      value: normalized
    };
  }
  return null;
}

function getUnsupportedDirectiveWarning(directive: string): string | null {
  return UNSUPPORTED_DIRECTIVE_WARNINGS[directive] ?? null;
}

async function buildCandidates(
  aliases: Map<string, AliasDeclaration>,
  directives: SshDirectiveRecord[],
  warnings: string[]
): Promise<SshConfigImportCandidate[]> {
  const fallbackUser = safeOsUsername();
  const aliasValues = Array.from(aliases.values()).sort((left, right) =>
    left.alias.localeCompare(right.alias, undefined, { sensitivity: "base" })
  );
  const candidates: SshConfigImportCandidate[] = [];
  for (const aliasDeclaration of aliasValues) {
    const state: SshOptionState = {};
    for (const directive of directives) {
      if (!isHostBlockMatched(aliasDeclaration.alias, directive.hostBlock)) {
        continue;
      }
      if (directive.option === "hostName" && !state.hostName) {
        state.hostName = String(directive.value);
      } else if (directive.option === "username" && !state.username) {
        state.username = String(directive.value);
      } else if (directive.option === "port" && state.port === undefined) {
        state.port = Number(directive.value);
      } else if (directive.option === "identityFile" && !state.identityFile) {
        state.identityFile = String(directive.value);
        state.identityFileLine = directive.line;
        state.identityFileSourcePath = directive.sourcePath;
      }
    }
    const hostName = state.hostName ?? aliasDeclaration.alias;
    const username = state.username ?? fallbackUser;
    const port = state.port ?? 22;
    const identityFile = state.identityFile
      ? expandIdentityFilePath(state.identityFile, {
          hostAlias: aliasDeclaration.alias,
          hostName,
          localUsername: fallbackUser,
          port,
          username
      })
      : undefined;
    if (identityFile && !(await isExistingRegularFile(identityFile))) {
      warnings.push(
        `${state.identityFileSourcePath ?? aliasDeclaration.sourcePath}:${
          state.identityFileLine ?? aliasDeclaration.line
        }: IdentityFile "${identityFile}" for Host "${aliasDeclaration.alias}" does not exist or is not a regular file after expansion.`
      );
    }
    const authType: SessionAuthType = identityFile ? "privateKey" : "password";
    candidates.push({
      hostAlias: aliasDeclaration.alias,
      name: aliasDeclaration.alias,
      host: hostName,
      port,
      username,
      authType,
      privateKeyPath: identityFile,
      sourceLine: aliasDeclaration.line
    });
  }
  return candidates;
}

function tokenizeSshValue(rawValue: string): string[] {
  const matches = rawValue.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+/g);
  return matches ?? [];
}

function unquoteToken(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === "\"" && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, index);
    }
  }
  return line;
}

function registerAliasDeclarations(
  patterns: string[],
  block: SshHostBlock,
  context: ParseContext
): void {
  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();
    if (!pattern) {
      continue;
    }
    const negated = pattern.startsWith("!");
    const normalized = negated ? pattern.slice(1).trim() : pattern;
    if (!normalized || negated || hasGlobToken(normalized)) {
      continue;
    }
    const aliasKey = normalized.toLowerCase();
    if (context.aliases.has(aliasKey)) {
      const existing = context.aliases.get(aliasKey);
      if (existing) {
        context.warnings.push(
          `${block.sourcePath}:${block.line}: duplicate Host alias "${normalized}" ignored (first declaration at ${existing.sourcePath}:${existing.line}).`
        );
      }
      continue;
    }
    context.aliases.set(aliasKey, {
      alias: normalized,
      sourcePath: block.sourcePath,
      line: block.line
    });
  }
}

function isHostBlockMatched(alias: string, hostBlock: SshHostBlock | null): boolean {
  if (!hostBlock) {
    return true;
  }
  let positiveMatched = false;
  for (const rawPattern of hostBlock.patterns) {
    const token = rawPattern.trim();
    if (!token) {
      continue;
    }
    const negated = token.startsWith("!");
    const pattern = negated ? token.slice(1).trim() : token;
    if (!pattern) {
      continue;
    }
    if (!matchGlobPattern(alias, pattern)) {
      continue;
    }
    if (negated) {
      return false;
    }
    positiveMatched = true;
  }
  return positiveMatched;
}

const GLOB_REGEX_CACHE = new Map<string, RegExp>();

function matchGlobPattern(input: string, pattern: string): boolean {
  const cacheKey = pattern.toLowerCase();
  const cached = GLOB_REGEX_CACHE.get(cacheKey);
  if (cached) {
    return cached.test(input);
  }
  const regex = new RegExp(globPatternToRegexSource(pattern), "i");
  GLOB_REGEX_CACHE.set(cacheKey, regex);
  return regex.test(input);
}

function globPatternToRegexSource(pattern: string): string {
  let output = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      if (index + 1 < pattern.length) {
        output += escapeRegexChar(pattern[index + 1]);
        index += 1;
      } else {
        output += "\\\\";
      }
      continue;
    }
    if (char === "*") {
      output += ".*";
      continue;
    }
    if (char === "?") {
      output += ".";
      continue;
    }
    if (char === "[") {
      const closingIndex = findClosingBracket(pattern, index + 1);
      if (closingIndex === -1) {
        output += "\\[";
        continue;
      }
      const classBody = pattern.slice(index + 1, closingIndex);
      if (!classBody) {
        output += "\\[\\]";
        index = closingIndex;
        continue;
      }
      let negated = false;
      let content = classBody;
      if (content.startsWith("!") || content.startsWith("^")) {
        negated = true;
        content = content.slice(1);
      }
      if (!content) {
        output += "\\[\\]";
        index = closingIndex;
        continue;
      }
      const escapedContent = content.replace(/\\/g, "\\\\");
      output += `[${negated ? "^" : ""}${escapedContent}]`;
      index = closingIndex;
      continue;
    }
    output += escapeRegexChar(char);
  }
  output += "$";
  return output;
}

function findClosingBracket(value: string, start: number): number {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "]") {
      return index;
    }
  }
  return -1;
}

function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

function safeOsUsername(): string {
  try {
    const value = userInfo().username.trim();
    return value || "root";
  } catch {
    return "root";
  }
}

function expandHomePath(pathValue: string): string {
  if (!pathValue) {
    return pathValue;
  }
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function expandIdentityFilePath(
  pathValue: string,
  context: {
    hostAlias: string;
    hostName: string;
    localUsername: string;
    port: number;
    username: string;
  }
): string {
  const expandedTokens = pathValue.replace(/%(%|d|h|n|p|r|u)/g, (_match, token: string) => {
    switch (token) {
      case "%":
        return "%";
      case "d":
        return homedir();
      case "h":
        return context.hostName;
      case "n":
        return context.hostAlias;
      case "p":
        return String(context.port);
      case "r":
        return context.username;
      case "u":
        return context.localUsername;
      default:
        return `%${token}`;
    }
  });
  return expandHomePath(expandedTokens);
}

function hasGlobToken(value: string): boolean {
  return /[*?\[]/.test(value);
}

async function resolveIncludeTargets(rawValue: string, sourcePath: string): Promise<string[]> {
  const sourceDirectory = dirname(sourcePath);
  const tokens = tokenizeSshValue(rawValue)
    .map((token) => unquoteToken(token).trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return [];
  }
  const collected: string[] = [];
  for (const token of tokens) {
    const includePath = resolveConfigPathToken(token, sourceDirectory);
    if (hasGlobToken(includePath)) {
      const expanded = await expandGlobPaths(includePath);
      collected.push(...expanded);
      continue;
    }
    if (await isExistingRegularFile(includePath)) {
      collected.push(resolve(includePath));
    }
  }
  return Array.from(new Set(collected)).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function resolveConfigPathToken(token: string, baseDirectory: string): string {
  const expanded = expandHomePath(token);
  if (isAbsolute(expanded)) {
    return resolve(expanded);
  }
  return resolve(baseDirectory, expanded);
}

async function isExistingRegularFile(pathValue: string): Promise<boolean> {
  try {
    const fileStat = await stat(pathValue);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function expandGlobPaths(absolutePattern: string): Promise<string[]> {
  const normalizedPattern = resolve(absolutePattern);
  const parsedPath = parse(normalizedPattern);
  const root = parsedPath.root;
  if (!root) {
    return [];
  }
  const relativePattern = normalizedPattern.slice(root.length);
  const segments = relativePattern.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return [];
  }

  let candidates = [root];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const finalSegment = index === segments.length - 1;
    const nextCandidates: string[] = [];
    if (hasGlobToken(segment)) {
      for (const candidate of candidates) {
        const dirEntries = await readDirSafe(candidate);
        for (const entry of dirEntries) {
          if (!matchGlobPattern(entry.name, segment)) {
            continue;
          }
          const nextPath = join(candidate, entry.name);
          if (finalSegment) {
            if (entry.isFile()) {
              nextCandidates.push(resolve(nextPath));
            }
          } else if (entry.isDirectory()) {
            nextCandidates.push(nextPath);
          }
        }
      }
    } else {
      for (const candidate of candidates) {
        const nextPath = join(candidate, segment);
        try {
          const entryStat = await stat(nextPath);
          if (finalSegment) {
            if (entryStat.isFile()) {
              nextCandidates.push(resolve(nextPath));
            }
          } else if (entryStat.isDirectory()) {
            nextCandidates.push(nextPath);
          }
        } catch {
          // ignore missing path segment
        }
      }
    }
    candidates = Array.from(new Set(nextCandidates));
    if (candidates.length === 0) {
      return [];
    }
  }

  return candidates.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

async function readDirSafe(pathValue: string) {
  try {
    return await readdir(pathValue, { withFileTypes: true });
  } catch {
    return [];
  }
}

function formatIncludeCycle(pathKeys: string[], cyclePath: string): string {
  const cycleStart = pathKeys.lastIndexOf(cyclePath);
  if (cycleStart === -1) {
    return cyclePath;
  }
  const cycle = [...pathKeys.slice(cycleStart), cyclePath];
  return cycle.join(" -> ");
}

function toPathKey(pathValue: string): string {
  const resolved = resolve(pathValue);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
