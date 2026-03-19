import fs from 'fs';
import os from 'os';
import path from 'path';

const FIRESTORE_ORIGIN = 'https://firestore.googleapis.com/v1';
const OAUTH_TOKEN_ORIGIN = 'https://oauth2.googleapis.com/token';
const DEFAULT_CLIENT_ID = process.env.FIREBASE_CLIENT_ID || '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = process.env.FIREBASE_CLIENT_SECRET || 'j9iVZfS8kkCEFUPaAeJV0sAi';
const DEFAULT_CLI_CONFIG_PATH = process.env.FIREBASE_CLI_CONFIG_PATH || path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

const coerceDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};

const decodeValue = (field = {}) => {
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('timestampValue' in field) return new Date(field.timestampValue);
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) {
    const values = Array.isArray(field.arrayValue.values) ? field.arrayValue.values : [];
    return values.map(decodeValue);
  }
  if ('mapValue' in field) {
    const fields = field.mapValue.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
  }
  return null;
};

const decodeFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeValue(value)])
);

const encodeValue = (value) => {
  const date = coerceDate(value);
  if (date) return { timestampValue: date.toISOString() };
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  return { stringValue: String(value) };
};

const encodeFields = (row = {}) => Object.fromEntries(
  Object.entries(row)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, encodeValue(value)])
);

const mapDocSnapshot = (document, ref = null) => ({
  id: document.name.split('/').pop(),
  exists: true,
  ref,
  data: () => decodeFields(document.fields || {})
});

class RestDocumentRef {
  constructor(store, collectionId, id) {
    this.store = store;
    this.collectionId = collectionId;
    this.id = id;
    this.path = `${collectionId}/${id}`;
  }

  get name() {
    return this.store.documentName(this.collectionId, this.id);
  }

  async get() {
    const response = await this.store.authorizedFetch(this.name);
    if (response.status === 404) {
      return { id: this.id, exists: false, ref: this, data: () => undefined };
    }
    const document = await response.json();
    return mapDocSnapshot(document, this);
  }
}

class RestQuery {
  constructor(store, collectionId, state = {}) {
    this.store = store;
    this.collectionId = collectionId;
    this.state = {
      filters: state.filters ? [...state.filters] : [],
      orderBy: state.orderBy ? [...state.orderBy] : [],
      limit: state.limit || null
    };
  }

  where(field, op, value) {
    return new RestQuery(this.store, this.collectionId, {
      ...this.state,
      filters: [...this.state.filters, { field, op, value }]
    });
  }

  orderBy(field, direction = 'asc') {
    return new RestQuery(this.store, this.collectionId, {
      ...this.state,
      orderBy: [...this.state.orderBy, { field, direction }]
    });
  }

  limit(limit) {
    return new RestQuery(this.store, this.collectionId, { ...this.state, limit });
  }

  doc(id) {
    return new RestDocumentRef(this.store, this.collectionId, id);
  }

  async get() {
    const body = {
      structuredQuery: {
        from: [{ collectionId: this.collectionId }]
      }
    };

    if (this.state.filters.length === 1) {
      const filter = this.state.filters[0];
      body.structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: filter.field },
          op: this.store.toFilterOperator(filter.op),
          value: encodeValue(filter.value)
        }
      };
    } else if (this.state.filters.length > 1) {
      body.structuredQuery.where = {
        compositeFilter: {
          op: 'AND',
          filters: this.state.filters.map((filter) => ({
            fieldFilter: {
              field: { fieldPath: filter.field },
              op: this.store.toFilterOperator(filter.op),
              value: encodeValue(filter.value)
            }
          }))
        }
      };
    }

    if (this.state.orderBy.length) {
      body.structuredQuery.orderBy = this.state.orderBy.map((entry) => ({
        field: { fieldPath: entry.field },
        direction: String(entry.direction || 'asc').toUpperCase() === 'DESC'
          ? 'DESCENDING'
          : 'ASCENDING'
      }));
    }

    if (this.state.limit) {
      body.structuredQuery.limit = this.state.limit;
    }

    const response = await this.store.authorizedFetch(
      `projects/${this.store.projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const rows = await response.json();
    const docs = rows
      .filter((row) => row.document)
      .map((row) => mapDocSnapshot(row.document, new RestDocumentRef(this.store, this.collectionId, row.document.name.split('/').pop())));
    return { docs };
  }
}

class RestBatch {
  constructor(store) {
    this.store = store;
    this.writes = [];
  }

  set(ref, data) {
    this.writes.push({
      update: {
        name: ref.name,
        fields: encodeFields(data)
      }
    });
  }

  delete(ref) {
    this.writes.push({
      delete: ref.name
    });
  }

  async commit() {
    if (!this.writes.length) return;
    await this.store.authorizedFetch(
      `projects/${this.store.projectId}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes: this.writes })
      }
    );
  }
}

