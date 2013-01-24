/*jshint node: true, camelcase: true, eqeqeq: true, forin: true, immed: true, latedef: true, newcap: true, noarg: true, undef: true, globalstrict: true*/
/*global describe:false, it:false */
"use strict";
var Q = require('q');
// Don't rely on current directory
var Qx = require('../Qx');

var mocha = require("mocha");
require("mocha-as-promised")(mocha);
var assert = require("assert");

/**
 * Tests all four invocation styles for a Qx method.
 *
 * @param {Function}	method		The Qx method to test.
 * @param {Function}	arrayFunc	A function that generates a promise of an input array.  This function will be called four times.
 * @param {Function}	callback	The callback to pass to the Qx method.
 * @param {Function}	resultFunc	A function to verify the results of the Qx method.  This function will be called up to four times.
 * @param {Function}	errorFunc	A function to handle errors from the Qx method.  This function will be called up to four times.
 * @param {Boolean}		noFunctions	True to skip the method(funcArray) and method() tests.  (for methods that require both data and functions, such as filter())
 * 
 * @returns {Promise}	A promise for the completion of all four tests.
 */
function testInvocation(method, arrayFunc, callback, resultFunc, errorFunc, noFunctions) {
	if (arrayFunc instanceof Array || Q.isPromise(arrayFunc)) {
		var array = arrayFunc;
		arrayFunc = function () { return array; };
	}
	if (typeof resultFunc !== "function") {
		var expected = resultFunc;
		resultFunc = function (result) { assert.deepEqual(result, expected); };
	}

	/**
	 * Turns an array of elements into an array of functions
	 * The functions will call the callback on the elements.
	 */
	function createFunctionArray(arr) {
		return arr.map(function (item, actualIndex) {
			return function (index) {
				assert.strictEqual(actualIndex, index, "Function-array call passed wrong index to callback");
				return Q.when(item, function (result) { return callback(result, index); });
			};
		});
	}

	return Q.all([
		//method(array, callback)
		method(arrayFunc(), callback).then(resultFunc, errorFunc),

		//method(callback)
		Q.when(arrayFunc()).then(method(callback)).then(resultFunc, errorFunc),

		//method(funcArray)
		noFunctions || method(Q.when(arrayFunc(), createFunctionArray)).then(resultFunc, errorFunc),

		//method()
		noFunctions || Q.when(arrayFunc(), createFunctionArray).then(method).then(resultFunc, errorFunc)
	]);
}


describe('.map()', function () {
	// func, input, callback, expected
	it('should return the result of the callback', function () {
		return testInvocation(Qx.map, [1, 2, 3, 4], function (x) { return x * 2; }, [2, 4, 6, 8]);
	});

	it("should wait for the array promise", function () {
		return testInvocation(Qx.map, Q.delay([1, 2, 3, 4], 10), function (x) { return x * 2; }, [2, 4, 6, 8]);
	});
	it("should wait for promises in the array", function () {
		return testInvocation(Qx.map, [Q.delay('a', 20), Q.delay('b', 20)], function (x) { return x + x; }, ['aa', 'bb']);
	});
	it("should wait for callback promises", function () {
		return testInvocation(
			Qx.map,
			[new Date(), "a", "b", "c"],
			function (x, i) { return Q.delay(i ? x + i : x, 500); },
			function (result) {
				assert((new Date() - result[0]) >= 500, "didn't wait for callback promise");
				assert((new Date() - result[0]) < result.length * 500, "Callback promises didn't run in parallel");
				assert.deepEqual(result, [result[0], "a1", "b2", "c3"]);
			}
		);
	});
	it("should return the first error if a callback fails", function () {
		return testInvocation(
			Qx.map,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return x * 2;
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Test error"); }
		);
	});
});
describe('.filter()', function () {
	// func, input, callback, expected
	it('should handle the result of the callback', function () {
		return testInvocation(Qx.filter, [1, 2, 3, 4], function (x) { return !(x % 2); }, [2, 4], null, true);
	});
	it("should wait for the array promise", function () {
		return testInvocation(Qx.filter, Q.resolve([1, 2, 3, 4]), function (x) { return !(x % 2); }, [2, 4], null, true);
	});
	it("should wait for promises in the array", function () {
		return testInvocation(Qx.filter, [Q.delay('a', 20), Q.delay('b', 20)], function (x, i) { return x === 'a'; }, ['a'], null, true);
	});
	it("should wait for callback promises", function () {
		return testInvocation(
			Qx.filter,
			[Q.delay(new Date(), 100), "a", "b", "c"],
			function (x, i) { return Q.delay(x instanceof Date, 500); },
			function (result) {
				assert((new Date() - result[0]) >= 600, "didn't wait for callback promise");
				assert.strictEqual(result.length, 1);
			},
			null, true
		);
	});
	it("should return the first error if a callback fails", function () {
		return testInvocation(
			Qx.filter,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return true;
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Test error"); },
			true
		);
	});
});

