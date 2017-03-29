# secure-store-redis

A simple wrapper to encrypt and decrypt data stored in redis. The main point is to ensure that any data you store in redis cannot be accessed by anyone else outside of the process, without the key.


```javascript
var SecureStore = require('secure-store-redis');

var store = new SecureStore({
    namespace: 'myApp:store',
    secret: 'quacks like a duck',
    errorOnNotFound: true, //optional; will cb error if data can't be found
    redis: { // standard redis config object
        host: "127.0.0.1",
        port: 6379
    }
});

store.save('quote', 'i see dead people', function (err, reply) {
    //...
    store.get('quote', function (err, reply) {
        // err: null
        // reply: 'i see dead people'
    });
    store.get('quote', function (err, reply) {
        // err: record not found
        // reply: undefined
    });
});



var otherStore = new SecureStore({
    prefix: 'myApp:store',
    secret: 'this is the wrong secret',
    redis: { // standard redis config object
        host: "127.0.0.1",
        port: 6379
    }
});

otherStore.get('quote', function (err, reply) {
        // err: record not found
        // reply: undefined
    });
```
