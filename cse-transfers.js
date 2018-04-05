#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
"use strict";

//cse_transfers computes transfers for flat knitting using the 
//collapse, stretch, expand strategy. No roll is required because, well flat.
//first pass, do not care about firsts

//Parameters:
// offsets: array of offsets for each stitch index 
// firsts: array of the same length as offsets;
//     if Boolean(offsets[i]) is true, stitch[i] will
//     arrive at its destination needle first.
// xfer: output function


// cse_transfers returns a transfer plan by calling
//   xfer('f'/'b', i, 'f'/'b', i+o) to move stitches around

function cse_transfers(offsets, firsts, xfer, max_racking = 3) {
	
	//assumes everything is on the front bed to begin with,
	//and wants to be at offsets on the front bed as well
	let verbose = false;
	const Expanding = 0;
	const StretchToBack = 1;
	const ExpandToFront = 2;
	const action = ['Expanding', 'Stretch-to-back', 'Expand-to-front'];
	let n_stitches = offsets.length;
	let slack_forward = new Array(n_stitches).fill(max_racking);
	let slack_backward = new Array(n_stitches).fill(max_racking);
	let current = new Array();
	let visited = new Set();
	
	const accum_add = (accumulator, currentValue) => Math.abs(accumulator) + Math.abs(currentValue);
	let target = new Array();	
	for (let i = 0; i < n_stitches; i++){ 
		current.push(i);
		target.push(i + offsets[i]);
	};

	//console.log('target:', target);
	
	for(let i = 0; i < n_stitches - 1; i++){
		slack_forward[i] = Math.max(1, Math.abs(target[i]-target[i+1]))
	}
	for(let i = 1; i < n_stitches; i++){
		slack_backward[i] = Math.max(1, Math.abs(target[i-1]-target[i]));
	}

	//console.log('forward  slack:', slack_forward);
	//console.log('backward slack:', slack_backward);
	
	function new_state(state = undefined){
		//let first_state = {'current': current.slice(), 'prev': current.slice(), 'offsets':offsets.slice(),'do':StretchToBack, 'path':new Array(), 'l':0, 'r':n_stitches-1};
		let s = {'current': undefined,'prev':undefined,  'offsets': undefined, 'do':undefined, 'path': undefined ,'l':undefined, 'r':undefined, 'chain':undefined};
		if(state != undefined){
			s.current = state.current.slice();
			s.offsets = state.offsets.slice();
			s.path = state.path.slice();
			s.l = state.l;// Number(state.l);
			s.r = state.r;// Number(state.r);
			s.prev = state.prev.slice();
			s.do =state.do;
			s.chain = state.chain.slice();
			s.chain.push(state);
		}
		return s;
	};

	function state_respects_slack(state){

		for(let i = 0; i < n_stitches-1; i++){
			let bridge = 0;
			if( state.do == Expanding && ((i == state.r && state.current[i+1]==state.current[i] )|| (i+1 == state.l && state.current[i+1]==state.current[i]))) bridge = 1;
			if ( Math.abs(state.current[i+1]- state.current[i] + bridge) > slack_forward[i] ){
				return false;
			}
		}
		for(let i = 1; i < n_stitches; i++){
			let bridge = 0;
			if(state.do == Expanding && ((i == state.l && state.current[i] == state.current[i-1] ) || (i == state.r+1 && state.current[i] == state.current[i-1]))) bridge = 1;
			if( Math.abs(state.current[i] - state.current[i-1] + bridge) > slack_backward[i]){
				return false;
			}
		}
		return true;

	};

	function generate_transfers(path, log=false){
		// keeping track of multiple transfers, similar to driver
		let needles = {};
		for (let i = 0; i < n_stitches; ++i) {
			needles['f' + i] = [i];
		}
		for(let i = 0; i < path.length; i++){
			let e = path[i];
			if(e){
				console.assert(e.from_bed == 'f' || e.from_bed == 'b');
				console.assert(e.to_bed == 'f' || e.to_bed == 'b');
				if(log){
					console.log('\txfer '+e.from_bed + e.from.toString()+' '+e.to_bed+e.to.toString());	
				}
				else{
					let from = needles[e.from_bed+e.from];
					if(from.length == 0) continue; // empty needle
					xfer(e.from_bed, e.from, e.to_bed, e.to);
					if (!((e.to_bed + e.to) in needles)) needles[e.to_bed+ e.to] = [];
					let to = needles[e.to_bed+e.to];
					while(from.length){ to.push(from.pop());}
					
				}
			}
		}
	};

	function penalty(state){
		let p = 0;
		for(let i = 0; i  < n_stitches; i++){
			p += Math.abs( state.offsets[i] );
			
		}
		// TODO keep track of firsts
		return p;
		// something wierd with 1 element arrays and so on 
		// return state.offsets.reduce(accum_add);
	};

	function visit_state(state){
		let s = new_state(state);
		s.path = [];
		s.chain = [];
		visited.add( JSON.stringify(s) );
	};

	function has_state(state){
		let s = new_state(state);
		s.path = [];
		s.chain = [];
		return visited.has( JSON.stringify(s) );
	};
	function priority_order(states){
		states.sort(function(a, b){
			let keyA = penalty(a),
				keyB = penalty(b);
			
			if(keyA < keyB) return 1;
			if(keyA > keyB) return -1;
			// if penalty is identical pick the one with fewer transfers in its path
			if(a.path.length < b.path.length) return 1;
			if(a.path.length > b.path.length) return -1;
			// break ties by something else
			if(a.l - a.r > b.l - b.r ) return 1;
			if(a.l - a.r < b.l - b.r) return -1;
			return 0;
		});
		return states;
	};

	function print_chain(state){
		console.clear();
		console.log("***************Final chain *************************");	
		console.log("target:", target);
		for(let i = 0; i < state.chain.length; i++){
			console.log('\t\t', action[state.chain[i].do], 'l:', state.chain[i].l, 'r:', state.chain[i].r, 'penalty:', penalty(state.chain[i]));
			generate_transfers(state.chain[i].path, true);

		}
		console.log('\t\t', action[state.do], 'l:', state.l, 'r:', state.r, 'penalty:', penalty(state));
		generate_transfers(state.path, true);
	
		console.log("**************end of chain*****************************");	
	};
	function get_racking_range(state){

		let min_l = -max_racking;
		let max_l =  max_racking;
		let min_r =  -max_racking;
		let max_r =  max_racking;

		let alt_min_l = -max_racking;
		let alt_max_l =  max_racking;
		let alt_min_r =  -max_racking;
		let alt_max_r =  max_racking;



		if(1){
			//x..x             .x..x..x..x <---front
			//    \           /
			//     l..o..o..r              <---back
			while(alt_min_l <= max_racking && state.l > 0 && (state.current[state.l] + alt_min_l ) < state.current[state.l-1]){
				alt_min_l++;
			}
			while(alt_max_l >= -max_racking && (state.current[state.l]+alt_max_l > state.current[state.r])){
				alt_max_l--;
			}


			while(alt_min_r <= max_racking && state.current[state.r] + alt_min_r < state.current[state.l]){
				alt_min_r++;
			}
			while(alt_max_r >= -max_racking && (state.r +1 < n_stitches) && (state.current[state.r]+alt_max_r > state.current[state.r+1])){
				alt_max_r--;
			}
		}
		if(1){
			if(state.l > 0){
				let slack_l = Math.max(1, Math.abs(state.l+state.offsets[state.l] - (state.l-1+state.offsets[state.l-1])));
				min_l = -slack_l -state.current[state.l] + state.current[state.l-1];
				max_l =  slack_l -state.current[state.l] + state.current[state.l-1];

			}
			if(state.r+1 < n_stitches){
				let slack_r = Math.max(1, Math.abs(state.r+1+state.offsets[state.r+1] - (state.r+state.offsets[state.r])));
				min_r = -slack_r - state.current[state.r] + state.current[state.r+1];
				max_r =  slack_r - state.current[state.r] + state.current[state.r+1];
			}
		}
		//console.assert(min_l >= -max_racking && min_l <= max_racking, 'min_l in range');
		//console.assert(min_r >= -max_racking && min_r <= max_racking, 'min_r in range');
		//console.assert(max_l >= -max_racking && max_l <= max_racking, 'max_l in range');
		//console.assert(max_r >= -max_racking && max_r <= max_racking, 'max_r in range');

		//console.log('alt ranges', alt_min_l, alt_max_l, alt_min_r, alt_max_r);
		//console.log('ranges', min_l, max_l, min_r, max_r);
		//return {'min_l':min_l, 'max_l':max_l, 'min_r':min_r, 'max_r':max_r};
			return {'min_l':alt_min_l, 'max_l':alt_max_l, 'min_r':alt_min_r, 'max_r':alt_max_r};
	};

	function okay_to_move_index_by_offset(state, idx, ofs){
		
		console.assert(idx >= 0 && idx < n_stitches, "idx is not valid");
		console.assert(state.r >= 0 && state.r < n_stitches, "r is not valid");
		console.assert(state.l >= 0 && state.l < n_stitches, "l is not valid");

		let c = state.current[idx]+ ofs;
		let o = state.offsets[idx]- ofs;
		for(let i = 0; i < state.l; i++){
			if(state.current[i] == c && (state.offsets[i]) != (o)){
				console.assert(i != idx, "shouldn't happen, right?");
				return false;
			}
		}
		for(let i = state.r+1; i < n_stitches; i++){
			if(state.current[i] == c && (state.offsets[i]) != (o)){
				console.assert(i != idx, "shouldn't happen, right?");
				return false;
			}
		}
		return true;
	
	};

	function print_state(state){
		console.log('*******************************');
		console.log('\t\tl:',state.l,'r:',state.r,' do:', action[state.do]);
		for(let i = 0; 	i < n_stitches; i++){
			console.log('stitch ' + i.toString() + ' is at ' + (state.current[i]).toString()+ ' wants  offset ' + (state.offsets[i]).toString() + ' (with forward slack ' + slack_forward[i].toString() + ' and backward slack ' + slack_backward[i].toString()+ ' and penalty '+ penalty(state).toString() +')');
		}
		
		console.log('*******************************');
	};

	let States = new Array();
	let first_state = {'current': current.slice(), 'prev': current.slice(), 'offsets':offsets.slice(),'do':StretchToBack, 'path':new Array(), 'l':0, 'r': n_stitches-1, 'chain':new Array()};
	
	States.push(first_state);


	while( States.length ){
	
		//console.log('States:', States.length);
	
		let s = priority_order(States).pop(); 
		if(has_state(s)){
			if(verbose){
			console.log('\x1b[33m');
			print_state(s);
			console.log('\x1b[0m');
			console.log('\t\tvisited already. states pending:',States.length);
			}
			continue;
		}
		visit_state(s);

		if(verbose){
		console.log('\x1b[1m');
		print_state(s);
		console.log('\x1b[0m');
		}

		console.assert( state_respects_slack(s), 'all accepted states must respect slack');	
		if( penalty(s)  === 0 && s.do === StretchToBack){
			//console.log('done', penalty(s));
			//if done on a collapsed state, follow up with one round of stretch to front
			console.log('final state:');
			print_state(s);
			generate_transfers(s.path);
			
			return;

		}
		
		if(s.do == StretchToBack){ 
			//console.log('\t\tStretch state to back');
			// the easy case, only translate.
			// as long as within min-max range of needles, always safe
			// TODO add a min-max needle range
			for(let r  = -max_racking; r <= max_racking; r++){
				let ss = new_state(s);
				
				for(let i = 0; i < n_stitches; i++){
					ss.path.push({'from_bed':'f', 'from':ss.current[i], 'to_bed':'b', to:ss.current[i]-r});
					ss.current[i] -= r;
					ss.offsets[i] += r;
				}
				ss.do = Expanding;
				ss.prev = ss.current.slice();
				ss.l = 0;
				ss.r = n_stitches-1;
				if( state_respects_slack(ss) && penalty(ss) <= penalty(s) && !has_state(ss)){
					States.push(ss);
				}
				

			}
		}//collapse
		else if(s.do === Expanding){
	
			//console.log('\t\t\tExpanding state.. l:' + ( s.l ).toString() + ' r: '+ ( s.r).toString());
			console.assert(s.l <= s.r, 'l<=r, for all expanding states');
			let ranges = get_racking_range(s);
			let min_l = ranges.min_l;
			let min_r = ranges.min_r;
			let max_l = ranges.max_l;
			let max_r = ranges.max_r;
			// Find the next legal state(s) to move s.l 
			{

				let o = s.offsets[s.l];
				let n = s.current[s.l];
				
				
				//console.log('\t\t ** Moving l in range ', min_l, max_l);
				// go through each offset
				for(let o = min_l; o <= max_l; o++){

					if( (s.l== 0 || Math.abs(n + o - s.current[s.l-1]) <= slack_backward[s.l]) &&
						(s.l==n_stitches-1 || Math.abs(n + o - s.current[s.l+1]) <= slack_forward[s.l]) ){

						if( okay_to_move_index_by_offset(s, s.l, o)){
							// launch a new version 
							let next = new_state(s);
							next.current[next.l] += o;
							next.offsets[next.l] -= o;
							//console.log('(L)Found offset ' + o.toString() + ' that works.');
							//console.log('\t l:', next.l,'current', next.current[next.l],'offset', next.offsets[next.l]);



							if(next.l < next.r){
								next.l++;
								next.do = Expanding;
								if(!has_state(next) && penalty(next) <= penalty(s)){
									States.push(next);
									//console.log('\t adding next l ('+next.l.toString()+')');
								}
							}
							else if(next.l == next.r){
								next.do = ExpandToFront;
								next.l = 0;
								next.r = n_stitches-1;
								if(!has_state(next) && penalty(next) <= penalty(s)){
									States.push(next);
									//console.log('\t adding next(l) for expansion');
								}

							}
						}
						

					}
				}
			}


			// Find the next legal state(s) to move s.r 
			{
				let o = s.offsets[s.r];
				let n = s.current[s.r];
			
				//console.log('\t\t ** Moving r in range ', min_r, max_r);

				// go through each offset
				for(let o = min_r; o <= max_r; o++){

					if( (s.r== 0 || Math.abs(n + o - s.current[s.r-1]) <= slack_backward[s.r]) &&
						(s.r==n_stitches-1 || Math.abs(n + o - s.current[s.r+1]) <= slack_forward[s.r]) ){

						if( okay_to_move_index_by_offset(s, s.r, o)){
							// launch a new version 
							let next = new_state(s);
							next.current[next.r] += o;
							next.offsets[next.r] -= o;
							//console.log('(R)Found offset ' + o.toString() + ' that works.');
							//console.log('\t r', next.r,'current', next.current[next.r],'offset', next.offsets[next.r]);


							if(next.r > next.l){
								next.r--;
								if(!has_state(next) && penalty(next) <= penalty(s)){
									States.push(next);
									//console.log('\t addng next r ('+next.r.toString()+')');
								}
							}
							else if(next.r == next.l && penalty(next) <= penalty(s)){
								next.do = ExpandToFront;
								next.l = 0;
								next.r = n_stitches-1;
								if(!has_state(next))
								{
									States.push(next);
									//console.log('\t adding next(r) for expansion');
								}

							}

						}

					}
				}
			}


			
		
		}
		else if(s.do === ExpandToFront){ // if collapsed state expand to front
			//console.log('\t\tExpand state to front', s.prev, s.current, s.offsets);
			let ss = new_state(s);
			
			// expanding has already done all the work, so this is trivial 
			// assuming prev was not clobbered by anything (it shouldn't be)
			//console.assert( ss.l >= ss.r , 'intermediate states were fully expanded');	
		
			ss.do = StretchToBack;			
			for(let i = 0;  i < n_stitches; i++){
				ss.path.push({'from_bed':'b','from':ss.prev[i],'to_bed':'f',to:ss.current[i]});
			}
			console.assert( state_respects_slack(ss) , 'this should be slack friendly, right?');
			if( penalty(ss) <= penalty(s) && !has_state(ss)){
				States.push(ss);
			}

		}
	}//while-states

	// if we reached here, we did not find any valid state -- should not happen 
	
	console.assert(false, 'no valid stretch expand strategy worked?!');
}


