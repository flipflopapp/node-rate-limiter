node-rate-limiter
=================

Rate limit any APIs/functions by using this rate limiter.

This module has been used extensively in http://www.ecosystm.co .

How to use
==========

1. Installation

        npm install ffratelimiter

1. Create an constructor.

        var RateLimiter = require('./node_modules/ffratelimiter');

2. Create a rate limited queue with the above constructor.


        var params = {
            limit: NUMBER,          // default: 0
            window: NUMBER,         // default: 0
            concurrency: NUMBER,    // default: 1
            attempts: NUMBER,       // default: 1
            runforever: BOOLEAN     // default: false
        };

        var ratelimiter = new RateLimiter(params);


    Here is a description of arguments of the constructor.

    1. limit = max. number of calls (ignored if window is 0)
    2. window = time window for rate limiting (0 if there is no window)
    3. concurrency = number of parallel
    4. attempts = number of attempts to make before failing
    5. runforever = forever keep running

    NOTE: when using runforever, if there is a roll-over from last item
    to first item, then any new items added to work_queue will have to
    wait until all the earlier items are processed. (where items refer to
    the arguments for rate-limited function).

    This is simply bad algo and has been done to keep things simple. We
    were observing issues with using shift and push in the work_queue inside

3. Start inserting functions to be called into the queue, using the below function.

        this.callWrapper (fn, params, callback, scope)

    1. fn = function to be called each time. It will be called with
       arguments in params, followed by an internal callback function
    2. params = arguments passed to function fn
    3. callback = Called after successfully or unsuccessfully executing fn
       (in case of unsuccessful execution, and if attempts (say to 'n') is 
       set, we try calling the function again for n times)
    4. scope = a scope for the callback [optional]

Examples
========

Check under tests folder.
