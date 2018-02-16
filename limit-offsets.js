#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//limit_offsets divides flat knitting offsets into a "short range"
// part and a "long range" part.
//Parameters:
// offsets: array of offsets for each stitch index
// limit: maximum number of needles a stitch can be moved in one transfer.
//
//Returns an object with two member arrays:
// shortOffsets, longOffests
// such that:
//  they have the same final offset:
//    offsets[i] = shortOffsets[i] + longOffsets[i]
//  shortOffsets doesn't exceed maxRacking:
//    | shortOffsets[i] | <= maxRacking
//  shortOffsets and longOffsets are cable-free:
//    shortOffsets[i] <= 1+shortOffsets[i+1]
//    longOffsets[i] <= 1+longOffsets[i+1]
//  shortOffsets either completely combines decreases into their final location or
//   leaves them non-decreased
//    (requires looking at groups of two stitches when dealing with 3-1 decreases)
//
//  sum(|longOffsets|) should be as small as possible

function limit_offsets(offsets, limit) {
	console.assert(Array.isArray(offsets), "First parameter should be array of offsets.");
	console.assert(typeof(limit) === 'number', "Second parameter should be racking limit.");

	for (let i = 1; i < offsets.length; ++i) {
		console.assert(offsets[i-1] <= 1+offsets[i], "limit_offsets doesn't work on cables");
	}

	//"fancy" dynamic programming solution.
	// state:
	//   previous stitch index
	//   previous shortOffset
	// cost:
	//   sum(abs(longOffset))


	//will assign cable offsets from this range:
	const MIN_OFFSET = -limit;
	const MAX_OFFSET = limit;
	const OFFSET_COUNT = MAX_OFFSET - MIN_OFFSET + 1;

	const FLAG_COST = 0x88888888;

	let costs = new Uint32Array(offsets.length * OFFSET_COUNT);
	let froms = new Int8Array(offsets.length * OFFSET_COUNT);
	const INVALID_OFFSET = 127;

	//First step:
	for (let short = MIN_OFFSET; short <= MAX_OFFSET; ++short) {
		costs[0 * OFFSET_COUNT + (short-MIN_OFFSET)] = Math.abs(offsets[0] - short);
		froms[0 * OFFSET_COUNT + (short-MIN_OFFSET)] = INVALID_OFFSET;
	}

	for (let i = 1; i < offsets.length; ++i) {
		if (i + 1 < offsets.length && offsets[i-1] === 1+offsets[i] && offsets[i] === 1+offsets[i+1]) {
			//3-1 decrease
			for (let short2 = MIN_OFFSET; short2 <= MAX_OFFSET; ++short2) {
				let best = 0xffffffff;
				let from1 = INVALID_OFFSET;
				let from0 = INVALID_OFFSET;
				for (let short1 = MIN_OFFSET; short1 <= MAX_OFFSET; ++short1) {
					for (let short0 = MIN_OFFSET; short0 <= MAX_OFFSET; ++short0) {
						let long0 = offsets[i-1] - short0;
						let long1 = offsets[i] - short1;
						let long2 = offsets[i+1] - short2;

						//can't cable in short or long:
						if (short0 > 1+short1) continue;
						if (short1 > 1+short2) continue;
						if (long0 > 1+long1) continue;
						if (long1 > 1+long2) continue;

						//any stacking => must finish decrease:
						if (short0 === 1+short1 || short1 === 1+short2) {
							if (long0 !== 0 || long1 !== 0 || long2 !== 0) continue;
						}

						let cost = costs[(i-1)*OFFSET_COUNT + (short0-MIN_OFFSET)];
						cost += Math.abs(long1) + Math.abs(long2);

						if (cost < best) {
							best = cost;
							from0 = short0;
							from1 = short1;
						}
					}
				}
				//HACK: use two table entries:
				costs[i*OFFSET_COUNT + (short2-MIN_OFFSET)] = FLAG_COST; //flag value
				froms[i*OFFSET_COUNT + (short2-MIN_OFFSET)] = 100 + from0; //silly value so that we're sure flag gets respected
				costs[(i+1)*OFFSET_COUNT + (short2-MIN_OFFSET)] = best;
				froms[(i+1)*OFFSET_COUNT + (short2-MIN_OFFSET)] = from1;
			}
			++i; //skip because resolving two stitches at once.
		} else {
			for (let short = MIN_OFFSET; short <= MAX_OFFSET; ++short) {
				let best = 0xffffffff;
				let from = INVALID_OFFSET;
				let long = offsets[i] - short;
				for (let prevShort = MIN_OFFSET; prevShort <= MAX_OFFSET; ++prevShort) {
					let prevLong = offsets[i-1] - prevShort;
					if (prevShort > 1+short) {
						continue; //can't have cable in short
					} else if (prevShort === 1+short) {
						//can only have decrease in short if long doesn't move it:
						if (!(prevLong === 0 && long === 0)) continue;
					}
					//longOffsets must be flat:
					if (prevLong > 1+long) continue;
					let cost = costs[(i-1)*OFFSET_COUNT + (prevShort-MIN_OFFSET)];
					cost += Math.abs(long);
					if (cost < best) {
						best = cost;
						from = prevShort;
					}
				}
				costs[i*OFFSET_COUNT + (short-MIN_OFFSET)] = best;
				froms[i*OFFSET_COUNT + (short-MIN_OFFSET)] = from;
			}
		}
	}
	
	//DEBUG: dump cost matrix:
	function dumpCosts() {
		for (let i = 0; i < offsets.length; ++i) {
			let line = "cost[" + i + "]:";
			for (let short = MIN_OFFSET; short <= MAX_OFFSET; ++short) {
				let cost = costs[i*OFFSET_COUNT + (short-MIN_OFFSET)];
				line += " ";
				if (cost === 0xffffffff) {
					line += "x";
				} else {
					line += cost.toString();
				}
			}
			console.log(line);
		}
	}

	//find best last step:
	let best = 0xffffffff;
	let last = INVALID_OFFSET;
	for (let ofs = MIN_OFFSET; ofs <= MAX_OFFSET; ++ofs) {
		let cost = costs[(offsets.length-1)*OFFSET_COUNT + (ofs-MIN_OFFSET)];
		if (cost < best) {
			best = cost;
			last = ofs;
		}
	}

	if (last === INVALID_OFFSET) throw "Failed to find a offset limit solution.";

	let shortOffsets = [last];
	for (let i = offsets.length-1; i > 0; --i) {
		let short = shortOffsets[0];
		let from = froms[i*OFFSET_COUNT + (short-MIN_OFFSET)];
		console.assert(from !== INVALID_OFFSET, "valid solutions must have valid froms");
		shortOffsets.unshift(from);
		if (i >= 1 && costs[(i-1)*OFFSET_COUNT + (short-MIN_OFFSET)] === FLAG_COST) {
			//double-decrease flag value!
			//grab previous step from same-offset table entry:
			shortOffsets.unshift(froms[(i-1)*OFFSET_COUNT + (short-MIN_OFFSET)]-100);
			--i; //skip next step
		}
	}

	console.assert(shortOffsets.length === offsets.length);
	let longOffsets = [];
	for (let i = 0; i < offsets.length; ++i) {
		longOffsets.push(offsets[i] - shortOffsets[i]);
		console.assert(Math.abs(shortOffsets[i]) <= limit, "shortOffsets should be short");

		if (i >= 2 && offsets[i-2] === 1+offsets[i-1] && offsets[i-1] === 1+offsets[i]) {
			//if 3-1 is overlapped at all it had better be finished:
			if (shortOffsets[i-2] === 1+shortOffsets[i-1] || shortOffsets[i-1] === 1+shortOffsets[i]) {
				console.assert(longOffsets[i-2] === 0 && longOffsets[i-1] === 0 && longOffsets[i] === 0, "3-1 decrease, once started, needs to be finished.");
			}
		} else if (i >= 1 && offsets[i-1] === 1+offsets[i]) {
			//if 2-1 is overlapped it had better be finished:
			if (shortOffsets[i-1] === 1+shortOffsets[i]) {
				console.assert(longOffsets[i-1] === 0 && longOffsets[i] === 0, "2-1 decrease, once started, needs to be finished.");
			}
		}

		if (i > 0) {
			console.assert(shortOffsets[i-1] <= 1+shortOffsets[i], "shortOffsets should be flat");
			console.assert(longOffsets[i-1] <= 1+longOffsets[i], "longOffsets should be flat");
		}
	}

	return {
		shortOffsets:shortOffsets,
		longOffsets:longOffsets
	};
}

