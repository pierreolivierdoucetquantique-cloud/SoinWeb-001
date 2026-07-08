// =========================================================
// Ntabou Aka Wé — API — db.js
//
// Base de données SQLite réelle, partagée sur le serveur (remplace
// localStorage). Utilise le module SQLite natif de Node.js
// (node:sqlite, disponible depuis Node 22.5+) — aucune compilation
// native requise, contrairement à better-sqlite3 (utilisé par le
// site de Vicky). Même finalité, déploiement plus simple/fiable.
// =========================================================

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'ntabou.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    age INTEGER,
    phone TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'client',
    blocked INTEGER NOT NULL DEFAULT 0,
    block_reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    service TEXT NOT NULL,
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'client',
    recurring_group_id TEXT,
    blocked INTEGER NOT NULL DEFAULT 0,
    block_label TEXT,
    reminder_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    service TEXT NOT NULL,
    service_id TEXT NOT NULL,
    formula_title TEXT,
    appointment_id TEXT,
    amount REAL NOT NULL DEFAULT 0,
    tps REAL NOT NULL DEFAULT 0,
    tvq REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    duration TEXT,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    transaction_reference TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS formulas (
    id TEXT PRIMARY KEY,
    service_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    duration TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    service TEXT NOT NULL,
    text TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS weekly_hours (
    service_id TEXT NOT NULL,
    day_key TEXT NOT NULL,
    ranges_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (service_id, day_key)
  );

  CREATE TABLE IF NOT EXISTS vacations (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS blocked_slots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    time TEXT,
    duration INTEGER,
    label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS notifications_log (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL DEFAULT 'email',
    type TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payment_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    taxes_enabled INTEGER NOT NULL DEFAULT 0,
    tps_rate REAL NOT NULL DEFAULT 5,
    tvq_rate REAL NOT NULL DEFAULT 9.975,
    interac_email TEXT NOT NULL DEFAULT 'pierreolivierdoucet.quantique@gmail.com'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.prepare('INSERT OR IGNORE INTO payment_settings (id) VALUES (1)').run();

// ---- Formules par défaut (au premier démarrage seulement) ----
const formulaCount = db.prepare('SELECT COUNT(*) AS n FROM formulas').get().n;
if (formulaCount === 0) {
  const insertFormula = db.prepare(`
    INSERT INTO formulas (id, service_id, title, price, duration, description, featured, sort_order)
    VALUES (@id, @serviceId, @title, @price, @duration, @description, @featured, @order)
  `);
  const defaults = [
    { id: 'f_se_1', serviceId: 'services-energetiques', title: 'Séance découverte', price: 60, duration: '45 min', description: 'Une première séance pour ressentir le soin et identifier vos besoins prioritaires.', featured: 0, order: 1 },
    { id: 'f_se_2', serviceId: 'services-energetiques', title: 'Séance complète', price: 90, duration: '75 min', description: 'Le format recommandé pour un travail en profondeur sur les blocages identifiés.', featured: 1, order: 2 },
    { id: 'f_se_3', serviceId: 'services-energetiques', title: 'Forfait 3 séances', price: 240, duration: '3×75 min', description: 'Pour un suivi rapproché, avec un espacement adapté entre chaque rendez-vous.', featured: 0, order: 3 },
    { id: 'f_ac_1', serviceId: 'accompagnement', title: 'Séance de cadrage', price: 80, duration: '60 min', description: 'Le premier rendez-vous, pour poser les bases de votre accompagnement personnalisé.', featured: 0, order: 1 },
    { id: 'f_ac_2', serviceId: 'accompagnement', title: 'Suivi sur 3 mois', price: 450, duration: '6 séances', description: 'Un rythme bimensuel pour ancrer durablement votre transformation sur le moyen terme.', featured: 1, order: 2 },
    { id: 'f_ac_3', serviceId: 'accompagnement', title: 'Suivi sur 6 mois', price: 800, duration: '12 séances', description: 'Pour un cheminement long, avec un accompagnement continu et un suivi approfondi.', featured: 0, order: 3 }
  ];
  const insertMany = (rows) => { rows.forEach(r => insertFormula.run(r)); };
  insertMany(defaults);
}

// ---- Horaires hebdomadaires par défaut (9h-17h, lun-ven, pour chaque service) ----
const hoursCount = db.prepare('SELECT COUNT(*) AS n FROM weekly_hours').get().n;
if (hoursCount === 0) {
  const insertHours = db.prepare('INSERT INTO weekly_hours (service_id, day_key, ranges_json) VALUES (?, ?, ?)');
  const services = ['services-energetiques', 'accompagnement'];
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const weekend = ['sat', 'sun'];
  services.forEach(s => {
    weekdays.forEach(d => insertHours.run(s, d, JSON.stringify([{ start: '09:00', end: '17:00' }])));
    weekend.forEach(d => insertHours.run(s, d, JSON.stringify([])));
  });
}

// ---- Migration : suppression définitive du module "Soins Direct" ----
// Le service a été retiré du projet (voir mission d'audit). On purge toute
// donnée résiduelle liée à 'soins-direct' dans les tables partagées, une
// seule fois par démarrage (idempotent — DELETE n'échoue jamais si vide).
db.exec(`
  DELETE FROM formulas WHERE service_id = 'soins-direct';
  DELETE FROM weekly_hours WHERE service_id = 'soins-direct';
  DELETE FROM appointments WHERE service_id = 'soins-direct';
  DELETE FROM transactions WHERE service_id = 'soins-direct';
  DELETE FROM testimonials WHERE service = 'soins-direct';
`);

module.exports = { db };
