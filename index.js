/*
 * RateLimiter module is used to add rate limit to a function.
 *
 *
 *
 * Create an constructor.
 *
 * Constructor format when we want a window and limit.
 *
 *     var params = {
 *         limit: NUMBER,          // default: 0
 *         window: NUMBER,         // default: 0
 *         concurrency: NUMBER,    // default: 1
 *         attempts: NUMBER,       // default: 1
 *         runforever: BOOLEAN     // default: false
 *     };
 *
 *     var ratelimiter = new RateLimiter(params);
 *
 *
 * Here is a description of arguments of the constructor.
 *
 *     1. limit = max. number of calls (ignored if window is 0)
 *     2. window = time window for rate limiting (0 if there is no window)
 *     3. concurrency = number of parallel
 *     4. attempts = number of attempts to make before failing
 *     5. runforever = forever keep running
 *
 *     NOTE: when using runforever, if there is a roll-over from last item
 *     to first item, then any new items added to work_queue will have to
 *     wait until all the earlier items are processed. (where items refer to
 *     the arguments for rate-limited function).
 *
 *     This is simply bad algo and has been done to keep things simple. We
 *     were observing issues with using shift and push in the work_queue inside
 *     the 'done' event. Some items were being processed 2 times, one after the
 *     other. Expected reason is that, arrays in javascript are not really arrays
 *     but are key-value pairs (and not ordered).
 *
 *
 *
 *
 * this.callWrapper (fn, params, callback, scope)
 *
 *     1. fn = function to be called each time. It will be called with
 *        arguments in params, followed by an internal callback function
 *     2. params = arguments passed to function fn
 *     3. callback = Called after successfully or unsuccessfully executing fn
 *        (in case of unsuccessful execution, and if attempts (say to 'n') is 
 *        set, we try calling the function again for n times)
 *     4. scope = a scope for the callback [optional]
 *
 *
 */

var Events = require('events')
  ;

var RateLimiter = function(params) {
    var me = this;

    me.limit = params.limit || 0;
    me.window = params.window || 0;
    me.concurrency = params.concurrency || 1;
    me.attempts = params.attempts || 1;
    me.runforever = params.runforever || false;

    // count of concurrent calls made
    me.count = 0;

    // work queue - JSON parameters 
    me.work_queue = [];
    if (me.runforever)
        me.work_queue_idx = 0;

    // we need to store all times at which API calls 
    // were made
    me.apiCallTimes = [];

    me.events = new Events.EventEmitter();

    me.events.on ('done', function() {

        // NOTE: if there is a roll-over (in case of run forever), and
        // we reset the queue index back to 0, any new items inserted to 
        // work_queue would be delayed until all the older items are
        // processed. This is simply bad scheduling done to keep things simple.

        var a = null;
        if (me.runforever) {
            a = me.work_queue[me.work_queue_idx++];
            if(!a) {
                // reset to 0, if we reach the end of the queue
                a = me.work_queue[0];
                me.work_queue_idx = 1;
            }
        } else {
            // free up memory, if we are not using runforever
            a = me.work_queue[0];
            me.work_queue = me.work_queue.slice(1);
        }

        // call the rate-limited function

        if (a && a.length > 0) {
            me._callWrapper.apply(me, a);
        } else if (me.work_queue.length > 0) {
            // double check - finishing the queue
            me.events.emit('done');
        }
    });

    arguments = null; // garbage collection
};

(function() {

    /* A wrapper that adds rate limiting to calling fn.
     *
     * 1. fn = function to be called each time. It will be called with
     *    two arguments (params, internal callback function)
     * 2. params = Call the above function fn with params as a parameter
     * 3. callback = Called after successfully or unsuccessfully executing fn
     *    (in case of unsuccessful execution, try calling the function again)
     * 4. scope = a scope for the callback [optional]
     */

    this.callWrapper = function(fn, params, callback, scope) {
        this._callWrapper(fn, params, callback, scope, 0);
    };

    this._callWrapper = function(fn, params, callback, scope, attempts) {
        var me = this;
        var _arguments = arguments;
        params = params || [];

        // refresh apiCallTimes, remove old entries
        var oldest = 0;
        var timeout = 0;
        var now = new Date().getTime();
        while ( me.apiCallTimes.length > 0 ) {
            oldest = me.apiCallTimes[0];
            if ( now - oldest < me.window ) {
                // wait some more time
                break;
            }
            me.apiCallTimes.shift();
        }

        if ( me.count >= me.concurrency || // too many concurrent calls
             ( me.window > 0 && me.apiCallTimes.length >= me.limit ) ) { // too many calls within a window

            //console.log ( "WAIT " + me.count + ", " + me.apiCallTimes.length );
            me.work_queue.push (_arguments);

            // if we have made too many API calls

            //console.log ("Current queue length: " + me.apiCallTimes.length);
            if ( me.window > 0 && me.apiCallTimes.length >= me.limit ) {

                // wait for a minimum timeout and fire again

                timeout = me.window - (now - me.apiCallTimes[0]);
                //console.log ("TIMEOUT " + timeout);
                setTimeout (function() {
                    me.events.emit ('done');
                }, timeout);

            }
            return;
        }

        // recent to last
        me.apiCallTimes.push ( now );
        ++me.count;

        var callbackWrapper = function(err) {
            // regiser a successful call or register an error
            --me.count;

            // lets be a little pessimistic about when we
            // think we made the call

            var now1 = new Date().getTime();
            var idx = me.apiCallTimes.indexOf (now);
            if ( idx >= 0 ) {
                me.apiCallTimes.splice (idx, 1);
            }
            me.apiCallTimes.push (now1);

            if ( err ) {
                if ( ++attempts < me.attempts ) {
                    //console.log ("TRY AGAIN");
                    me.work_queue.push (_arguments);
                    // not calling callback with an error - we will try again
                } else {
                    //console.log ( "TOO MANY FAILS for " + params );
                    callback.apply(undefined, arguments);
                }
            } else {
                callback.apply(undefined, arguments);
            }
            me.events.emit ('done');
        };

        var args = params.concat( callbackWrapper );
        fn.apply(scope, args); // no scope information
    };

}).call (RateLimiter.prototype);
module.exports = RateLimiter;
