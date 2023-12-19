# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis.
The main point is to ensure that any data you store in redis cannot be accessed
by anyone else, without the key.

## Installation
```bash
npm install secure-store-redis
```

## Initialization

```javascript
import SecureStore from "secure-store-redis";

const store = new SecureStore({
  uid: "myApp:store",
  secret: "823HD8DG26JA0LK1239Hgb651TWfs0j1",
  redis: {
    url: 'redis://localhost:6379',
  }
));
await store.init();
```

## Save
```javascript
await store.save("quote", "hello world");
```

### Get
```javascript
let res = await store.get("quote");
// res: 'hello world'
```

## Delete
```javascript
const num = await store.delete("quote");
// num: 1
let res = await store.get("quote");
// res: null
```

## Attempt to fetch encrypted data from another store
```javascript
await store.save("quote", "hello world again");

const otherStore = new SecureStore({
  uid: "myApp:store",
  secret: "this is the wrong secret 32 char",
  redis: {
    url: 'redis://localhost:6379',
  }
});
await otherStore.init();

let res = await otherStore.get("quote");
// res: null
```

## Disconnect from Redis
```javascript
await otherStore.disconnect();
await store.disconnect();
```
