#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//flat_transfers computes transfers for flat knitting when
//  stacking order of decreases matters.
//Parameters:
// offsets: array of offsets for each stitch index
// firsts: array of the same length as offsets;
//     if Boolean(offsets[i]) is true, stitch[i] will
//     arrive at its destination needle first.
// xfer: output function
//
// flat_transfers returns a transfer plan by calling
//   xfer('f'/'b', i, 'f'/'b', i+o) to move stitches around

function flat_transfers(offsets, firsts, xfer) {
	//Check inputs:
	if (offsets.length !== firsts.length) {
		throw "Offsets and firsts should be the same length.";
	}
	for (let i = 0; i + 1 < offsets.length; ++i) {
		if (offsets[i] === 1 && offsets[i+1] === -1) {
			throw "Offsets should not contain cables (that is, [1,-1] subarrays)";
		}
	}


	
	//resolveRange will recursively get all the stitches in a range where they need to go.
	//precondition:
	//  stitches [min,max] are on the front bed at currentOffset
	//  it's okay to move all these stitches to their desired offsets
	//    (i.e. anything that needs to be moved out of the way has been moved, neighbors are already resolved or closer)
	//method:
	//  looking at the sign of the stitch offset + currentOffset we will see:
	// 0* + + + ... + + + 0* <-- start positive, end positive
	// 0* - - - ... - - - 0* <-- start negative, end negative
	// in which case the algorithm can resolve an outer increase/decrease pair and recurse.
	//  or a start and end with different sign and pass through zero:
	// 0* + + + ... +1 0+ -1 ... - - - 0* <-- central decrease(s), zero must appear
	// 0* - - - ...  - 0* +  ... + + + 0* <-- central increase, zero may not appear
	//in which case the algorithm can split on zero and recurse.
	function resolveRange(min, max, currentOffset) {
		//console.log("--> [" + min + "," + max + "] @ " + currentOffset); //DEBUG
		console.assert(min <= max, "range is non-empty");

		//if the range is all the same offset, just resolve it:
		let same = true;
		for (let i = min+1; i <= max; ++i) {
			if (offsets[i] !== offsets[min]) {
				same = false;
				break;
			}
		}
		if (same) {
			//whole range wants to go one place, so just do that:
			if (offsets[min] !== currentOffset) {
				for (let i = min; i <= max; ++i) {
					xfer('f', i+currentOffset, 'b', i+currentOffset);
				}
				for (let i = min; i <= max; ++i) {
					xfer('b', i+currentOffset, 'f', i+offsets[i]);
				}
			}
			return;
		}

		//range has some different values in it (thus, an increase or decrease).


		//find the non-zero range [l,r]:
		let l = min;
		while (l <= max && offsets[l] === currentOffset) ++l;
		let r = max;
		while (r >= min && offsets[r] === currentOffset) --r;

		console.assert(l <= r, "must have non-zero entries or would have used same-offsets path");

		//helper: get the stitch range that lands on the same needle (clamped to [min,max])
		function getDecrease(i) {
			let ret = {min:i, max:i};
			while (ret.max+1 <= max && offsets[ret.max] === 1+offsets[ret.max+1]) ++ret.max;
			while (ret.min-1 >= min && offsets[ret.min-1] === 1+offsets[ret.min]) --ret.min;
			return ret;
		}

		//----------- the positive-positive case -------------
		if (offsets[l] > currentOffset && offsets[r] > currentOffset) {
			//increase on left, decrease on right:
			// 0* + ... + 0*

			//label up to three stitches as participating in the decrease:
			// 0* + ... +4 +3 +2
			//          r0 r1 r2
			// 0* + ... +3 +3 +2
			//             r0 r1 (r2 is null)
			// 0* + ... +2 +2 +2
			//                r0 (r1,r2 are null)

			let r0 = r;
			if (r0 > min && offsets[r0-1] === 1+offsets[r0]) --r0;
			if (r0 > min && offsets[r0-1] === 1+offsets[r0]) --r0;
			console.assert(r0 === min || offsets[r0-1] <= 1+offsets[r0], "support up to a triple decrease only");

			let r1 = r0;
			if (r0 < max && offsets[r0] === 1+offsets[r0+1]) {
				r1 = r0 + 1;
			}

			let r2 = r1;
			if (r1 < max && offsets[r1] === 1+offsets[r1+1]) {
				r2 = r1 + 1;
			}

			console.assert(
				   (r0 === r1 && r1 === r2)
				|| (r0 + 1 === r1 && r1 === r2)
				|| (r0 + 1 === r1 && r1 + 1 === r2), "have expected r0,r1,r2 assignment");

			//figure out decrease stacking order:
			let first;
			if (r1 === r0 && r2 === r0) {
				first = 'r0';
			} else if (r2 === r1) {
				first = 'r1';
				if (firsts[r0]) first = 'r0';
				if (firsts[r1]) first = 'r1';
			} else {
				first = 'r2';
				if (firsts[r1]) first = 'r1';
				if (firsts[r0]) first = 'r0';
				if (firsts[r2]) first = 'r2';
			}

			//console.log(
			//	"r0:" + r0 + " (ofs:" + offsets[r0] + ")"
			//	+ " r1:" + r1 + " (ofs:" + offsets[r1] + ")"
			//	+ " r2:" + r2 + " (ofs:" + offsets[r2] + ")"
			//	+ " first:" + first); //DEBUG

			//general plan:
			// - pick everything up
			// - drop things in order from currentOffset+1 to offsets[r0], dropping from the left to allow stretch.
			// - when we do offsets[r2] / offsets[r1] do special case based on first stitch.

			//everything to the back:
			for (let i = l; i <= r2; ++i) {
				xfer('f', i+currentOffset, 'b', i+currentOffset);
			}

			let todo = []; //recursive calls to make later for dropped but not resolved ranges.
			function dropRange(min, max, ofs) {
				if (max < min) return;
				for (let i = min; i <= max; ++i) {
					xfer('b', i+currentOffset, 'f', i+ofs);
				}
				todo.push({min:min, max:max, ofs:ofs});
			}
			let next = l;
			for (let ofs = currentOffset; ofs < offsets[r0]; ++ofs) {
				console.assert(next <= r0, "left edge shouldn't pass right");
				console.assert(offsets[next] >= ofs, "left edge must still want to go left");
				//figure out how much to drop so that next stitch will be happy at next offset:
				let prev = next;
				while (offsets[next] <= ofs) ++next;
				dropRange(prev, next-1, ofs);

				if (first === 'r2') { //r2-first case drops r2, r1 at natural time
					console.assert(r2 !== r1 && r1 !== r0, "r2 shouldn't be marked first if not a triple");
					if (ofs === offsets[r2]) xfer('b', r2+currentOffset, 'f', r2+offsets[r2]);
					if (ofs === offsets[r1]) xfer('b', r1+currentOffset, 'f', r1+offsets[r1]);
				} else if (first === 'r1') {
					console.assert(r1 !== r0, "r1 shouldn't be marked first if not a triple");
					if (ofs === offsets[r1]) {
						if (r2 !== r1) { //do a tricky dance to get r2 dropped after r1:
							//drop everything except r2:
							for (let i = next; i <= r1; ++i) {
								xfer('b', i+currentOffset, 'f', i+ofs);
							}
							//drop r2:
							xfer('b', r2+currentOffset, 'f', r2+offsets[r2]);
							//pick up everything < r1 again:
							for (let i = next; i < r1; ++i) {
								xfer('f', i+ofs, 'b', i+currentOffset);
							}
						} else { //double decrease, just drop r1 at the natural time
							xfer('b', r1+currentOffset, 'f', r1+offsets[r1]);
						}
					}
				}
			}
			//console.log("=== return at " + offsets[r0] + " ==="); //DEBUG
			console.assert(next <= r, "left edge shouldn't pass right");
			console.assert(offsets[next] >= offsets[r0], "left edge must still want to go left");
			dropRange(next, r0, offsets[r0]);

			if (first === 'r0') {
				//r0-first drops r1,r2 after-the fact
				if (r1 !== r0) xfer('b', r1+currentOffset, 'f', r1+offsets[r1]);
				if (r2 !== r1) xfer('b', r2+currentOffset, 'f', r2+offsets[r2]);
			}

			//NOTE to self: this is okay, right?
			todo.forEach(function(range) {
				resolveRange(range.min, range.max, range.ofs);
			});

		//----------- the negative-negative case --------------
		} else if (offsets[l] < currentOffset && offsets[r] < currentOffset) {
			//console.assert(false, "the negative case"); //DEBUG

			//HACK: reflect offsets/firsts, swap out xfer, and recurse to get to the positive case:

			let storedOffsets = offsets;
			let storedFirsts = firsts;
			let storedXfer = xfer;

			offsets = offsets.slice();
			offsets.reverse();
			for (let i = 0; i < offsets.length; ++i) {
				offsets[i] = -offsets[i];
			}
			firsts = firsts.slice();
			firsts.reverse();

			xfer = function(fromBed, fromNeedle, toBed, toNeedle) {
				storedXfer(fromBed, offsets.length-1-fromNeedle, toBed, offsets.length-1-toNeedle);
			};

			resolveRange(offsets.length-1-max, offsets.length-1-min, -currentOffset);

			offsets = storedOffsets;
			firsts = storedFirsts;
			xfer = storedXfer;

		//----------- the positive-negative case --------------
		} else if (offsets[l] > currentOffset && offsets[r] < currentOffset) {
			//relative offsets must look like this:
			// 0* + + ... + +1 0+ -1 - ... - - 0*
			//[---------------]  [---------------]
			// so recurse on these parts, with care taken to do so in the right order.

			//find the [+1 0+ -1] chunk:
			let firstNeg = l;
			while (firstNeg <= max && offsets[firstNeg] >= currentOffset) ++firstNeg;
			console.assert(firstNeg <= max && offsets[firstNeg] < currentOffset, "must have first negative");
			let lastPos = firstNeg;
			while (lastPos >= min && offsets[lastPos] <= currentOffset) --lastPos;
			console.assert(lastPos >= min && offsets[lastPos] > currentOffset, "must have last positive");

			console.assert(lastPos + 1 <= firstNeg - 1, "must have at least one zero");
			console.assert(offsets[lastPos] === currentOffset+1, "last positive must be one");
			console.assert(offsets[firstNeg] === currentOffset-1, "first negative must be negative one");

			if (lastPos + 1 === firstNeg - 1) {
				//middle 3-1 decrease:
				if (firsts[lastPos]) {
					resolveRange(min, lastPos+1, currentOffset); //include zero in positive-side range
					resolveRange(firstNeg, max, currentOffset);
				} else if (firsts[firstNeg]) {
					resolveRange(firstNeg-1, max, currentOffset); //include zero in negative-side range
					resolveRange(min, lastPos, currentOffset);
				} else {
					//zero wants to go first, or nothing is marked:
					resolveRange(min, lastPos, currentOffset);
					resolveRange(firstNeg, max, currentOffset);
				}
			} else {
				//separate 2-1 decreases:
				console.assert(lastPos+1 < firstNeg-1, "disjoint decreases");
				resolveRange(min, lastPos+1, currentOffset);
				resolveRange(firstNeg-1, max, currentOffset);
			}

		//----------- the negative-positive case --------------
		} else if (offsets[l] < currentOffset && offsets[r] > currentOffset) {
			//relative offsets must look like this:
			// 0* - - ... - - 0* + + ... + + 0*
			//[--------------]  [--------------]
			// so recurse on these parts

			//find the [- 0* +] range:
			let firstPos = l;
			while (firstPos <= max && offsets[firstPos] <= currentOffset) ++firstPos;
			console.assert(firstPos <= max && offsets[firstPos] > currentOffset, "must have first positive");
			let lastNeg = firstPos;
			while (lastNeg >= min && offsets[lastNeg] >= currentOffset) --lastNeg;
			console.assert(lastNeg >= min && offsets[lastNeg] < currentOffset, "must have last negative");

			//do each half separately:
			resolveRange(min, lastNeg, currentOffset);
			//*note that central stitches are already where they want to be
			resolveRange(firstPos, max, currentOffset);
		} else {
			console.assert(false, "logic says this case can't happen");
		}
	}

	//try to resolve entire range to start:
	resolveRange(0, offsets.length-1, 0);

}

