#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//cable_transfers computes transfers for flat knitting when
//  the only things happening are cables
//Parameters:
// offsets: array of offsets for each stitch index
// orders: crossing order (larger is forwarder) for stitches
// xfer: output function
//
// cable_transfers returns a transfer plan by calling
//   xfer('f'/'b', i, 'f'/'b', i+o) to move stitches around

function cable_transfers(offsets, orders, xfer) {
	//Check inputs:
	if (offsets.length !== orders.length) {
		throw "Offsets and firsts should be the same length.";
	}

	let done = [];
	for (let i = 0; i < offsets.length; ++i) {
		done.push(false);
	}

	//This code handles
	//   simple cables of the form:
	// look for L  L  L   M M  R R R R
	//          ----l--- --m-- ---r---
	//  where L = m+r, M = r-l, R = -(l+m)

	for (let l0 = 0; l0 < offsets.length; ++l0) {
		//assume that i is at the L/M boundary:
		let L = offsets[l0];

		let found = false;
		for (let l = 1; l0+l <= offsets.length; ++l) {
			if (offsets[l0+l-1] !== L) break;

			let m0 = l0 + l;
			for (let m = 0; m0+m <= offsets.length; ++m) {
				if (m > 0 && offsets[m0+m-1] !== offsets[m0]) break;
				let r0 = m0 + m;
				for (let r = 1; r0+r <= offsets.length; ++r) {
					if (offsets[r0+r-1] !== offsets[r0]) break;

					let L = m+r;
					let M = r-l;
					let R = -(l+m);

					if (offsets[l0] !== L) continue;
					if (m !== 0 && offsets[m0] !== M) continue;
					if (offsets[r0] !== R) continue;

					//console.log( "[" + l0 + ", " + (l0+l) + ")[" + m0 + ", " + (m0+m) + ")[" + r0 + ", " + (r0+r) + ")" );

					let ol = orders[l0+l-1];
					let om = (m > 0 ? orders[m0] : -Infinity);
					let or = orders[r0];


					for (let i = l0; i < l0 + l; ++i) {
						console.assert(done[i] === false, "should never do a cable twice");
						done[i] = true;
						xfer('f', i, 'b', i);
					}
					for (let i = m0; i < m0 + m; ++i) {
						console.assert(done[i] === false, "should never do a cable twice");
						done[i] = true;
						xfer('f', i, 'b', i);
					}
					for (let i = r0; i < r0 + r; ++i) {
						console.assert(done[i] === false, "should never do a cable twice");
						done[i] = true;
						xfer('f', i, 'b', i);
					}

					function do_l() { for (let i = l0; i < l0 + l; ++i) xfer('b', i, 'f', i+L); }
					function do_r() { for (let i = r0; i < r0 + r; ++i) xfer('b', i, 'f', i+R); }
					function do_m() { for (let i = m0; i < m0 + m; ++i) xfer('b', i, 'f', i+M); }

					if (ol >= or && ol >= om) {
						do_l();
						if (or >= om) {
							do_r(); do_m();
						} else {
							do_m(); do_r();
						}
					} else if (or >= om) {
						do_r();
						if (ol >= om) {
							do_l(); do_m();
						} else {
							do_m(); do_l();
						}
					} else {
						do_m();
						if (ol >= or) {
							do_l(); do_r();
						} else {
							do_r(); do_l();
						}
					}

					found = true;
					l0 += (l + r + m) - 1;
					break;
				}
				if (found) break;
			}
			if (found) break;
		}
	}

	for (let i = 0; i < offsets.length; ++i) {
		if (offsets[i] !== 0 && done[i] !== true) {
			throw "cable_transfers failed to find a complete cable plan with its limited vocabulary";
		}
	}

}

exports.cable_transfers = cable_transfers;

//-------------------------------------------------
//testing code:

if (require.main === module) {
	console.log("Doing some test cable transfers.");
	function test(offsets, orders) {
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

			if (orders[i] < 0) {
				infoF += " -";
			} else if (orders[i] > 0) {
				infoF += " +";
			} else {
				infoF += " .";
			}
		}
		console.log(" index:" + infoI);
		console.log("offset:" + infoO);
		console.log(" order:" + infoF);

		cable_transfers(offsets, orders, xfer);

		dumpNeedles();

		for (let i = 0; i < offsets.length; ++i) {
			var n = needles['f' + (i + offsets[i])];
			console.assert(n.indexOf(i) !== -1, "needle got to destination");
		}

		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

		return log;

	}
	test([0, 0, 0, 0],
	     [0, 0, 0, 0]);

	test([0,+1,-1, 0,+1,-1],
	     [0,-1, 1, 0, 1,-1]);

 	test([+2, 0,-2,+2, 0,-2,+2, 0,-2,+2, 0,-2,+2, 0,-2,+2, 0,-2],
	     [-1, 0, 1,-1, 1, 0, 0,-1, 1, 0, 1,-1, 1,-1, 0, 1, 0,-1]);


	test([0,+2,+2,+2,-3,-3, 0],
	     [0, 0, 0, 0, 0, 0, 0]);
}
