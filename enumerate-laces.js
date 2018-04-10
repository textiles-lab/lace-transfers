var fs = require('fs');
function enumerate_laces(n, save_at){
	let order = Array(n).fill(0); // doesn't matter for non-cables	
	let base = [-1, 0 , 1];
	console.log(base);
	
	let offsets = [];
	let base_len = base.length;
	for(let i = 0; i < Math.pow(base_len, n); i++){
		let j = i;
		let temp = [];
		for(let k = 0; k < n; k++){
			temp[k] = base[j%base_len];
			j = Math.floor(j/base_len);
		}
		offsets.push(temp);
	}
	
	// filter cables
	function filter_out_cables( offset ){
		let target = offset.slice();
		for(let i = 0; i < n; i++){
			target[i] = i + offset[i];
		}
		
		let mon_up = target.every(function(e, i, a) { if (i) return e >= a[i-1]; return true; });
		let mon_dn = target.every(function(e, i, a) { if (i) return e <= a[i-1]; return true; });
		
		return (mon_up||mon_dn);
	};
	no_cables = offsets.filter( filter_out_cables );
	//console.log(no_cables);

	// generate all firsts in one-go (for upto 10-12 stitches this is fine..)
	let firsts = [];
	for(let i = 0; i < Math.pow(2, n); i++){
		let j = i;
		let temp = [];
		for(let k = 0; k < n; k++){
			temp[k] = (j%2? true : false);
			j = Math.floor(j/2);
		}
		firsts.push(temp);
	}

	function first_is_valid(offset, first){
		let target = offset.slice();
		for(let i = 0; i < n; i++){
			target[i] = i + offset[i];
		}
		for(let i = 0; i < n; i++){
			if(!first[i]) continue;
			let stacked = false;
			for(let j = 0; j < i-1; j++){
				if(first[j] && target[i] == target[j]) return false;
				if(target[j] == target[i]) stacked = true;
			}
			for(let j = i+1; j < n; j++){
				if(first[j] && target[i] == target[j]) return false;
				if(target[j] == target[i]) stacked = true;
			}
			if(!stacked) return false;
		}
		return true;
	};
	// for each pattern run through all the firsts that work with it, mostly very few will 
	// and save them somewhere .. at some n it wil make more sense to run this as a 
	// get_next_pair than to save everything but maybe easier to save them for now
	for(let o = 0; o < no_cables.length; o++){
		let ofs = no_cables[o];
		let file_index = 0;
		for(let f = 0; f < firsts.length; f++){
			let fir = firsts[f];
			if (first_is_valid(ofs, fir)){
				// add o,f to the pair
				let str = {"offsets":ofs,"firsts":fir,"orders":order,"transferMax":8};
				// this code should return in same index so not bothering sha256 and all that..but maybe should
				fs.writeFileSync(save_at+o.toString()+'_'+file_index.toString()+'.xfers', JSON.stringify(str) , 'utf8');
				
				
				file_index++;
			}
		}
	}
	

};
exports.enumerate_laces = enumerate_laces;
if ( require.main === module ) {
	

	enumerate_laces(6,'../lace-transfer-tests/enum-laces-6/');
	//enumerate_laces(8,'../lace-transfer-tests/enum-laces-8/');
	//enumerate_laces(10,'../lace-transfer-tests/enum-laces-10/');

}
