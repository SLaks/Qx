/*jshint node: true, camelcase: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, noarg: true, undef: true, globalstrict: true*/
"use strict";
var Q = require('q');

/**
 * A callback that takes a function from an array and executes it.
 */
var functionConverter = function (f, index) {
	if (Q.isPromise(f))
		return f.fcall(index);
	else
		return f(index);
};

/**
 * Normalizes the four supported arguments styles for array methods.
 * Array methods can take an array and/or a callback, or neither.
 * See the README.
 * 
 * this is the function to call; arguments are the arguments passed by the caller.
 */
function handleArgs() {
	/*jshint validthis:true */
	var method = this, args = arguments;

	// method(array, callback)
	if (args.length === 2)
		return method.apply(null, args);

	// method(array) - Array of functions
	if (args[0] instanceof Array || Q.isPromise(args[0]))
		return method(args[0], functionConverter);

	// method(function) - Return function that takes array of items
	if (typeof args[0] === "function")
		return function (array) { return method(array, args[0]); };

	// method() - Return function that takes array of functions
	if (args.length === 0) {
		return function (funcArray) {
			return method(funcArray, functionConverter);
		};
	}

	throw new Error("Unsupported arguments " + Array.prototype.slice.call(args).join(', '));
}

/**
 * A version of Q.when() that runs the callback immediately if the value is not a promise.
 */
function eagerWhen(valueOrPromise, callback) {
	if (Q.isPromise(valueOrPromise))
		return valueOrPromise.then(callback);
	else
		return callback(valueOrPromise);
}

function map(array, callback) {
	return Q.when(array, function (arr) {
		return Q.all(arr.map(function (x, i) {
			return eagerWhen(x, function (result) { return callback(result, i); });
		}));
	});
}
exports.map = handleArgs.bind(map);

var filterRejected = {};	//Marker object for when the filter returns falsy
function filter(array, callback) {
	return map(array, function (item, index) {
		return eagerWhen(callback(item, index), function (passed) { return passed ? item : filterRejected; });
	})
	.then(function (results) {
		return results.filter(function (elem) { return elem !== filterRejected; });
	});
}
exports.filter = handleArgs.bind(filter);

function some(array, callback) {
	var defer = Q.defer();

	map(array, function (elem, i) {
		return Q.when(callback(elem, i), function (result) {
			// If an element returns true, resolve immediately
			if (result && defer) {
				defer.resolve(true);
				defer = null;
			}
		});
	}).then(function () {
		// If we didn't resolve already, return false.
		if (defer)
			defer.resolve(false);
	});

	return defer.promise;
}
exports.some = handleArgs.bind(some);

function every(array, callback) {
	return some(array, function () { return !callback.apply(this, arguments); })
			.then(function (result) { return !result; });
}
exports.every = handleArgs.bind(every);