exports.flat_transfers = flat_transfers;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test flat transfers.");
	function test(offsets, firsts) {
		let needles = {};
		for (let i = 0; i < offsets.length; ++i) {
			needles['f' + i] = [i];
		}

		function dumpNeedles() {
			let minNeedle = 0;
			let maxNeedle = offsets.length-1;
			for (let n in needles) {
				let m = n.match(/^[fb](-?\d+)$/);
				console.assert(m);
				let val = parseInt(m[1]);
				minNeedle = Math.min(minNeedle, val);
				maxNeedle = Math.max(maxNeedle, val);
			}

			let layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('b' + n) in needles) {
					needles['b' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log(" back:" + layers[l]);
			}
			layers = [];
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if (('f' + n) in needles) {
					needles['f' + n].forEach(function(i, d){
						while (d >= layers.length) layers.push("");
						while (layers[d].length < n * 3) layers[d] += "   ";
						layers[d] += " ";
						if (i < 10) layers[d] += " " + i;
						else layers[d] += i;
					});
				}
			}
			for (let l = layers.length - 1; l >= 0; --l) {
				console.log("front:" + layers[l]);
			}

			let infoI = "";
			for (let n = minNeedle; n <= maxNeedle; ++n) {
				if      (n < -10) infoI += n.toString();
				else if (n <   0) infoI += " " + n.toString();
				else if (n === 0) infoI += "  0";
				else if (n <  10) infoI += "  " + n.toString();
				else              infoI += " " + n.toString();
			}
			console.log("index:" + infoI);
		}
		let log = [];

		function xfer(fromBed, fromIndex, toBed, toIndex) {
			let cmd = "xfer " + fromBed + fromIndex + " " + toBed + toIndex;
			console.log(cmd);
			log.push(cmd);

			console.assert((fromBed === 'f' && toBed === 'b') || (fromBed === 'b' && toBed === 'f'), "must xfer f <=> b");

			//check for valid racking:
			let at = [];
			for (let i = 0; i < offsets.length; ++i) {
				at.push(null);
			}
			for (var n in needles) {
				let m = n.match(/^([fb])(-?\d+)$/);
				console.assert(m);
				needles[n].forEach(function(s){
					console.assert(at[s] === null, "each stitch can only be in one place");
					at[s] = {bed:m[1], needle:parseInt(m[2])};
				});
			}

			let minRacking = -Infinity;
			let maxRacking = Infinity;
			for (let i = 1; i < offsets.length; ++i) {
				if (at[i-1].bed === at[i].bed) continue;
				let slack = Math.max(1, Math.abs( i+offsets[i] - (i-1+offsets[i-1]) ));
				let back  = (at[i].bed === 'b' ? at[i].needle : at[i-1].needle);
				let front = (at[i].bed === 'b' ? at[i-1].needle : at[i].needle);

				//-slack <= back + racking - front <= slack
				minRacking = Math.max(minRacking, -slack - back + front);
				maxRacking = Math.min(maxRacking,  slack - back + front);
			}
			console.assert(minRacking <= maxRacking, "there is a valid racking for this stitch configuration");
			let racking = (fromBed === 'f' ? fromIndex - toIndex : toIndex - fromIndex);
			console.assert(minRacking <= racking && racking <= maxRacking, "required racking " + racking + " is outside [" + minRacking + ", " + maxRacking + "] valid range. (" + cmd + ")");



			var from = needles[fromBed + fromIndex];
			if (!((toBed + toIndex) in needles)) needles[toBed + toIndex] = [];
			var to = needles[toBed + toIndex];

			console.assert(from.length !== 0, "no reason to xfer empty needle");
			console.assert(from.length === 1, "shouldn't ever xfer stack");

			while (from.length) to.push(from.pop());

			//dumpNeedles(); //DEBUG
		}

		let infoI = "";
		let infoO = "";
		let infoF = "";
		for (let i = 0; i < offsets.length; ++i) {
			infoI += " ";
			infoO += " ";
			infoF += " ";

			if (i < 10) infoI += " " + i;
			else infoI += i;

			if (offsets[i] < 0) infoO += offsets[i];
			else if (offsets[i] > 0) infoO += "+" + offsets[i];
			else infoO += " 0";

			if (firsts[i]) {
				infoF += " *";
			} else {
				infoF += " .";
			}
		}
		console.log(" index:" + infoI);
		console.log("offset:" + infoO);
		console.log(" first:" + infoF);

		flat_transfers(offsets, firsts, xfer);

		dumpNeedles();

		for (let i = 0; i < offsets.length; ++i) {
			var n = needles['f' + (i + offsets[i])];
			console.assert(n.indexOf(i) !== -1, "needle got to destination");
			if (firsts[i]) {
				console.assert(n.indexOf(i) === 0, "first got to destination first");
			}
		}

		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

		return log;

	}
	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 1, 0, 0]);

	test([+1,+2,+3,+3,+2,+2,+1,+1],
	     [ 0, 0, 0, 0, 1, 1, 0, 0]);

	test([-1,-1,-2,-2,-3,-3,-2,-1],
	     [ 0, 0, 1, 1, 0, 0, 0, 0]);

	test([ 0, 0,+1,+1,+2,+2,+1,+1, 0, 0,+1, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

	test([-4,-3,-2,-1, 0,+1,+2,+3],
	     [ 0, 0, 0, 0, 0, 0, 1, 0]);


	test([+4,+4,+3,+3,+2,+2,+1,+1, 0,-1,-1,-2,-2,-3,-3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

	test([-4,-4,-3,-3,-2,-2,-1,-1, 0,+1,+1,+2,+2,+3,+3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

	test([ 0,-1,-1, 0, 1, 1, 1, 0,-1, 1, 0, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]);

 	test([ 1, 0, 1, 0, 1, 0, 0,-1, 0,-1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1],
	     [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
}
