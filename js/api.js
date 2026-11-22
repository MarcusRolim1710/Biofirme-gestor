(function (global) {
  'use strict';

  const JSON_HEADERS = { 'Content-Type': 'application/json' };

  async function request(path, options = {}) {
    const { method = 'GET', body, headers = {} } = options;
    const init = {
      method,
      credentials: 'same-origin',
      headers: { ...headers },
    };

    if (body !== undefined) {
      init.headers = { ...JSON_HEADERS, ...headers };
      init.body = JSON.stringify(body);
    }

    const response = await fetch(path, init);
    const text = await response.text();

    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }

    if (!response.ok) {
      const error = new Error((data && data.error) || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function login(username, password) {
    return request('/api/auth?action=login', {
      method: 'POST',
      body: { username, password },
    });
  }

  async function logout() {
    try {
      await request('/api/auth?action=logout', { method: 'POST' });
    } finally {
      sessionStorage.removeItem('biofirme_user');
    }
  }

  async function me() {
    return request('/api/auth?action=me');
  }

  const employees = {
    list: async () => (await request('/api/employees')).data,
    create: async (payload) => (await request('/api/employees', { method: 'POST', body: payload })).data,
    update: async (id, payload) =>
      (await request(`/api/employees?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).data,
    remove: async (id) => request(`/api/employees?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  const positions = {
    list: async () => (await request('/api/positions')).data,
    create: async (payload) => (await request('/api/positions', { method: 'POST', body: payload })).data,
    update: async (id, payload) =>
      (await request(`/api/positions?id=${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).data,
    remove: async (id) => request(`/api/positions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  const documents = {
    list: async (employeeId) =>
      (await request(`/api/documents?employeeId=${encodeURIComponent(employeeId)}`)).data,
    create: async (payload) => (await request('/api/documents', { method: 'POST', body: payload })).data,
    remove: async (id) => request(`/api/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  async function upload(file, folder, hint, onProgress) {
    if (!file) return null;

    let prepared = file;
    if (global.BiofirmeCompress && global.BiofirmeCompress.compressFile) {
      prepared = await global.BiofirmeCompress.compressFile(file, { onProgress });
    }

    const maxBytes = 10 * 1024 * 1024;
    if (prepared.size > maxBytes) {
      throw new Error(`Arquivo excede 10MB: ${file.name}`);
    }

    const contentType = prepared.type || 'application/octet-stream';
    const presign = await request('/api/uploads', {
      method: 'POST',
      body: {
        folder,
        hint: hint || 'tmp',
        filename: prepared.name,
        contentType,
        size: prepared.size,
      },
    });

    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.headers,
      body: prepared,
    });

    if (!put.ok) {
      throw new Error(`Falha no upload (${put.status}).`);
    }

    return { url: presign.url, key: presign.key, file: prepared };
  }

  global.BiofirmeAPI = {
    request,
    auth: { login, logout, me },
    employees,
    positions,
    documents,
    uploads: { upload },
  };
})(window);