export class FirestoreRestAdapter {
  static fromFirebaseCliConfig(options = {}) {
    const configPath = options.configPath || DEFAULT_CLI_CONFIG_PATH;
    const payload = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const refreshToken = payload.tokens?.refresh_token;
    if (!refreshToken) {
      throw new Error(`No Firebase CLI refresh token found in ${configPath}`);
    }

    return new FirestoreRestAdapter({
      projectId: options.projectId,
      refreshToken,
      clientId: options.clientId || payload.user?.aud || DEFAULT_CLIENT_ID,
      clientSecret: options.clientSecret || DEFAULT_CLIENT_SECRET
    });
  }

  constructor({ projectId, refreshToken, clientId = DEFAULT_CLIENT_ID, clientSecret = DEFAULT_CLIENT_SECRET }) {
    if (!projectId) throw new Error('projectId is required');
    this.projectId = projectId;
    this.refreshToken = refreshToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.cachedAccessToken = null;
    this.cachedExpiresAt = 0;
  }

  collection(collectionId) {
    return new RestQuery(this, collectionId);
  }

  batch() {
    return new RestBatch(this);
  }

  documentName(collectionId, id) {
    return `projects/${this.projectId}/databases/(default)/documents/${collectionId}/${id}`;
  }

  toFilterOperator(op) {
    const mapping = {
      '==': 'EQUAL',
      '>=': 'GREATER_THAN_OR_EQUAL',
      '<=': 'LESS_THAN_OR_EQUAL',
      '>': 'GREATER_THAN',
      '<': 'LESS_THAN'
    };
    if (!mapping[op]) throw new Error(`Unsupported Firestore operator: ${op}`);
    return mapping[op];
  }

  async getAll(...refs) {
    if (!refs.length) return [];
    const response = await this.authorizedFetch(
      `projects/${this.projectId}/databases/(default)/documents:batchGet`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: refs.map((ref) => ref.name) })
      }
    );
    const rows = await response.json();
    const byName = new Map();

    for (const row of rows) {
      if (row.found) {
        const ref = refs.find((candidate) => candidate.name === row.found.name) || null;
        byName.set(row.found.name, mapDocSnapshot(row.found, ref));
      } else if (row.missing) {
        const ref = refs.find((candidate) => candidate.name === row.missing) || null;
        byName.set(row.missing, { id: ref?.id || row.missing.split('/').pop(), exists: false, ref, data: () => undefined });
      }
    }

    return refs.map((ref) => byName.get(ref.name) || { id: ref.id, exists: false, ref, data: () => undefined });
  }

  async authorizedFetch(resource, options = {}) {
    const token = await this.getAccessToken();
    const url = resource.startsWith('http') ? resource : `${FIRESTORE_ORIGIN}/${resource}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error(`Firestore request failed (${response.status}): ${body}`);
    }

    return response;
  }

  async getAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cachedAccessToken && now < (this.cachedExpiresAt - 60000)) {
      return this.cachedAccessToken;
    }

    const response = await fetch(OAUTH_TOKEN_ORIGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to refresh Firebase CLI token: ${body}`);
    }

    const payload = await response.json();
    this.cachedAccessToken = payload.access_token;
    this.cachedExpiresAt = now + ((payload.expires_in || 3600) * 1000);
    return this.cachedAccessToken;
  }
}

export const firestoreRestInternals = {
  DEFAULT_CLI_CONFIG_PATH,
  decodeFields,
  encodeFields
};