function fail() { throw "Sample Failed Promise"; }
describe('.some()', function () {
	// func, input, callback, expected
	it('should work', function () {
		return testInvocation(Qx.some, [1, 2, 3, 4], function (x) { return !(x % 2); }, true);
	});
	it("should wait for the array promise", function () {
		return testInvocation(Qx.some, Q.resolve([1, 2, 3, 4]), function (x) { return false; }, false);
	});
	it("should wait for promises in the array", function () {
		return testInvocation(Qx.some, [Q.delay('a', 20), Q.delay('b', 100)], function (x, i) { return x === 'b'; }, true);
	});
	it("should wait for callback promises", function () {
		var start = new Date();
		return testInvocation(
			Qx.some,
			[Q.delay(new Date(), 100), "a", "b", "c"],
			function (x, i) { return Q.delay(x instanceof Date, 500); },
			function (result) {
				assert((new Date() - start) >= 600, "didn't wait for callback promise");
				assert.strictEqual(result, true);
			}
		);
	});
	it("should return the first error if a callback throws", function () {
		return testInvocation(
			Qx.some,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return false;
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Test error"); }
		);
	});
	it("should succeed if a later callback fails", function () {
		return testInvocation(
			Qx.some,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return true;
			},
			true
		);
	});
	it("should return the first error if a callback returns failure", function () {
		return testInvocation(
			Qx.some,
			[1, 2, 3, 4],
			function (x) {
				return Q.delay(500 - x * 100).then(function () { throw "Error " + x; });
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Error 4"); }
		);
	});
	it("should succeed if a later input promise fails", function () {
		return testInvocation(
			Qx.some,
			[1, 2, 3, Q.delay(100).then(fail)],
			function (x, i) { return true; },
			true
		);
	});
	it("should return the first error if an input promise is failed", function () {
		return testInvocation(
			Qx.some,
			[Q.delay(1, 200), Q.delay(2, 200), Q.delay(3, 200), Q.delay(100).then(fail)],
			function (x, i) { return true; },
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Sample Failed Promise"); }
		);
	});
});

describe('.every()', function () {
	// func, input, callback, expected
	it('should work', function () {
		return testInvocation(Qx.every, [1, 2, 3, 4], function (x) { return (x % 2); }, false);
	});
	it("should wait for the array promise", function () {
		return testInvocation(Qx.every, Q.resolve([1, 2, 3, 4]), function (x) { return false; }, false);
	});
	it("should wait for promises in the array", function () {
		return testInvocation(Qx.every, [Q.delay('a', 20), Q.delay('b', 100)], function (x, i) { return x === 'b'; }, false);
	});
	it("should wait for callback promises", function () {
		var start = new Date();
		return testInvocation(
			Qx.every,
			[Q.delay(new Date(), 100), "a", "b", "c"],
			function (x, i) { return Q.delay(!(x instanceof Date), 500); },
			function (result) {
				assert((new Date() - start) >= 600, "didn't wait for callback promise");
				assert.strictEqual(result, false);
			}
		);
	});
	it("should return the first error if a callback throws", function () {
		return testInvocation(
			Qx.every,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return true;
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Test error"); }
		);
	});
	it("should succeed if a later callback fails", function () {
		return testInvocation(
			Qx.every,
			[1, 2, 3, 4],
			function (x, i) {
				if (i > 2)
					throw "Test error";
				return false;
			},
			false
		);
	});
	it("should return the first error if a callback returns failure", function () {
		return testInvocation(
			Qx.every,
			[1, 2, 3, 4],
			function (x) {
				return Q.delay(500 - x * 100).then(function () { throw "Error " + x; });
			},
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Error 4"); }
		);
	});
	it("should succeed if a later input promise fails", function () {
		return testInvocation(
			Qx.every,
			[1, 2, 3, Q.delay(100).then(fail)],
			function (x, i) { return false; },
			false
		);
	});
	it("should return the first error if an input promise is failed", function () {
		return testInvocation(
			Qx.every,
			[Q.delay(1, 200), Q.delay(2, 200), Q.delay(3, 200), Q.delay(100).then(fail)],
			function (x, i) { return true; },
			function (result) { assert.fail("Failed callback didn't fail result " + result); },
			function (err) { assert.strictEqual(err, "Sample Failed Promise"); }
		);
	});
});


