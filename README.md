##### Get blockchain

```
curl http://localhost:3010/v2/blocks
```

##### See transaction pool

```
curl http://localhost:3010/v2/transactionPool
```

##### Get Node balance

```
curl http://localhost:3010/v2/balance
```

##### Get balance of a specific address

```
curl http://localhost:3010/v2/balance/:address
```

#### Query information about a specific address

```
curl http://localhost:3010/v2/address/:address
```

#### Connected Active Master Peers

```
curl http://localhost:3010/v2/peers
```

##### Fig a block

```
curl -X POST http://localhost:3010/v2/figBlock
```

##### Send Node Transaction to Pool

```
curl -H "Content-type: application/json" --data '{"address": "any publickey", "amount" : 35, "key" : "node secretkey"}' http://localhost:3010/v2/sendTransactionToPool
```

##### Send Free Wallet Transaction to Pool

```
curl -H "Content-type: application/json" --data '{"publicKey" : "any public key", "privateKey" : "any public keys private key", "toPublicKey" : "to any public key", "amount" : 35}' http://localhost:3010/v2/sendFromWalletTransactionToPool
```
