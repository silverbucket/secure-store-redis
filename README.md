# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis. The main point is to ensure that any data you store in redis cannot be accessed by anyone else outside of the process, without the key.


```javascript
var SecureStore = require('secure-store-redis');

var store = new SecureStore({
    prefix: 'myApp:store',
    secret: 'quacks like a duck',
    redis: { // standard redis config object
        host: "127.0.0.1",
        port: 6379
    }
});

store.save('quote', 'i see dead people');

store.get('quote'); // returns 'i see dead people'
store.get('blahblah'); // return undefined

var otherStore = new SecureStore({
    prefix: 'myApp:store',
    secret: 'this is the wrong secret',
    redis: { // standard redis config object
        host: "127.0.0.1",
        port: 6379
    }
});

store.get('quote'); // returns undefined
```
