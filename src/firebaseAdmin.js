const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../keys/serviceAccountKey.json');
const settings = require('../settings.json');
const mutex = require('../core/APIs/Mutex');

let db;

if (settings.useremotedb) {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "YOUR_FIREBASE_RTDB_URL"
        });
    }
    db = admin.database();
}

const localDbPath = path.join(__dirname, '../localdb.json');

function readLocalDb() {
    const data = fs.readFileSync(localDbPath, 'utf-8');
    return JSON.parse(data);
}

function writeLocalDb(data) {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function getData(path) {
    await mutex.lock();
    try {
        if (settings.useremotedb) {
            const snapshot = await db.ref(path).once('value');
            const value = snapshot.val();

            if (value === null) {
                console.warn(`Warning: No data found at path "${path}"`);
                return null;
            }

            return value;
        } else {
            const localDb = readLocalDb();
            const keys = path.split('/');
            let value = localDb;

            for (const key of keys) {
                value = value[key];
                if (value === undefined) {
                    console.warn(`Warning: No data found at path "${path}"`);
                    return null;
                }
            }

            return value;
        }
    } finally {
        mutex.unlock();
    }
}

async function setData(path, data) {
    await mutex.lock();
    try {
        if (settings.useremotedb) {
            await db.ref(path).set(data);
        } else {
            const localDb = readLocalDb();
            const keys = path.split('/');
            let current = localDb;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key]) current[key] = {};
                current = current[key];
            }

            current[keys[keys.length - 1]] = data;
            writeLocalDb(localDb);
        }
    } finally {
        mutex.unlock();
    }
}

async function updateData(path, updates) {
    await mutex.lock();
    try {
        if (settings.useremotedb) {
            await db.ref(path).update(updates);
        } else {
            const localDb = readLocalDb();
            const keys = path.split('/');
            let current = localDb;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key]) current[key] = {};
                current = current[key];
            }

            const lastKey = keys[keys.length - 1];
            current[lastKey] = { ...current[lastKey], ...updates };
            writeLocalDb(localDb);
        }
    } finally {
        mutex.unlock();
    }
}

async function removeData(path) {
    await mutex.lock();
    try {
        if (settings.useremotedb) {
            await db.ref(path).remove();
        } else {
            const localDb = readLocalDb();
            const keys = path.split('/');
            let current = localDb;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key]) return;
                current = current[key];
            }

            delete current[keys[keys.length - 1]];
            writeLocalDb(localDb);
        }
    } finally {
        mutex.unlock();
    }
}

module.exports = {
    getData,
    setData,
    updateData,
    removeData
};
