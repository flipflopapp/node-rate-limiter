var RateLimiter = require('../index.js')
  ;

var me = this;

var fun = [];

me.ratelimited_fn = function(count, cb) {
    fun.push(count);
    console.log ('Inside: ' + fun);
    var wait = (count%7);
    setTimeout(function() {
        cb(count);
    }, wait*1000);
};

me.ratelimited_fn_callback = function(count) {
    var index = fun.indexOf(count);
    fun.splice(index,1);
    console.log ('Done: ' + count);
};

var params = {
    concurrency: 5
};
me.que = new RateLimiter(params);

for (var idx = 1; idx < 40; idx++) {
    params = [ idx ];
    me.que.callWrapper (me.ratelimited_fn, params, me.ratelimited_fn_callback);
};
