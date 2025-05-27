### sse-notification-poc

Proof of concept of real time notification using server-sent events(SSE) with Redis and Postgresql. 

#### running 
- First, start the Redis and Postgresql containers using `docker compose up -d` command.
- Now start the development server using `npm run dev`
- In any browser/API tool, first call the SSE route to start a SSE connection, this will not close untill closed by user (in this case). Give a userid of your choice.
- Write some values using the write api, notification will be sent via the relevant user's SSE route
- The browser tab/API tool open with the SSE route will immediately see the notification
- Can check values using the read api

#### Routes
##### GET /read/:key
Returns from database the value stored for this key  
```
query parameters:
{
  "key" : 1
}

response:
{
  "id": 1,
  "message": "hemlo",
  "channel_type": "notifications_channel",
  "is_sent": false,
  "is_viewed": false,
  "created_at": "2025-05-27T11:01:16.195Z",
  "user_id": 1
}
```

##### GET /write/:key/:value/:uid
Write the value for this key, with the user id uid. This will also publish a notification to a Redis channel.
```
query parameters:
{
  "key": 1,
  "value": "apple",
  "uid": 1 // this is the user to whom the notification for this write will be sent
}

response:
{
  "status": "ok"
}
```

##### GET /events/:uid
SSE endpoint, connection to this endpoint will not end untill client terminates it. This will first fetch unread user notifications and stream them to user. After that the connection object it creates for the user will be used to stream any published notification to the user.

```
query parameters:
{
  // this is the user id the server will use to identify,
  // keep this same as previous api call to see notification, different to not see notification
  "uid": 1 
}

responses 1:
data:
  {
    "message":"hemlo"
  }


responses 2:
data:
  {
    "message": "Key '2' was updated to 'oranges'",
    "timestamp":"2025-05-27T17:09:10.132Z"
  }
```
Note these are text streams containing json in the data field.

