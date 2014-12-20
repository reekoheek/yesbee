TODO
====

``` 
Legend:
[ ] Ready
[x] Done
[-] Burn
```

- [x] Implement manager
- [x] Implement local runner
- [x] registry
- [x] service: http
- [x] component: http-inbound unit test and fix
- [x] autostart service
- [x] yesbee cli (see nginx)
- [x] pisah-pisahin trace ke masing2 file log
- [-] prompt:     avoid ctrl-c
- [ ] stream cache should move to file if too big
- [ ] dead letter queue
- [ ] back out queue
- [ ] refactor Exchange to Message
- [ ] cli autocomplete
- [ ] cli ctrl-c to close
- [ ] dead letter mechanism
    send
    redeliver for several times
- [ ] implement spawn runner
- [ ] clustering mechanism
    mdns?
- [ ] server unittest
- [ ] component dependency resolver
- [ ] worker-aware context 
        cli should invoke context.start and lets the context.start propagate to other workers
- [ ] 

a -> b'

b -> c'

c -> d

a -> b -> c -> d -> c -> b -> a


in:a 
  id: 1
q:b
  id: 1
in:b 
  id: 2
  cid: 1
out:b
  id: 2
  cid: 1
out:a
  id: 1
  






