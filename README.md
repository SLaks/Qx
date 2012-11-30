#Qx

Qx is a set of extensions to [Q](https://github.com/kriskowal/q) that make it easier to work with promises of arrays of promises.

##Usage
Unless specified otherwise, all Qx methods take an array and a callback function that does things to items in the array. 

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

##Methods

###`.filter()`
Like the native `[].filter()` method, this method returns a promise of an array containing only those items from the original array that pass a filter callback.  If the callback returns a (promise of a) falsy value for an item, that item will not appear in the final array.

The resulting array will have the same order as the original array.

###`.map()`
Like the native `[].map()` method, this method returns a promise of an array of items derived from the original array.  Each element in the resulting array will be the result of calling the callback on the corresponding element in the original array.  As usual, all promises will be resolved and ordering will be preserved.

This method can also be used as a `forEach()` method by ignoring return values.

###`.every()`
Like the native `[].every()` method, this method returns a promise of a boolean indicating whether the callback returned a (promise of a) truthy value for every element in the array.

If the callback returns falsy for any element, the resulting promise will be resolved immediately, without waiting for the other promises to complete (although, unlike the short-circuiting `&&` operator, they will always all be evaluated).
###`.some()`
Like the native `[].some()` method, this method returns a promise of a boolean indicating whether the callback returned a (promise of a) truthy value for at least one element in the array.

The returned promise will be resolved as soon as at least one element returns truthy; it will not wait for the promises from the other elements to be resolved (although, unlike the short-circuiting `||` operator, they will always all be evaluated).  If none of elements return truthy, the promise will be resolved to false after all of them finish.