exports.cse_transfers = cse_transfers;

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

			if(from.length == 0)
				console.assert(from.length !== 0, "no reason to xfer empty needle");
			if(from.length > 1)
				console.warn("shouldn't xfer stack though cse can't guarantee");

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

		cse_transfers(offsets, firsts, xfer);

		dumpNeedles();

		for (let i = 0; i < offsets.length; ++i) {
			var n = needles['f' + (i + offsets[i])];
			console.assert(n.indexOf(i) !== -1, "needle got to destination");
			if (firsts[i]) {
				console.warn(n.indexOf(i) === 0, "first got to destination first");
			}
		}

		console.log(log.length + " transfers, avg " + (log.length/offsets.length) + " per needle.");

		return log;

	}

	test([1, 20],
		  [0, 0]);

	test([ -1,+2, -1],
		[ 0, 0, 0]);

	test([+1,+1,+2,+2],
	     [ 0, 0, 0, 0]);

	test([+1,+1,+1,+1,+1,+1,+1,+1],
	     [ 0, 0, 0, 0, 0, 0, 0, 0]);
	

	test([-3,-2,-2,-2,-2,-2,-2,-2],
	     [ 0, 0, 0, 0, 0, 0, 0, 0]);


	test([+1,+1,+2,+2,+3,+3,+2,+1],
	     [ 0, 0, 0, 0, 0, 0, 0, 0]);
	


	test([ 1, 0,+1,+1,+2,+2,+1,+1, 0, 0,+1, 0],
	     [ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

	
	test([-2,-2,0,0],
		 [0,0,0,0]);

	test([+4,+4,+3,+3,+2,+2,+1,+1, 0,-1,-1,-2,-2,-3,-3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

	test([ -1,-1, 0, 1, 1, 1],
	     [  0, 0, 0, 0, 0, 1]);

	test([+1,+2,+3,+3,+2,+2,+1,+1],
	     [ 0, 0, 0, 0, 1, 1, 0, 0]);
	test([-1,-1,-2,-2,-3,-3,-2,-1],
	     [ 0, 0, 1, 1, 0, 0, 0, 0]);
	
	
	test([-1,+0, +1],
	     [ 0, 0,  0]);
	
	test([-8,-4,-3,-3,-2,-2,-1,-1, 0,+1,+1,+2,+2,+3,+3],
	     [ 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
	test([ 1, 0, 1, 0, 1, 0, 0,-1, 0,-1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1, 1, 0,-1],
	     [ 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);

	test([-4,-3,-2,-1, 0,+1,+2,+3],
		[ 0, 0, 0, 0, 0, 0, 1, 0]);

	test([-1,-1,-2,-2,-3,-3,-2,-1],
		[ 0, 0, 1, 1, 0, 0, 0, 0]);

	test([+1,+1,+2,+2,+3,+3,+2,+1],
		[0,0,0,0,0,0,0,0],4);
}
