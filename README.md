# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis. 
The main point is to ensure that any data you store in redis cannot be accessed 
by anyone else, without the key.


**NOTE** version `2.x` is a rewrite in TypeScript, using async functions, and is 
backwards incompatible with `1.x`


```javascript
const SecureStore = require('secure-store-redis').default;

const store = new SecureStore('myApp:store', '823HD8DG26JA0LK1239Hgb651TWfs0j1', {
  host: 'localhost', // optional
  port: 6379, // optional
  // optionally use the 'url' property to specify entire redis connect string
  // url: 'redis://localhost:6379',
});
await store.init();

await store.save('quote', 'i see dead people');
let res = await store.get('quote');
// res: 'i see dead people'
let res = await store.get('quote');
// res: null
const num = await store.delete('quote');
// num: 1

await store.save('quote', 'i see dead people again');

const otherStore = new SecureStore('myApp:store', 'this is the wrong secret', {
    host: "127.0.0.1",
    port: 6379
});
await otherStore.init();

let res = await otherStore.get('quote');
// res: undefined
```
