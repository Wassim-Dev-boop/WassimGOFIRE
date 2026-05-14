import fs from 'node:fs/promises';

const API_BASE = 'http://localhost:8088';
const QUALITY = { identifier: 'qualite.cnstn', password: 'User@12345' };
const EMPLOYEE = { identifier: 'employe.cnstn', password: 'User@12345' };

const report = { timestamp: new Date().toISOString(), dataset: {}, checks: {} };

async function login(account) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: account.identifier, password: account.password }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Login ${account.identifier} KO: ${response.status} ${text}`);
  }
  return JSON.parse(text).access_token;
}

async function api(token, method, path, body, headers = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.arrayBuffer();
  let data = null;
  if (raw.byteLength > 0) {
    const text = new TextDecoder().decode(raw);
    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try { data = JSON.parse(text); } catch { data = text; }
    } else {
      data = text;
    }
  }
  return {
    status: response.status,
    ok: response.ok,
    data,
    contentType,
    size: raw.byteLength,
  };
}

function metadataPart(payload) {
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

async function uploadDocument(token, metadata, fileName, content, mimeType = 'text/plain') {
  const form = new FormData();
  form.append('metadata', metadataPart(metadata));
  form.append('file', new Blob([content], { type: mimeType }), fileName);
  return api(token, 'POST', '/api/v1/documents/upload', form);
}

function content(page) {
  return page?.content ?? page?.data?.content ?? [];
}

(async () => {
  const qualityToken = await login(QUALITY);
  const employeeToken = await login(EMPLOYEE);
  const suffix = Date.now();
  const titleAllowed = `Audit GED autorise employe ${suffix}`;
  const titleForbidden = `Audit GED interdit employe ${suffix}`;
  const titleAnnexe = `Audit GED annexe ${suffix}`;

  const folderCreate = await api(qualityToken, 'POST', '/api/v1/documents/folders', {
    name: `Audit GED ${suffix}`,
    parentId: null,
    category: 'Audit GED',
  });
  const mainFolderId = folderCreate.data?.id;

  const folderUpdate = await api(qualityToken, 'PUT', `/api/v1/documents/folders/${mainFolderId}`, {
    name: `Audit GED ${suffix} modifie`,
    parentId: null,
    category: 'Audit GED',
  });

  const subFolderCreate = await api(qualityToken, 'POST', '/api/v1/documents/folders', {
    name: `Sous-dossier audit ${suffix}`,
    parentId: mainFolderId,
    category: 'Audit GED',
  });
  const subFolderId = subFolderCreate.data?.id;

  const allowedUpload = await uploadDocument(qualityToken, {
    folderId: subFolderId,
    title: titleAllowed,
    category: 'Audit GED',
    subCategory: 'Preuve ACL',
    description: 'Document cree par audit automatique pour verifier les droits employe.',
    confidentialityLevel: 'RESTRICTED',
    allowedRoles: ['RESPONSABLE_QUALITE'],
    allowedServices: [],
  }, `audit-ged-autorise-${suffix}.txt`, `Contenu audit GED autorise ${suffix}`);
  const allowedId = allowedUpload.data?.id;

  const forbiddenUpload = await uploadDocument(qualityToken, {
    folderId: subFolderId,
    title: titleForbidden,
    category: 'Audit GED',
    subCategory: 'Preuve interdit',
    description: 'Document restreint sans role employe.',
    confidentialityLevel: 'RESTRICTED',
    allowedRoles: ['RESPONSABLE_QUALITE'],
    allowedServices: [],
  }, `audit-ged-interdit-${suffix}.txt`, `Contenu audit GED interdit ${suffix}`);
  const forbiddenId = forbiddenUpload.data?.id;

  const annexeUpload = await uploadDocument(qualityToken, {
    folderId: subFolderId,
    title: titleAnnexe,
    category: 'Audit GED',
    subCategory: 'Annexe',
    description: 'Annexe creee pour verifier les liens GED.',
    confidentialityLevel: 'INTERNAL',
    allowedRoles: ['RESPONSABLE_QUALITE'],
    allowedServices: [],
  }, `audit-ged-annexe-${suffix}.txt`, `Contenu annexe GED ${suffix}`);
  const annexeId = annexeUpload.data?.id;

  const publishAllowed = await api(qualityToken, 'PUT', `/api/v1/documents/${allowedId}/publish`, {});
  const publishForbidden = await api(qualityToken, 'PUT', `/api/v1/documents/${forbiddenId}/publish`, {});
  const publishAnnexe = await api(qualityToken, 'PUT', `/api/v1/documents/${annexeId}/publish`, {});

  const updateDoc = await api(qualityToken, 'PUT', `/api/v1/documents/${allowedId}`, {
    folderId: subFolderId,
    title: `${titleAllowed} modifie`,
    category: 'Audit GED',
    subCategory: 'Preuve ACL',
    description: 'Document modifie par audit automatique.',
    confidentialityLevel: 'RESTRICTED',
  });

  const versionAdd = await api(qualityToken, 'POST', `/api/v1/documents/${allowedId}/versions`, {
    content: `Version 2 audit GED ${suffix}`,
    fileName: `audit-ged-autorise-${suffix}-v2.txt`,
    mimeType: 'text/plain',
    changeNote: 'Version ajoutee pendant audit final',
  });
  const versions = await api(qualityToken, 'GET', `/api/v1/documents/${allowedId}/versions`);

  const addAnnexe = await api(qualityToken, 'POST', `/api/v1/documents/${allowedId}/links`, {
    linkedDocumentId: annexeId,
    relationType: 'ANNEXE',
  });
  const annexes = await api(qualityToken, 'GET', `/api/v1/documents/${allowedId}/links`);

  const employeeBefore = await api(employeeToken, 'GET', `/api/v1/documents?search=${encodeURIComponent(titleAllowed)}&size=50`);
  const employeeForbiddenList = await api(employeeToken, 'GET', `/api/v1/documents?search=${encodeURIComponent(titleForbidden)}&size=50`);
  const employeeForbiddenGet = await api(employeeToken, 'GET', `/api/v1/documents/${forbiddenId}`);
  const employeeForbiddenPreview = await api(employeeToken, 'GET', `/api/v1/documents/${forbiddenId}/preview`);
  const employeeForbiddenDownload = await api(employeeToken, 'GET', `/api/v1/documents/${forbiddenId}/download`);
  const employeeAclForbidden = await api(employeeToken, 'PUT', `/api/v1/documents/${forbiddenId}/acl`, {
    roles: ['EMPLOYE'],
    services: [],
  });

  const aclBefore = await api(qualityToken, 'GET', `/api/v1/documents/${allowedId}/acl`);
  const aclUpdate = await api(qualityToken, 'PUT', `/api/v1/documents/${allowedId}/acl`, {
    roles: ['RESPONSABLE_QUALITE', 'EMPLOYE'],
    services: [],
  });
  const aclReload = await api(qualityToken, 'GET', `/api/v1/documents/${allowedId}/acl`);

  const employeeAfter = await api(employeeToken, 'GET', `/api/v1/documents?search=${encodeURIComponent(titleAllowed)}&size=50`);
  const employeeGetAllowed = await api(employeeToken, 'GET', `/api/v1/documents/${allowedId}`);
  const employeePreviewAllowed = await api(employeeToken, 'GET', `/api/v1/documents/${allowedId}/preview?page=1&pageSize=1&zoomPercent=100`);
  const employeeDownloadAllowed = await api(employeeToken, 'GET', `/api/v1/documents/${allowedId}/download`);
  const employeePrintAllowed = await api(employeeToken, 'POST', `/api/v1/documents/${allowedId}/print`);
  const employeeAclStillForbidden = await api(employeeToken, 'PUT', `/api/v1/documents/${allowedId}/acl`, {
    roles: ['EMPLOYE'],
    services: [],
  });

  const qualityFiltered = await api(qualityToken, 'GET', `/api/v1/documents?folderId=${subFolderId}&category=${encodeURIComponent('Audit GED')}&search=${encodeURIComponent('Audit GED')}&page=0&size=2`);
  const treeReload = await api(qualityToken, 'GET', '/api/v1/documents/folders/tree');
  const auditLogs = await api(qualityToken, 'GET', '/api/v1/documents/audit-logs?page=0&size=20');

  report.dataset = {
    suffix,
    mainFolderId,
    subFolderId,
    allowedDocumentId: allowedId,
    forbiddenDocumentId: forbiddenId,
    annexeDocumentId: annexeId,
  };
  report.checks = {
    folderCreate: folderCreate.status,
    folderUpdate: folderUpdate.status,
    subFolderCreate: subFolderCreate.status,
    allowedUpload: allowedUpload.status,
    forbiddenUpload: forbiddenUpload.status,
    annexeUpload: annexeUpload.status,
    publishAllowed: publishAllowed.status,
    publishForbidden: publishForbidden.status,
    publishAnnexe: publishAnnexe.status,
    updateDoc: updateDoc.status,
    versionAdd: versionAdd.status,
    versionsStatus: versions.status,
    versionsCount: Array.isArray(versions.data) ? versions.data.length : 0,
    addAnnexe: addAnnexe.status,
    annexesStatus: annexes.status,
    annexesCount: Array.isArray(annexes.data) ? annexes.data.length : 0,
    employeeBeforeAclVisible: content(employeeBefore.data).some((doc) => doc.id === allowedId),
    employeeForbiddenHidden: !content(employeeForbiddenList.data).some((doc) => doc.id === forbiddenId),
    employeeForbiddenGet: employeeForbiddenGet.status,
    employeeForbiddenPreview: employeeForbiddenPreview.status,
    employeeForbiddenDownload: employeeForbiddenDownload.status,
    employeeAclForbidden: employeeAclForbidden.status,
    aclBeforeStatus: aclBefore.status,
    aclUpdate: aclUpdate.status,
    aclReload: aclReload.status,
    aclReloadHasEmployee: Array.isArray(aclReload.data?.roles) && aclReload.data.roles.includes('EMPLOYE'),
    employeeAfterAclVisible: content(employeeAfter.data).some((doc) => doc.id === allowedId),
    employeeGetAllowed: employeeGetAllowed.status,
    employeePreviewAllowed: employeePreviewAllowed.status,
    employeeDownloadAllowed: employeeDownloadAllowed.status,
    employeeDownloadSize: employeeDownloadAllowed.size,
    employeePrintAllowed: employeePrintAllowed.status,
    employeeAclStillForbidden: employeeAclStillForbidden.status,
    qualityFilteredStatus: qualityFiltered.status,
    qualityFilteredCount: content(qualityFiltered.data).length,
    treeReloadStatus: treeReload.status,
    treeContainsSubFolder: JSON.stringify(treeReload.data ?? []).includes(subFolderId),
    auditLogsStatus: auditLogs.status,
    auditHasDocumentActions: JSON.stringify(content(auditLogs.data)).includes(allowedId),
  };

  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/ged-api-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, checks: report.checks }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
