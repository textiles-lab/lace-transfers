#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

var fs = require('fs');

//make laces with n stitches and offsets bounded in absolute value by 'limit'

function enumerate_laces(n, limit, save_at){
	let order = Array(n).fill(0); // doesn't matter for non-cables	

	function write(offsets, oi, firsts, fi) {
		let str = {"offsets":offsets,"firsts":firsts,"orders":order,"transferMax":limit};
		// this code should return in same index so not bothering sha256 and all that..but maybe should
		let filename = save_at + 'all' + n + '-max' + limit + '_' + oi.toString() + '_' + fi.toString() + '.xfers';
		fs.writeFileSync(filename, JSON.stringify(str) , 'utf8');
		//console.log(filename);
	}
	
	let no_cables = [];

	//generate all patterns with no cables that stay within the range:
	let min_out = 0; //-1;
	let max_out = n-1; //n;

	let temp = [];
	function rec() {
		let min = Math.max(min_out-temp.length,-limit);
		let max = Math.min(max_out-temp.length, limit);
		if (temp.length === 0) {
			for (let o = min; o <= max; ++o) {
				temp.push(o);
				rec();
				temp.pop();
			}
		} else if (temp.length < n) {
			//how many stitches are stacked already?
			let s = 1;
			while (s+1 < temp.length && temp[temp.length-(s+1)]-1 === temp[temp.length-s]) {
				++s;
			}
			min = Math.max(temp[temp.length-1] - (s < 3 ? 1 : 0), min);
			for (let o = min; o <= max; ++o) {
				temp.push(o);
				rec();
				temp.pop();
			}
		} else {
			console.assert(temp.length === n);
			no_cables.push(temp.slice());
			//console.log(temp.join(" "));
		}
	}
	rec();

	console.log("Have " + no_cables.length + " patterns before firsts.");

	no_cables.forEach(function(offsets, oi){
		console.log(offsets.join(" "));
		let fi = 0;
		let firsts = [];
		function fill() {
			if (firsts.length < offsets.length) {
				let a = firsts.length;
				let b = a;
				while (b+1 < offsets.length && b + offsets[b] === b+1 + offsets[b+1]) b += 1;
				for (let i = a; i <= b; ++i) {
					firsts.push(false);
				}
				console.assert(firsts.length === b+1); //riiiight?
				if (a < b) {
					for (let i = a; i <= b; ++i) {
						firsts[i] = true;
						fill();
						firsts[i] = false;
					}
				} else {
					fill();
				}
				for (let i = a; i <= b; ++i) {
					firsts.pop();
				}
			} else {
				//console.log(firsts.join(" "));
				write(offsets, oi, firsts, fi++);
			}
		}
		fill();
	});
};
exports.enumerate_laces = enumerate_laces;
if ( require.main === module ) {
	

	enumerate_laces(6,8,'../lace-transfer-tests/enum-laces-6/');
	enumerate_laces(8,8,'../lace-transfer-tests/enum-laces-8/');
	//enumerate_laces(10,8,'../lace-transfer-tests/enum-laces-10/'); //<--- takes many gigs

}
