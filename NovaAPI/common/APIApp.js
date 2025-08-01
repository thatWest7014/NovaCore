const express = require('express');
const { getData } = require('../../src/firebaseAdmin'); // Development Prod bot data replica (source)
const { setAPIData } = require('./Database'); // API RTDB (target)
const settings = require('../../settings.json');

const app = express();
app.use(express.json());

// --- Helper: Recursively copy objects ---
async function recursiveSetAPIData(path, obj) {
    if (typeof obj !== 'object' || obj === null) {
        await setAPIData(path, obj);
        return;
    }
    await setAPIData(path, {}); // Ensure the node exists
    for (const key of Object.keys(obj)) {
        await recursiveSetAPIData(`${path}/${key}`, obj[key]);
    }
}

// --- Helper: IP and config check middleware ---
const ALLOWED_IP = 'YOUR_IP_ADDRESS';
const API_KEY = process.env.NOVA_API_KEY;

function apiAccessGuard(req, res, next) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const apiKey = req.headers['x-api-key'];

    console.log(`[API Guard] Incoming request from IP: ${clientIp}`);
    console.log(`[API Guard] API key provided: ${apiKey ? '[REDACTED]' : 'None'}`);

    const isLocalhost =
        clientIp === '127.0.0.1' ||
        clientIp === '::1' ||
        clientIp === '::ffff:127.0.0.1';

    const isAllowedIP = clientIp === ALLOWED_IP;

    if (isLocalhost || isAllowedIP) {
        console.log('[API Guard] IP allowed.');
        return next();
    }

    if (apiKey && apiKey === API_KEY) {
        console.log('[API Guard] Valid API key.');
        return next();
    }

    console.warn('[API Guard] Forbidden access. IP or API key check failed.');
    return res.status(403).json({ error: 'Forbidden' });
}


// --- /newcache endpoint with recursion ---
app.get('/newcache', async (req, res) => {
    console.log("[/newcache] Route hit");
    try {
        const { guildId, userId } = req.query;
        const actions = [];

        console.log(`[newcache] guildId: ${guildId}, userId: ${userId}`);

        if (!guildId && !userId) {
            console.log("[newcache] No guildId or userId provided. Syncing all guild/user data.");
            actions.push((async () => {
                const gs = await getData(`/guildsettings`);
                if (gs) {
                    console.log("[newcache] Retrieved full guildsettings.");
                    await recursiveSetAPIData(`/cache/guildsettings`, gs);
                } else {
                    console.warn("[newcache] No guildsettings data found.");
                }
            })());
            actions.push((async () => {
                const ud = await getData(`/userdata`);
                if (ud) {
                    console.log("[newcache] Retrieved full userdata.");
                    await recursiveSetAPIData(`/cache/userdata`, ud);
                } else {
                    console.warn("[newcache] No userdata found.");
                }
            })());
        }

        if (guildId) {
            console.log(`[newcache] Fetching data for guildId: ${guildId}`);
            actions.push((async () => {
                const gs = await getData(`/guildsettings/${guildId}/GuildSettings`);
                if (gs) {
                    console.log("[newcache] Retrieved GuildSettings for guild.");
                    await recursiveSetAPIData(`/cache/${guildId}/GuildSettings`, gs);
                } else {
                    console.warn("[newcache] No GuildSettings found.");
                }
            })());
            actions.push((async () => {
                const tcfg = await getData(`/guildsettings/${guildId}/TicketCFG/GuildTicketConfig`);
                if (tcfg) {
                    console.log("[newcache] Retrieved GuildTicketConfig.");
                    await recursiveSetAPIData(`/cache/${guildId}/GuildTicketConfig`, tcfg);
                } else {
                    console.warn("[newcache] No GuildTicketConfig found.");
                }
            })());
        }

        if (userId) {
            console.log(`[newcache] Fetching data for userId: ${userId}`);
            actions.push((async () => {
                const udata = await getData(`/userdata/${userId}/UserData`);
                if (udata) {
                    console.log("[newcache] Retrieved UserData.");
                    await recursiveSetAPIData(`/cache/${userId}/UserData`, udata);
                } else {
                    console.warn("[newcache] No UserData found.");
                }
            })());
        }

        await Promise.all(actions);
        console.log("[/newcache] Cache updated successfully.");
        res.json({ message: "Cache populated successfully" });
    } catch (error) {
        console.error("[/newcache] Error occurred:", error);
        res.status(500).json({ error: "Failed to update cache" });
    }
});

// --- New endpoints for direct RTDB access (protected) ---

// List all guild IDs
app.get('/botguilds', apiAccessGuard, async (req, res) => {
    try {
        const guilds = await getData('/guildsettings');
        res.json({ guilds: guilds ? Object.keys(guilds) : [] });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guilds" });
    }
});

// Guild count
app.get('/guildcount', apiAccessGuard, async (req, res) => {
    try {
        const guilds = await getData('/guildsettings');
        res.json({ count: guilds ? Object.keys(guilds).length : 0 });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guild count" });
    }
});

// Guild settings
app.get('/guildsettings/:guildId', apiAccessGuard, async (req, res) => {
    try {
        const data = await getData(`/guildsettings/${req.params.guildId}`);
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guild settings" });
    }
});

// Guild roles
app.get('/guildroles/:guildId', apiAccessGuard, async (req, res) => {
    try {
        const data = await getData(`/guildsettings/${req.params.guildId}/roles`);
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guild roles" });
    }
});

// Guild channels
app.get('/guildchannels/:guildId', apiAccessGuard, async (req, res) => {
    try {
        const data = await getData(`/guildsettings/${req.params.guildId}/channels`);
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guild channels" });
    }
});

// Guild users
app.get('/guildusers/:guildId', apiAccessGuard, async (req, res) => {
    try {
        const data = await getData(`/guildsettings/${req.params.guildId}/users`);
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch guild users" });
    }
});

// List all user IDs
app.get('/users', apiAccessGuard, async (req, res) => {
    try {
        const users = await getData('/userdata');
        res.json({ users: users ? Object.keys(users) : [] });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// User data
app.get('/userdata/:userId', apiAccessGuard, async (req, res) => {
    try {
        const data = await getData(`/userdata/${req.params.userId}`);
        res.json(data || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user data" });
    }
});

// Refreshes the cache by re-fetching and overwriting it
app.get('/updatecache', async (req, res) => {
    try {
        // Same behavior as /newcache, since setAPIData overwrites anyway
        await app._router.handle({ ...req, url: '/newcache' }, res, () => {});
    } catch (error) {
        console.error("[/updatecache]", error);
        res.status(500).json({ error: "Failed to refresh cache" });
    }
});

// Clears cache entries in the API RTDB
app.get('/clearcache', async (req, res) => {
    try {
        const { guildId, userId } = req.query;
        const { removeAPIData } = require('./Database');

        const tasks = [];

        if (guildId) {
            tasks.push(removeAPIData(`/cache/${guildId}/GuildSettings`));
            tasks.push(removeAPIData(`/cache/${guildId}/GuildTicketConfig`));
        }

        if (userId) {
            tasks.push(removeAPIData(`/cache/${userId}/UserData`));
        }

        await Promise.all(tasks);
        res.json({ message: "Cache cleared successfully" });
    } catch (error) {
        console.error("[/clearcache]", error);
        res.status(500).json({ error: "Failed to clear cache" });
    }
});

const PORT = settings.ports.NovaAPI;
if (!global.__NOVAAPI_STARTED) {
    app.listen(PORT, () => {
        console.log(`NovaAPI running on http://localhost:${PORT}/`);
    });
    global.__NOVAAPI_STARTED = true;
}
