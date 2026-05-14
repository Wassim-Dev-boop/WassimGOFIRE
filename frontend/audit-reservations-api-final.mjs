import fs from 'node:fs/promises';

const API_BASE = 'http://localhost:8088';

const ACCOUNTS = {
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

function futureIso(days, hours = 0) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000).toISOString();
}

function presentielEvent(title, days) {
  return {
    title,
    description: 'Audit réservation réelle.',
    startAt: futureIso(days),
    endAt: futureIso(days, 2),
    location: 'Salle audit',
    eventType: 'REUNION',
    eventMode: 'PRESENTIEL',
    onlineEvent: false,
  };
}

(async () => {
  const employeeToken = await login(ACCOUNTS.employee);
  const roomToken = await login(ACCOUNTS.room);

  const suffix = Date.now();
  const roomCreate = await request(roomToken, 'POST', '/api/v1/rooms', {
    name: `Salle Audit ${suffix}`,
    location: 'Bloc A',
    description: 'Salle créée pendant audit réel',
    capacity: 18,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.createRoom = { status: roomCreate.status, id: roomCreate.data?.id };

  const roomUpdate = await request(roomToken, 'PUT', `/api/v1/rooms/${roomCreate.data.id}`, {
    name: `Salle Audit ${suffix} modifiée`,
    location: 'Bloc A',
    description: 'Salle modifiée pendant audit réel',
    capacity: 20,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.updateRoom = { status: roomUpdate.status, capacity: roomUpdate.data?.capacity };

  const roomMaintenance = await request(roomToken, 'PUT', `/api/v1/rooms/${roomCreate.data.id}`, {
    name: `Salle Audit ${suffix} modifiée`,
    location: 'Bloc A',
    description: 'Salle en maintenance pendant audit',
    capacity: 20,
    status: 'MAINTENANCE',
    active: true,
  });
  report.api.roomMaintenance = { status: roomMaintenance.status, operationalStatus: roomMaintenance.data?.status };

  const employeeCrudRoom = await request(employeeToken, 'POST', '/api/v1/rooms', {
    name: `Salle interdite ${suffix}`,
    location: 'Bloc X',
    capacity: 4,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.employeeRoomCrudForbidden = { status: employeeCrudRoom.status };

  const eventMaintenance = await request(employeeToken, 'POST', '/api/v1/events', presentielEvent(`Audit maintenance salle ${suffix}`, 13));
  const maintenanceReservation = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventMaintenance.data?.id,
    roomId: roomCreate.data.id,
    startAt: futureIso(13),
    endAt: futureIso(13, 2),
    purpose: 'Doit refuser salle maintenance',
  });
  report.api.roomMaintenanceReservationRejected = {
    status: maintenanceReservation.status,
    detail: maintenanceReservation.data?.detail || maintenanceReservation.data?.message,
  };

  const roomReactive = await request(roomToken, 'PUT', `/api/v1/rooms/${roomCreate.data.id}`, {
    name: `Salle Audit ${suffix} modifiée`,
    location: 'Bloc A',
    description: 'Salle réactivée pendant audit',
    capacity: 20,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.roomReactive = { status: roomReactive.status, operationalStatus: roomReactive.data?.status };

  const eventRoom = await request(employeeToken, 'POST', '/api/v1/events', presentielEvent(`Audit réservation salle ${suffix}`, 14));
  const reservationRoom = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventRoom.data?.id,
    roomId: roomCreate.data.id,
    startAt: futureIso(14),
    endAt: futureIso(14, 2),
    purpose: 'Réservation salle audit',
  });
  report.api.reserveRoom = { status: reservationRoom.status, id: reservationRoom.data?.id, state: reservationRoom.data?.status };

  const conflictRoom = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventRoom.data?.id,
    roomId: roomCreate.data.id,
    startAt: futureIso(14, 0.5),
    endAt: futureIso(14, 1.5),
    purpose: 'Conflit salle audit',
  });
  report.api.roomConflictRejected = { status: conflictRoom.status, detail: conflictRoom.data?.detail || conflictRoom.data?.message };

  const roomConflictCheck = await request(employeeToken, 'GET', `/api/v1/reservations/conflicts?roomId=${roomCreate.data.id}&startAt=${encodeURIComponent(futureIso(14, 0.5))}&endAt=${encodeURIComponent(futureIso(14, 1.5))}`);
  report.api.roomConflictCheck = { status: roomConflictCheck.status, conflict: roomConflictCheck.data?.conflict };

  const equipmentCreate = await request(roomToken, 'POST', '/api/v1/equipments', {
    name: `Projecteur Audit ${suffix}`,
    serialNumber: `LOG-${suffix}`,
    description: 'Équipement logistique audit',
    type: 'Projecteur',
    location: 'Magasin logistique',
    totalQuantity: 1,
    availableQuantity: 1,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.createEquipment = { status: equipmentCreate.status, id: equipmentCreate.data?.id };

  const equipmentUpdate = await request(roomToken, 'PUT', `/api/v1/equipments/${equipmentCreate.data.id}`, {
    name: `Projecteur Audit ${suffix} modifié`,
    serialNumber: `LOG-${suffix}`,
    description: 'Équipement logistique audit modifié',
    type: 'Projecteur',
    location: 'Magasin logistique',
    totalQuantity: 1,
    availableQuantity: 1,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.updateEquipment = { status: equipmentUpdate.status, name: equipmentUpdate.data?.name };

  const eventEquipment = await request(employeeToken, 'POST', '/api/v1/events', presentielEvent(`Audit réservation équipement ${suffix}`, 15));
  const reserveEquipment = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventEquipment.data?.id,
    equipmentId: equipmentCreate.data.id,
    quantityRequested: 1,
    startAt: futureIso(15),
    endAt: futureIso(15, 2),
    purpose: 'Réservation équipement audit',
  });
  report.api.reserveEquipment = { status: reserveEquipment.status, id: reserveEquipment.data?.id, state: reserveEquipment.data?.status };

  const equipmentConflict = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventEquipment.data?.id,
    equipmentId: equipmentCreate.data.id,
    quantityRequested: 1,
    startAt: futureIso(15, 0.5),
    endAt: futureIso(15, 1.5),
    purpose: 'Conflit équipement audit',
  });
  report.api.equipmentQuantityConflictRejected = { status: equipmentConflict.status, detail: equipmentConflict.data?.detail || equipmentConflict.data?.message };

  const equipmentConflictCheck = await request(employeeToken, 'GET', `/api/v1/reservations/conflicts?equipmentId=${equipmentCreate.data.id}&quantityRequested=1&startAt=${encodeURIComponent(futureIso(15, 0.5))}&endAt=${encodeURIComponent(futureIso(15, 1.5))}`);
  report.api.equipmentConflictCheck = { status: equipmentConflictCheck.status, conflict: equipmentConflictCheck.data?.conflict };

  const equipmentMaintenance = await request(roomToken, 'PUT', `/api/v1/equipments/${equipmentCreate.data.id}`, {
    name: `Projecteur Audit ${suffix} modifié`,
    serialNumber: `LOG-${suffix}`,
    description: 'Équipement en maintenance audit',
    type: 'Projecteur',
    location: 'Magasin logistique',
    totalQuantity: 1,
    availableQuantity: 1,
    status: 'MAINTENANCE',
    active: true,
  });
  report.api.equipmentMaintenance = { status: equipmentMaintenance.status, operationalStatus: equipmentMaintenance.data?.status };

  const eventEquipmentMaintenance = await request(employeeToken, 'POST', '/api/v1/events', presentielEvent(`Audit maintenance équipement ${suffix}`, 16));
  const reserveMaintenanceEquipment = await request(employeeToken, 'POST', '/api/v1/reservations', {
    eventId: eventEquipmentMaintenance.data?.id,
    equipmentId: equipmentCreate.data.id,
    quantityRequested: 1,
    startAt: futureIso(16),
    endAt: futureIso(16, 2),
    purpose: 'Doit refuser équipement maintenance',
  });
  report.api.equipmentMaintenanceReservationRejected = {
    status: reserveMaintenanceEquipment.status,
    detail: reserveMaintenanceEquipment.data?.detail || reserveMaintenanceEquipment.data?.message,
  };

  const equipmentReactive = await request(roomToken, 'PUT', `/api/v1/equipments/${equipmentCreate.data.id}`, {
    name: `Projecteur Audit ${suffix} modifié`,
    serialNumber: `LOG-${suffix}`,
    description: 'Équipement réactivé après test maintenance audit',
    type: 'Projecteur',
    location: 'Magasin logistique',
    totalQuantity: 1,
    availableQuantity: 1,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.equipmentReactive = { status: equipmentReactive.status, operationalStatus: equipmentReactive.data?.status };

  const employeeEquipmentCrud = await request(employeeToken, 'POST', '/api/v1/equipments', {
    name: `Equipement interdit ${suffix}`,
    serialNumber: `NO-${suffix}`,
    type: 'Interdit',
    totalQuantity: 1,
    availableQuantity: 1,
    status: 'DISPONIBLE',
    active: true,
  });
  report.api.employeeEquipmentCrudForbidden = { status: employeeEquipmentCrud.status };

  report.dataset = {
    roomId: roomCreate.data?.id,
    equipmentId: equipmentCreate.data?.id,
    roomReservationId: reservationRoom.data?.id,
    equipmentReservationId: reserveEquipment.data?.id,
  };

  await fs.mkdir('../rapport/13-soutenance/evidence', { recursive: true });
  const out = '../rapport/13-soutenance/evidence/reservations-api-final.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ status: 'ok', out, dataset: report.dataset }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'error', message: error.message, stack: error.stack }, null, 2));
  process.exit(1);
});
