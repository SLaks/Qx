/*jshint node: true, camelcase: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, noarg: true, undef: true, globalstrict: true*/
"use strict";
var Q = require('q');

/**
 * A callback that takes a function from an array and executes it.
 */
var functionConverter = function (f, index) {
	if (Q.isPromiseAlike(f))
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
	if (args[0] instanceof Array || Q.isPromiseAlike(args[0]))
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
	if (Q.isPromiseAlike(valueOrPromise))
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
	var deferred = Q.defer();

	map(array, function (elem, i) {
		return eagerWhen(
			callback(elem, i),
			function (result) {
				// If an element returns true, resolve immediately
				if (result && deferred) {
					deferred.resolve(true);
					deferred = null;
				}
			}
		);
	}).then(
		function () {
			// If we didn't resolve already, return false.
			if (deferred)
				deferred.resolve(false);
		},
		function (err) {
			// If map() fails (if the callback throws an exception
			// or returns a failing promise), fail the result
			if (deferred)
				deferred.reject(err);
			deferred = null;
		}
	);

	return deferred.promise;
}
exports.some = handleArgs.bind(some);

function every(array, callback) {
	var deferred = Q.defer();

	map(array, function (elem, i) {
		return eagerWhen(
			callback(elem, i),
			function (result) {
				// If an element returns false, resolve immediately
				if (!result && deferred) {
					deferred.resolve(false);
					deferred = null;
				}
			}
		);
	}).then(
		function () {
			// If we didn't resolve already, everything was true.
			if (deferred)
				deferred.resolve(true);
		},
		function (err) {
			// If map() fails (if the callback throws an exception
			// or returns a failing promise), fail the result
			if (deferred)
				deferred.reject(err);
			deferred = null;
		}
	);

	return deferred.promise;
}
exports.every = handleArgs.bind(every);

// Not an array function; does not accept a callback
function any(promises) {
	var deferred = Q.defer();
	var firstError;
	var resolvedCount = 0;

	promises.forEach(function (p) {
		p.then(
			function (result) {
				// If we already got a result, don't do anything
				if (!deferred) return;
				deferred.resolve(result);
				deferred = null;
			},
			function (err) {
				// If we already got a result, don't do anything
				if (!deferred) return;
				resolvedCount++;

				// If this is the first error, record it in case everything fails
				if (firstError === undefined)
					firstError = err;

				// If all of the promises failed, return the first error
				if (resolvedCount === promises.length)
					deferred.reject(firstError);
			}
		);
	});

	return deferred.promise;
}
exports.any = any;

function BreakError(value) {
	this.returnValue = value;
}
BreakError.prototype.message = "A function called Qx.breakWith() inside a promise chain, but did not close the scope with .fail(Qx.endFunction)";
BreakError.prototype.toString = function () {
	return this.message;
};

exports.breakWith = function (value) {
	throw new BreakError(value);
}
exports.withBreaks = function (callback) {
	return function (err) {
		if (err instanceof BreakError)
			throw err;
		return callback(err);
	};
};
exports.endFunction = function (err) {
	// allow .fail(Qx.endFunction())
	if (arguments.length === 0)
		return exports.endFunction;

	if (err instanceof BreakError)
		return err.returnValue;
	throw err;
};