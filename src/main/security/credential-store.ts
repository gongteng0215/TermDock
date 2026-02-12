export interface CredentialStore {
  saveSessionSecret(sessionId: string, secret: string): Promise<void>;
  getSessionSecret(sessionId: string): Promise<string | null>;
  deleteSessionSecret(sessionId: string): Promise<void>;
}

type KeytarModule = {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

class InMemoryCredentialStore implements CredentialStore {
  private readonly values = new Map<string, string>();

  async saveSessionSecret(sessionId: string, secret: string): Promise<void> {
    this.values.set(sessionId, secret);
  }

  async getSessionSecret(sessionId: string): Promise<string | null> {
    return this.values.get(sessionId) ?? null;
  }

  async deleteSessionSecret(sessionId: string): Promise<void> {
    this.values.delete(sessionId);
  }
}

class KeytarCredentialStore implements CredentialStore {
  private readonly serviceName: string;
  private readonly keytar: KeytarModule;

  constructor(serviceName: string, keytar: KeytarModule) {
    this.serviceName = serviceName;
    this.keytar = keytar;
  }

  async saveSessionSecret(sessionId: string, secret: string): Promise<void> {
    await this.keytar.setPassword(this.serviceName, sessionId, secret);
  }

  async getSessionSecret(sessionId: string): Promise<string | null> {
    return this.keytar.getPassword(this.serviceName, sessionId);
  }

  async deleteSessionSecret(sessionId: string): Promise<void> {
    await this.keytar.deletePassword(this.serviceName, sessionId);
  }
}

export async function createCredentialStore(
  serviceName = "TermDock"
): Promise<CredentialStore> {
  try {
    const loadedModule = await import("keytar");
    const loaded = (("default" in loadedModule
      ? loadedModule.default
      : loadedModule) as unknown) as KeytarModule;
    return new KeytarCredentialStore(serviceName, loaded);
  } catch {
    return new InMemoryCredentialStore();
  }
}
