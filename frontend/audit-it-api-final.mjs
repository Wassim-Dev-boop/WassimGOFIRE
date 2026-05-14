import fs from 'node:fs/promises';

const API_BASE = 'http://localhost:8088';

const ACCOUNTS = {
  it: { identifier: 'it.cnstn', password: 'User@12345' },
  employee: { identifier: 'employe.cnstn', password: 'User@12345' },
  room: { identifier: 'salle.cnstn', password: 'User@12345' },
};

const report = {
  timestamp: new Date().toISOString(),
  dataset: {},
  api: {},
};

async function login(account) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Login KO ${account.identifier}: ${response.status} ${text}`);
  return JSON.parse(text).access_token;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  return { status: response.status, ok: response.ok, data };
}

(async () => {
  const tokens = {
    it: await login(ACCOUNTS.it),
    employee: await login(ACCOUNTS.employee),
    room: await login(ACCOUNTS.room),
  };
  const suffix = Date.now();

  const categoriesBefore = await request(tokens.it, 'GET', '/api/v1/it-equipment/categories');
  report.api.categoriesBefore = {
    status: categoriesBefore.status,
    names: Array.isArray(categoriesBefore.data) ? categoriesBefore.data.map((item) => item.name) : [],
  };

  const category = await request(tokens.it, 'POST', '/api/v1/it-equipment/categories', {
    name: `PC Audit ${suffix}`,
    description: 'Catégorie PC créée pour audit réel',
  });
  report.api.createCategory = { status: category.status, id: category.data?.id, name: category.data?.name };

  const create = await request(tokens.it, 'POST', '/api/v1/it-equipment', {
    name: `PC Audit ${suffix}`,
    serialNumber: `IT-${suffix}`,
    categoryId: category.data.id,
    brand: 'Dell',
    model: 'Latitude Audit',
    state: 'OPERATIONAL',
    description: 'Équipement IT créé pendant audit réel',
  });
  report.api.createEquipment = { status: create.status, id: create.data?.id, assignmentStatus: create.data?.assignmentStatus };

  const update = await request(tokens.it, 'PUT', `/api/v1/it-equipment/${create.data.id}`, {
    name: `PC Audit ${suffix} modifié`,
    serialNumber: `IT-${suffix}`,
    categoryId: category.data.id,
    brand: 'Dell',
    model: 'Latitude Audit 2',
    state: 'OPERATIONAL',
    description: 'Équipement IT modifié pendant audit réel',
  });
  report.api.updateEquipment = { status: update.status, model: update.data?.model };

  const assign = await request(tokens.it, 'POST', '/api/v1/it-equipment/assignments', {
    equipmentId: create.data.id,
    employeeId: 'employe.cnstn',
  });
  report.api.assignEquipment = { status: assign.status, assignmentId: assign.data?.id, employeeId: assign.data?.employeeId };

  const myEquipment = await request(tokens.employee, 'GET', '/api/v1/it-equipment/my');
  report.api.employeeMyEquipment = {
    status: myEquipment.status,
    containsCreated: Array.isArray(myEquipment.data) && myEquipment.data.some((item) => item.id === create.data.id),
    totalVisible: Array.isArray(myEquipment.data) ? myEquipment.data.length : null,
  };

  const employeeListForbidden = await request(tokens.employee, 'GET', '/api/v1/it-equipment?page=0&size=10');
  report.api.employeeListAllForbidden = { status: employeeListForbidden.status };

  const employeeDirectForbidden = await request(tokens.employee, 'GET', `/api/v1/it-equipment/${create.data.id}`);
  report.api.employeeDirectEquipmentForbidden = { status: employeeDirectForbidden.status };

  const roomManagerForbidden = await request(tokens.room, 'GET', '/api/v1/it-equipment?page=0&size=10');
  report.api.roomManagerItForbidden = { status: roomManagerForbidden.status };

  const historyAssigned = await request(tokens.it, 'GET', `/api/v1/it-equipment/assignments/equipment/${create.data.id}/history`);
  report.api.historyAfterAssign = { status: historyAssigned.status, count: Array.isArray(historyAssigned.data) ? historyAssigned.data.length : null };

  const returned = await request(tokens.it, 'POST', `/api/v1/it-equipment/assignments/${assign.data.id}/return`);
  report.api.returnEquipment = { status: returned.status, returnedAt: returned.data?.returnedAt, assignmentStatus: returned.data?.status };

  const myEquipmentAfterReturn = await request(tokens.employee, 'GET', '/api/v1/it-equipment/my');
  report.api.employeeMyEquipmentAfterReturn = {
    status: myEquipmentAfterReturn.status,
    containsCreated: Array.isArray(myEquipmentAfterReturn.data) && myEquipmentAfterReturn.data.some((item) => item.id === create.data.id),
  };

  const maintenance = await request(tokens.it, 'PATCH', `/api/v1/it-equipment/${create.data.id}/state`, {
    state: 'IN_MAINTENANCE',
  });
  report.api.setMaintenance = { status: maintenance.status, state: maintenance.data?.state };

  const operational = await request(tokens.it, 'PATCH', `/api/v1/it-equipment/${create.data.id}/state`, {
    state: 'OPERATIONAL',
  });
  report.api.reactivateEquipment = { status: operational.status, state: operational.data?.state };

  const archive = await request(tokens.it, 'DELETE', `/api/v1/it-equipment/${create.data.id}/archive`);
  report.api.archiveEquipment = { status: archive.status };

  report.dataset = {
    categoryId: category.data?.id,
    equipmentId: create.data?.id,
    assignmentId: assign.data?.id,
  };

  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/it-api-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, dataset: report.dataset }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