describe('.any', function () {
	it('should return the first of three promises ASAP', function () {
		var start = new Date();
		return Qx.any(
			[Q.delay('a', 600), Q.delay('b', 200), Q.delay('c', 400)]
		).then(function (result) {
			assert((new Date() - start) < 300, "waited after success");
			assert.strictEqual(result, 'b');
		});
	});
	it('should the first success after earlier promises fail', function () {
		return Qx.any(
			[Q.delay('a', 600), Q.delay('b', 200).then(fail), Q.delay('c', 400).then(fail)]
		).then(function (result) { assert.strictEqual(result, 'a'); });
	});
	it('should return failure after only promise fails', function () {
		return Qx.any(
			[Q.delay('b', 200).then(fail)]
		).then(
			function (result) { assert.fail("any() succeeded on failure"); },
			function (err) {
				assert.strictEqual(err, 'Sample Failed Promise');
			}
		);
	});
	it('should the first failure after everything fails', function () {
		var start = new Date();
		return Qx.any(
			[Q.delay('a', 600).then(fail), Q.delay('b', 200).then(function () { throw "First!"; }), Q.delay('c', 400).then(fail)]
		).then(
			function (result) { assert.fail("any() succeeded on failure"); },
			function (err) {
				assert((new Date() - start) >= 600, "didn't wait for all failures");
				assert.strictEqual(err, 'First!');
			}
		);
	});
});

describe('.breakWith', function () {
	it('should return the value', function () {
		return Q.resolve(4)
				.then(function (value) {
					Qx.breakWith("early");
					return "unreached value";
				})
				.fail(Qx.endFunction)
				.then(function (value) {
					assert.strictEqual(value, "early");
				});
	});
	it('should preserve exceptions', function () {
		return Q.resolve(4)
				.then(function () { throw "Real error"; })
				.fail(Qx.endFunction)
				.fail(function (err) {
					assert.strictEqual(err, "Real error");
				});
	});
	it('should skip chained then()s', function () {
		return Q.resolve(4)
				.then(function (value) {
					Qx.breakWith("early");
					return "unreached value";
				})
				.then(function () {
					assert.fail(".then() callback after breakWith() shouldn't run");
				})
				.fail(Qx.endFunction);
	});
});

describe('.withBreaks', function () {
	it('should not run callback on breakWith()', function () {
		return Q.resolve(4)
				.then(function (value) {
					Qx.breakWith("early");
					return "unreached value";
				})
				.fail(Qx.withBreaks(function (err) {
					assert.fail("Error callback should not run for breakWith()" + err);
				}))
				.fail(Qx.endFunction)
				.then(function (result) {
					assert.strictEqual(result, "early");
				});
	});
	it('should run callback on other exceptions', function () {

		return Q.resolve(4)
				.then(function () { throw "Real error"; })
				.fail(Qx.withBreaks(function (err) {
					assert.strictEqual(err, "Real error");
					return "recovered";
				}))
				.fail(Qx.endFunction)
				.then(function (result) {
					assert.strictEqual(result, "recovered");
				});
	});
});