exports.limit_offsets = limit_offsets;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test racking limits.");
	function test(offsets, limit) {
		let infoO = "";

		function offsetToString(o) {
			if (o < 0) return o.toString();
			else if (o > 0) return '+' + o.toString();
			else return ' 0';
		}
		for (let i = 0; i < offsets.length; ++i) {
			infoO += " ";
			infoO += offsetToString(offsets[i]);
		}
		console.log("offsets:" + infoO);

		let ret = limit_offsets(offsets, limit);

		let infoS = "";
		let infoL = "";
		for (let i = 0; i < offsets.length; ++i) {
			infoS += " ";
			infoS += offsetToString(ret.shortOffsets[i]);
			infoL += " ";
			infoL += offsetToString(ret.longOffsets[i]);
		}

		console.log("  short:" + infoS);
		console.log("   long:" + infoL);

		console.assert(ret.shortOffsets.length === offsets.length, "shortOffsets is the right length");
		console.assert(ret.longOffsets.length === offsets.length, "longOffsets is the right length");

		for (let i = 0; i < offsets.length; ++i) {
			console.assert(ret.shortOffsets[i] + ret.longOffsets[i] === offsets[i], "offsets sum properly");
			if (i + 1 < offsets.length) {
				console.assert(ret.shortOffsets[i] <= 1+ret.shortOffsets[i+1], "no short cables");
				console.assert(ret.longOffsets[i] <= 1+ret.longOffsets[i+1], "no long cables");
				console.assert( !(ret.shortOffsets[i] === 1+ret.shortOffsets[i+1] && (ret.longOffsets[i] !== 0 || ret.longOffsets[i+1] !== 0) ), "no xferring decreased stitches.");
			}
		}

		if (!ret.longOffsets.every(function(o) { return o === 0; })) {
			test(ret.longOffsets, limit);
		}
	}

	test([ -2, -2, 0, 2, 2 ], 1);
	test([ 10, 10, 9, 8, 8, 8, 8], 3);
	test([ -20, 10 ], 5);
	
	test([+1,+1,+2,+2,+3,+3,+2,+1], 2);
	test([ 0, 0, 0, 0,+1,+1, 0, 0], 2);
}
