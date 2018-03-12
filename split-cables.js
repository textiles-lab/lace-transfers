#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//split_cables divides flat knitting offsets into a "cables"
// part and a "flat" part.
//Parameters:
// offsets: array of offsets for each stitch index
//
//Returns an object with two member arrays:
// flatOffsets, cableOffests
// such that:
//  they have the same final offset:
//    offsets[i] = flatOffsets[i] + cableOffsets[i]
//  flatOffsets doesn't contain any cables:
//    i + flatOffsets[i] <= i+1 + flatOffsets[i+1]
//  flatOffsets doesn't contain any incorrect decreases:
//    i + flatOffsets[i] == i+1 + flatOffsets[i+1]
//      Only when i + offsets[i] == i+1 + offsets[i+1]
//  sum(abs(cableOffsets)) is minimized
//  these seem like a bad idea:
//  abs(flatOffsets[i]) <= abs(offsets[i])
//  abs(cableOffsets[i]) <= abs(offsets[i])

//New, ad-hoc code looks for "out-of-order sections":
function split_cables(offsets) {

	//initialize to "all offsets are flat":
	let cableOffsets = [];
	for (let i = 0; i < offsets.length; ++i) {
		cableOffsets.push(0);
	}

	for (let i = 0; i + 1 < offsets.length; ++i) {
		if (i + offsets[i] <= i+1 + offsets[i+1]) continue; //no out-of-order-ness, no problem.
		//Figure out the smallest "out-of-order" section containing i:
		// want a section l [a ... b] r
		// (1) dest[l] < min(dest[a], ..., dest[b]) <-- the next stitch left isn't "out of order"
		// (2) dest[r] > max(dest[a], ..., dest[b]) <-- the next stitch right isn't "out of order"
		let a = i;
		let b = i+1;
		let min = Math.min(a + offsets[a], b + offsets[b]);
		let max = Math.max(a + offsets[a], b + offsets[b]);

		//grow the range until it can grow no further:
		while (true) {
			if (a > 0 && a-1 + offsets[a-1] >= min) {
				--a;
				max = Math.max(max, a + offsets[a]);
			} else if (b + 1 < offsets.length && b+1 + offsets[b+1] <= max) {
				++b;
				min = Math.min(min, b + offsets[b]);
			} else {
				break;
			}
		}

		//console.log(a,b); //DEBUG

		//So, the question becomes: what offset to place [a,b] at?
		//anything that keeps dest in [min,max] will work.

		//let's minimize sum-square offset:
		let avg = 0;
		for (let j = a; j <= b; ++j) {
			avg += offsets[j];
		}
		avg /= (b-a+1);
		avg = Math.round(avg);

		avg = Math.max(avg, min-a); //must keep even the leftmost stitch within [min,max]
		avg = Math.min(avg, max-b); //must keep even the rightmost stitch within [min,max]

		for (let j = a; j <= b; ++j) {
			cableOffsets[j] = offsets[j] - avg;
		}

		i = b; //no need to go looking for out-of-order ranges within the range itself

	}

	//console.log(cableOffsets.join(" ")); //DEBUG

	let flatOffsets = [];
	for (let i = 0; i < offsets.length; ++i) {
		flatOffsets.push(offsets[i] - cableOffsets[i]);
		if (i > 0) {
			console.assert(flatOffsets[i-1] <= 1+flatOffsets[i], "flatOffsets should be flat");
			console.assert(flatOffsets[i-1] < 1+flatOffsets[i] || offsets[i-1] == 1+offsets[i], "flatOffsets should not contain spurious decreases");
		}
	}

	return {
		flatOffsets:flatOffsets,
		cableOffsets:cableOffsets
	};
}

exports.split_cables = split_cables;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test cable splits.");
	function test(offsets) {
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

		let ret = split_cables(offsets);

		let infoF = "";
		let infoC = "";
		for (let i = 0; i < offsets.length; ++i) {
			infoF += " ";
			infoF += offsetToString(ret.flatOffsets[i]);
			infoC += " ";
			infoC += offsetToString(ret.cableOffsets[i]);
		}

		console.log("   flat:" + infoF);
		console.log(" cables:" + infoC);

		console.assert(ret.flatOffsets.length === offsets.length, "flatOffsets is the right length");
		console.assert(ret.cableOffsets.length === offsets.length, "cableOffsets is the right length");

		for (let i = 0; i < offsets.length; ++i) {
			console.assert(ret.flatOffsets[i] + ret.cableOffsets[i] === offsets[i], "offsets sum properly");
			if (i + 1 < offsets.length) {
				let decrease = (i + offsets[i] === i+1 + offsets[i+1]);
				let flatDecrease = (i + offsets[i] === i+1 + offsets[i+1]);
				console.assert(!flatDecrease || decrease, "only decrease if flatDecrease");
			}
		}
	}

	test([ 2, 2, 0, -2, -2 ]);
	test([ -5, -5, -5, -4, -4 ]);
	test([ -3, -3, -5, -6, -6 ]);
}
