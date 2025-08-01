const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../../keys/API-Acct-Key.json');
const settings = require('../../settings.json');

let db;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "YOUR_FIREBASE_RTDB_URL"
    });
}
db = admin.database();

/**
 * Checks if a string is Base64 encoded.
 * @param {string} str - The string to check.
 * @returns {boolean} - True if valid Base64, false otherwise.
 */
function isBase64(str) {
    if (!str || typeof str !== 'string') return false;
    if (str.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(str)) return false;

    try {
        return Buffer.from(str, 'base64').toString('utf-8').length > 0;
    } catch {
        return false;
    }
}

/**
 * Get data from a specific path in the database.
 * @param {string} path - The path to the data.
 * @returns {Promise<any>} - The decoded data at the specified path.
 */
async function getAPIData(path) {
    const snapshot = await db.ref(path).once('value');
    const value = snapshot.val();

    if (value === null) {
        console.warn(`Warning: No data found at path "${path}"`);
        return null;
    }

    if (typeof value === 'string' && isBase64(value)) {
        return Buffer.from(value, 'base64').toString('utf-8');
    }

    return value;
}

/**
 * Set data at a specific path in the database.
 * Strings are Base64-encoded, but numbers are stored as-is.
 * @param {string} path - The exact path to set data.
 * @param {any} data - The data to store.
 * @returns {Promise<void>}
 */
async function setAPIData(path, data) {
    const processedData = (typeof data === 'string')
        ? Buffer.from(data, 'utf-8').toString('base64')
        : data;

    await db.ref(path).set(processedData);
}

/**
 * Update specific fields at a given path in the database.
 * Strings are Base64-encoded, but numbers are stored as-is.
 * @param {string} path - The path to update data.
 * @param {object} updates - An object containing key-value pairs to update.
 * @returns {Promise<void>}
 */
async function updateAPIData(path, updates) {
    const processedUpdates = {};
    for (const key in updates) {
        processedUpdates[key] = (typeof updates[key] === 'string')
            ? Buffer.from(updates[key], 'utf-8').toString('base64')
            : updates[key];
    }

    await db.ref(path).update(processedUpdates);
}

/**
 * Remove data at a specific path in the database.
 * @param {string} path - The path to remove data.
 * @returns {Promise<void>}
 */
async function removeAPIData(path) {
    await db.ref(path).remove();
}

module.exports = {
    getAPIData,
    setAPIData,
    updateAPIData,
    removeAPIData
};
