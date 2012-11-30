/*jshint node: true, camelcase: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, noarg: true, undef: true, globalstrict: true*/
"use strict";
var Q = require('q');

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
		return method(args[0], function (f, index) { return args[0](index); });

	// method(function) - Return function that takes array of items
	if (typeof args[0] === "function")
		return function (array) { return method(array, args[0]); };

	// method() - Return function that takes array of functions
	if (args.length === 0) {
		return function (funcArray) {
			return method(funcArray, function (f, index) { return args[1](index); });
		};
	}

	throw new Error("Unsupported arguments " + Array.prototype.slice.call(args).join(', '));
}

function map(array, callback) {
	return Q.when(array, function (arr) {
		return Q.all(arr.map(callback));
	});
}
exports.map = handleArgs.bind(map);

function filter(array, callback) {
	return Q.when(array, function (arr) {
		return Q.all(arr.map(callback))
				.then(function (filterResults) {
					return arr.filter(function (elem, i) { return filterResults[i]; });
				});
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

