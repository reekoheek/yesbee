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
- [ ] synchronize run between worker, if there are more than 1 broker, sync run will make sure there will be only ONE to be ran

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
  

message: 
  #1: address: queue://foo/anu
  #2: address: /anu
  #3: address: /anu

exchange:
  foo


foo
  foo/1
  foo/2


bar
  bar/1
  bar/2
  bar/3

baz
  baz/1
  baz/2