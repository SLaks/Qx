#Qx [![Build Status](https://travis-ci.org/SLaks/Qx.png)](https://travis-ci.org/SLaks/Qx)


Qx is a set of extensions to [Q](https://github.com/kriskowal/q) that make it easier to work with promises of arrays of promises.

Qx brings the convenience of C# LINQ methods to Javascript promise arrays.

##Usage
All Qx array methods take an array and a callback function that does things to items in the array. 

All callbacks receive two parameters; the item and its index.  If the array contains promises, Qx will wait for those promises to finish and pass their values to the callback.  If the callback itself returns a promise, Qx will wait for it to finish too.

There are four ways to call these functions:

 1. You can also pass an array and a callback directly: (this is useful if the array is not a promise)
```js
var filenames = process.argv;
Qx.filter(filenames, qfs.isFile)
  .then(function(array) {
	  ...
  });
```

 2. You can pass an array of callbacks, and the Qx method will call each callback with only an index parameter: (this is useful if you have an array of functions that return promises)
```js
var functions = [
	function() { return  somePromise; },
	function() { return otherPromise; },
];
Qx.map(functions)
  .then(function(results) {
	  ...;
  });
```

 3. You can pass a callback only, and the Qx method will return a function that takes an array as a parameter (like #1): (this is useful if you only have a promise of the array; you can pass the Qx call directly to `.then()`)
```js
qfs.list('.')
   .then(Qx.filter(qfs.isDirectory))
   .then(Qx.map(function(d) { return require('./' + d); }))
```

 4. You can pass no arguments, and the Qx method will return a function that expects an array of callbacks (like #2): (this is useful if you have a promise of an array of functions that return promises)
```js
functionsPromise.then(Qx.map)
				.then(function(results) { ... });
```

##Array Methods
These methods can take four different parameters as described above.

###`.filter()`
Like the native `[].filter()` method, this method returns a promise of an array containing only those items from the original array that pass a filter callback.  If the callback returns a (promise of a) falsy value for an item, that item will not appear in the final array.

The resulting array will have the same order as the original array.

###`.map()`
Like the native `[].map()` method, this method returns a promise of an array of items derived from the original array.  Each element in the resulting array will be the result of calling the callback on the corresponding element in the original array.  As usual, all promises will be resolved and ordering will be preserved.

This method can also be used as a `forEach()` method by ignoring return values.

###`.every()`
Like the native `[].every()` method, this method returns a promise of a boolean indicating whether the callback returned a (promise of a) truthy value for every element in the array.

If the callback returns falsy for any element, the resulting promise will be resolved immediately, without waiting for the other promises to complete (although, unlike the short-circuiting `&&` operator, they will always all be evaluated).

If the callback fails for some element (or if the original promise fails) before any callback returns true, the resulting promise will fail immediately.  (if a different promise already returned true, the promise will have already succeeded)

###`.some()`
Like the native `[].some()` method, this method returns a promise of a boolean indicating whether the callback returned a (promise of a) truthy value for at least one element in the array.

The returned promise will be resolved as soon as at least one element returns truthy; it will not wait for the promises from the other elements to be resolved (although, unlike the short-circuiting `||` operator, they will always all be evaluated).  If none of elements return truthy, the promise will be resolved to false after all of them finish.

##Promise methods
###`.any()`
Takes an array of promises, and returns a promise for the result of the first one to succeed.  If all of the promises fail it will return the first failure (but only after all of them fail).

For example:
```js 
var possibleUrls = [ 'http://a.example.com', 'http://b.example.com' ];
Qx.map(possibleUrls, readUrl)
  .then(Qx.any)	// Get the first URL to reply
  .then(function(result) { ... });
```

###`.breakWith()` and `.endFunction`
These methods allow you to exit a promise chain in the middle.  

For example:

```js
function findOrCreateUser(email) {
	return store.findUser(email)
				.then(function(user) {
					if (user)
						return Qx.breakWith(user);

					return webService.getAdditionalDetail(email);
				})
				.then(function(detail) { 
					return store.createUser(detail);
				})
				.fail(Qx.endFunction);
}
```
`Qx.breakWith()` will throw a special marker exception containing the value, which will cause Q to skip all future `.then()` calls.

At the end of the method, calling `.fail(Qx.endFunction)` will catch this marker exception and return the value, rethrowing any other errors.

###`.withBreaks()`
Because `.breakWith()` is implemented by throwing an exception, any error handlers (`.then(null, function)` or `.fail(function)` will incorrectly see these exceptions as false positives.  
To fix this, any error callbacks between `.breakWith()` and `.fail(endFunction)` should be wrapped in `Qx.withBreaks()`:

```js
function findOrCreateUser(email) {
	return store.findUser(email)
				.then(function(user) {
					if (user)
						return Qx.breakWith(user);

					return webService.getAdditionalDetail(email);
				})
				.fail(Qx.withBreaks(function(err) {
					return fallbackWebService.getAdditionalDetail(email);
				})
				.then(function(detail) { 
					return store.createUser(detail);
				})
				.fail(Qx.endFunction);
}
```



##TODO
 - Async locking primitives (mutexes, reader-writer-locks, sempahores, etc that return delaying promises)
 - More array methods (`reduce()`, `sortBy()`, `first()`, `concat()`)
 - `Qx.sequenceMap()` that only runs one callback chain at a time
