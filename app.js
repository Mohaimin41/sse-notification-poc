const express = require('express');
const { cached } = require("./db/cached");
const { subscriberClient, publishAsync } = require("./db/redis")
const pool = require("./db/pool");

const port = process.env.PORT || 5050;
const app = express();

let activeSseClients = new Map();

const getUnreadNotifications = async (userId) => {
    try {
        let db_res = await pool.query(
            `SELECT message FROM public.notifications WHERE user_id = $1 AND is_sent = FAlSE;`,
            [userId]
        );

        if (!db_res?.rows?.length === 0) {
            return null;
        }

        return db_res.rows;
    } catch (error) {
        console.error("ERROR AT getUnreadNotifications: ", error);
        return null;
    }
}

const markNotificationAsDelivered = async (userId) => {
    try {
        let db_res = await pool.query(
            `UPDATE public.notifications SET is_sent = TRUE WHERE user_id = $1;`,
            [userId]
        );

        if (!db_res?.rows?.length === 0) {
            return null;
        }

        return db_res.rows;
    } catch (error) {
        console.error("ERROR AT markNotificationAsDelivered: ", error);
        return null;
    }
}

// Handle successful subscription (this is where the confirmation comes)
subscriberClient.on('subscribe', (channel, count) => {
    console.log(`Successfully subscribed to Redis channel "${channel}". Client is now subscribed to ${count} channel(s).`);
    // DO NOT try to JSON.parse or process 'channel' or 'count' as your data here.
});


// Handle incoming messages on subscribed channels
subscriberClient.on('message', (channel, message) => {
    // 'channel' is the name of the channel the message came from
    // 'message' is the actual payload string you published
    console.log(`Received RAW message from Redis channel '${channel}': "${message}"`);

    if (channel === 'notifications_channel') { // Ensure it's the channel you care about
        try {
            const notificationEvent = JSON.parse(message); // Parse the actual data message

            if (notificationEvent && typeof notificationEvent === 'object') {
                const { userId, data } = notificationEvent; // Make sure 'data' is expected

                if (userId) { // Targeted message
                    const clientRes = activeSseClients.get(userId);
                    if (clientRes) {
                        clientRes.write(`data: ${JSON.stringify(data || notificationEvent)}\n\n`);
                        console.log(`Sent notification to user ${userId} via SSE.`);
                    } else {
                        console.log(`SSE client for user ${userId} not found on this instance.`);
                    }
                } else { // Broadcast message (no specific userId in the event)
                    console.log('Broadcasting notification to all SSE clients on this instance.');
                    activeSseClients.forEach((res, sseClientId) => {
                        try {
                            res.write(`data: ${JSON.stringify(data || notificationEvent)}\n\n`);
                            console.log(`Broadcasted to user ${sseClientId}`);
                        } catch (writeError) {
                            console.error(`Error writing broadcast to SSE client ${sseClientId}:`, writeError);
                        }
                    });
                }
            } else {
                console.warn('Received message on notifications_channel is not a valid JSON object:', message);
            }
        } catch (e) {
            console.error(`Error processing message "${message}" from channel "${channel}". Is it valid JSON? Error:`, e);
        }
    }
});

// Actually subscribe the client to the channel
// This should be done once when your application/module starts up.
// Don't do this inside the router.get('/events', ...) as it would re-subscribe on each HTTP request.
subscriberClient.subscribe('notifications_channel');

app.get('/', (req, res) => {
    res.status(200).send({
        message: "Looks like you've hit the root url",
        availableurls: [
            "/write/:key/:value",
            "/read/:key"
        ],
    })
});

app.get('/read/:key', async (req, res) => {
    let val = await cached(async () => {
        try {
            let db_result = await pool.query(
                `SELECT * FROM public.notifications WHERE id = $1`,
                [req.params.key]
            )

            if (!db_result?.rows?.length === 0) {
                return null;
            }

            return db_result.rows[0];
        } catch (error) {
            console.error("ERROR AT second get: ", error);
            res.status(500);
        }

    }, req.params.key, 3600, false)

    res.status(200).json(val);
});

app.get('/write/:key/:value/:uid', async (req, res) => {
    await cached(async () => {
        try {
            let db_result = await pool.query(
                `INSERT INTO public.notifications 
                (message, channel_type, user_id)
                VALUES
                ('hemlo', 'notifications_channel', $1)
                RETURNING *;
                `,
                [req.params.uid]
            )

            if (!db_result?.rows?.length === 0) {
                return null;
            }

            return db_result.rows[0];
        } catch (error) {
            console.error("ERROR AT last get: ", error)
            res.status(500).send({
                status: 'FAIL'
            });
        }

    }, req.params.key, 3600, false)

    // Now, publish a notification event to Redis
    const notificationData = {
        message: `Key '${req.params.key}' was updated to '${req.params.value}'`,
        timestamp: new Date().toISOString(),
        // Include any other relevant data for the frontend
    };

    const redisEvent = {
        userId: req.params.uid, // If you want to target a specific user
        data: notificationData
    };

    try {
        await publishAsync('notifications_channel', JSON.stringify(redisEvent));
        console.log(`Published to 'notifications_channel':`, redisEvent);
    } catch (error) {
        console.error("ERROR AT /write: ", error);
        res.status(500);
    }
    res.status(200).send({
        status: 'OK'
    });
});

// SSE route
app.get('/events/:uid', async (req, res) => {
    const userId = req.params.uid;
    console.log(`SSE connection attempt for user: ${userId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    // 1. Store this client's response object
    activeSseClients.set(userId, res); // Store res object, mapped by userId
    console.log(`User ${userId} connected via SSE. Total clients on this instance: ${activeSseClients.size}`);

    // 2. Send "catch-up" notifications
    try {
        const unreadNotifications = await getUnreadNotifications(userId);// Fetches from PostgreSQL
        unreadNotifications.forEach((notification) => {
            res.write(`data: ${JSON.stringify(notification)}\n\n`);
        });
        // mark as delivered (not necessarily 'read')
        await markNotificationAsDelivered(userId);
    } catch (error) {
        console.error('Error sending catch-up notifications:', error);
    }

    // 3. Keep connection open. Listen for client close
    req.on('close', () => {
        activeSseClients.delete(userId); // Remove client on disconnect
        console.log(`SSE connection closed for user ${userId}`);
    });

    // No res.end() here, connection stays open
});

app.listen(port, () => {
    console.log(`App successfully started on http://localhost:${port}`);
});