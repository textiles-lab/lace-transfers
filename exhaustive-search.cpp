#include <iostream>
#include <algorithm>
#include <iterator>
#include <vector>
#include <queue>
#include <set>
#include <map>
#include <fstream>
#include <assert.h>

#define n_stitches 3
#define n_rack     4 
#define Back_Bed  'b'
#define Front_Bed 'f'

typedef std::pair<char, int> BN;
typedef std::pair <int, std::pair< std::vector<char> , std::vector<int>> > Signature;


bool cse( std::vector<int> offsets, std::vector<int8_t> firsts, std::vector< std::pair<BN,BN> > *_xfers){

	// TODO
	// do cse for getting an upper bound on the pass count, if this bound is equal to the lower
	// bound, we are good to go just return that directly, probably use on of the newer algorithms
	//
	auto &xfers = *_xfers;

	return false;
}

bool exhaustive( std::vector<int> offsets, std::vector<int8_t> firsts , std::string outfile="out.xfers"){

	assert( offsets.size() == firsts.size() && " offsets and firsts must have the same size " );
	assert( offsets.size() == n_stitches && " number of stitches is fixed " );

	auto temp = offsets;
	std::sort(temp.begin(), temp.end());
	auto last = std::unique( temp.begin(), temp.end());
	temp.erase(last, temp.end());
	int lower_bound_passes = temp.size();
	std::cout << "unique offsets = " ;
	for(int i = 0; i < temp.size(); i++){
		std::cout << temp[i] << " , ";
	}
	std::cout<<std::endl;
	int upper_bound_passes =  INT32_MAX; 

	for(int i = 0; i < temp.size(); i++){
		if(temp[i] == 0){
			lower_bound_passes--;
		}
	}

	std::cout << "lower bound = " << lower_bound_passes << std::endl;
	struct State{
		std::vector<int> currents;
		std::vector<int> offsets;
		std::vector<char> beds;
		int left = 0;
		int rack = 0;
		int penalty = 0;
		int passes = 0;
		std::vector< std::pair< BN, BN> > xfers;
	};
	auto Penalty = [=](const State& s)->int{
		int p = 0;
		for(int i = 0; i < s.offsets.size(); i++){
			p += std::abs(s.offsets[i]);
		}
		return p;
	};
	auto Bed = [=](const BN& bn)->char{
		return bn.first;
	};
	auto Needle= [=](const BN& bn)->int{
		return bn.second;
	};
	auto Front = [=](const std::pair<BN, BN>& xfer)->int{
		if(Bed(xfer.first) == 'b')
			return Needle(xfer.second);
		else 
			return Needle(xfer.first);
	};
	auto Back = [=](const std::pair<BN, BN>& xfer)->int{
		if(Bed(xfer.first) == 'b')
			return Needle(xfer.first);
		else
			return Needle(xfer.second);
	};

	auto Opposite = [=](const State& s, int idx)->char{
		if(s.beds[idx] == Front_Bed) return Back_Bed;
		if(s.beds[idx] == Back_Bed) return Front_Bed;
		assert(false && "Bed has to be back or front");
	};

	auto PrintCurrent = [=](const State &s)->char{
		std::cout<<" current = [ ";
		for(int i = 0; i < n_stitches; i++){
			std::cout << s.beds[i]<< s.currents[i] << " , ";
		}
		std::cout<<" ] ";
		return '\t';
	};
	auto PrintOffsets = [=](const State &s)->char{
		std::cout<<" offsets = [ ";
		for(int i = 0; i < n_stitches; i++){
			std::cout << s.offsets[i] << " , ";
		}
		std::cout<<" ] ";
		return '\t';
	};
	auto Passes = [=](const std::vector<std::pair<BN,BN>>& xfers, bool log = false)->int{
		// track passes assuming xfers are happening in sequence
		int  p = 0;
		int  current_rack = 0;
		// you just finished knitting f1->fn, so direction is -ve
		// if you did knit the first course in the opposite direction, 
		// all the computation would still be self consistent 
		bool forwards = false;
		int  parked_at = n_stitches;

		for(auto x : xfers){
			assert( Bed(x.first) != Bed(x.second) && "can't xfer between same bed!");
			int needs_rack =  Front(x) - Back(x);
			if(log){
			std::cout<<Bed(x.first)<<Needle(x.first)<<" -> " << Bed(x.second) << Needle(x.second) << (forwards ? "  +   " : "  -  ");
			}
			if(needs_rack == current_rack){
				// check direction
				if( forwards && Front(x) < parked_at){
					// going the wrong way, so need to break pass 
					p++;
					forwards = !forwards;
					parked_at = Front(x);
					if( log ) {
						std::cout<<"\t--break pass(direction1)--";;
					}
				}
				else if( !forwards && Front(x) > parked_at){
					p++;
					forwards = !forwards;
					parked_at = Front(x);
					if( log ){
						std::cout<<"\t--break pass(direction2)--";;
					}
				}
			}
			else{
				// need one more pass to assign rack and direction will be flipped
				p++;
				forwards = !forwards;
				parked_at = Front(x);
				current_rack = needs_rack;
				if( log ){
					std::cout<<"\t--break pass(racking)--";
				}
			}
			if(log){
				std::cout << std::endl;
			}
		}
		return p;
	
	};
	struct LessThanByPenalty
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return lhs.penalty > rhs.penalty;
		}
	};
	struct LessThanByPenaltyThenPasses
	{
		bool operator()(const State& lhs, const State& rhs) const
		{
			return (lhs.penalty == rhs.penalty ? lhs.passes > rhs.passes : lhs.penalty > rhs.penalty);
		}
	};

	auto state_respects_slack = [=](const State& s)->bool{
		for(int i = 1; i < n_stitches; i++){
			int slack = std::max(1, std::abs( i + offsets[i] - (i-1 + offsets[i-1])));
			if(s.beds[i] == s.beds[i-1]){
				int stretch = std::abs(s.currents[i-1] - (s.currents[i]));
				if( stretch > slack) return false;
			}
			else{
				int back = ( (s.beds[i] == Back_Bed) ? s.currents[i] : s.currents[i-1]);
				int front = ((s.beds[i] == Back_Bed) ? s.currents[i-1] : s.currents[i]);
				int stretch = std::abs(back + s.rack - front);
				if(stretch > slack) return false;

			}
		}
		return true;
	};
	auto okay_to_move_index_by_offset = [=](const State& s, int idx, int ofs, bool log = false)->bool{
		
		
		// first can the current state be racked by ofs without stretching any of the yarns
		// then  if idx is moved to the opposite bed, is it still okay 
		State t = s;
		t.rack = ofs;
		if(!state_respects_slack(t)) {
			if(log)
			std::cout<<"\t\t\t\tinitial state cannot be racked to ofs " << ofs << std::endl;
			return false; // cannot rack current state 
		}
		t.beds[idx] = Opposite(t, idx);
		// currently  idx + t.offsets[idx]  on the front bed is aligned to
		//  idx + t.offsets[idx] + ofs on the back bed
		//  back to front: lose ofs, front to back: gain ofs 
		if(t.beds[idx] == Front_Bed){
			t.offsets[idx] += ofs;
			t.currents[idx] -= ofs;
		}
		else{
			t.offsets[idx] -= ofs;
			t.currents[idx] += ofs;
		}
		if(!state_respects_slack(t)) {
			if(log)
			std::cout<<"\t\t\t\tnew state cannot be at racked ofs " << ofs << std::endl;
			return false; // cannot xfer at ofs rack 
		}
		// any new tangling ?
		// only makes sense if skipping cables
		int prev = idx-1;
		int next = idx+1;
		while(prev >= 0){
			if( t.beds[prev] != t.beds[idx]) prev--;
			else break;
		}
		while(next < n_stitches){
			if(t.beds[next] != t.beds[idx]) next++;
			else break;
		}
		if( prev >= 0 && t.beds[prev] == t.beds[idx] && (t.currents[idx] <  t.currents[prev])){ 
			if(log)
			std::cout<<"\t\t\t\ttangling with prev  " <<idx << " and " << prev << std::endl;
			return false;
		}
		if( next < n_stitches && t.beds[next] == t.beds[idx] && ( t.currents[idx] > t.currents[next])) {
			if(log)
			std::cout<<"\t\t\t\ttangling with next  " <<idx << " and " << next << std::endl;
			return false;
		}


		// TODO overlapping loops have same destination

		return true;
		
	};

	auto make_signature = [=](const State &s)->Signature{
		auto pr = std::make_pair( s.beds, s.currents );
		auto p = Passes(s.xfers);
		return  std::make_pair( p, pr );
	};

	auto Reached = [=](const State &s) ->bool{
		
		assert(Penalty(s) == s.penalty && "penalty is correct.");
		if ( s.penalty > 0 ) return false;
		
		for( int i = 0; i < n_stitches; i++){
			if(s.beds[i] == Back_Bed) return false;
		}
		return true;
	};
	
	std::priority_queue< State, std::vector<State>, LessThanByPenalty > PQ;
	std::vector<State> successes;
	State best_state;
	int best_cost = INT32_MAX;

	State first;
	first.offsets = offsets;
	first.penalty = Penalty(first); 
	first.beds.assign(n_stitches, Front_Bed);
	for(int i = 0; i < n_stitches; i++){
		first.currents.push_back(i);
	}
	
	PQ.push(first);

	if( lower_bound_passes < 0 ){
		std::cout << "No transfers necessary, easy out" << std::endl;
		return true;
	}

	std::set< Signature > visited;
	std::map < std::pair<std::vector<char>, std::vector<int> >, int > current_passes_map;

	std::cout << "Starting penalty = " << first.penalty << std::endl;	

	while(!PQ.empty()){

		// from this state, generate _all_ possible next states
		// 0 can go from -8 to 8
		auto st  = PQ.top();
		PQ.pop();

		{	
			//std::cout<<"\tState@ "<< st.penalty << "  Passes " << Passes(st.xfers) << " UB " << upper_bound_passes << " LB " << lower_bound_passes  << PrintCurrent(st) << PrintOffsets(st) << std::endl;
		}
		
		auto sgn = make_signature(st);
		
		if( current_passes_map.count( sgn.second ) && current_passes_map[sgn.second] < sgn.first){
			// reached here at a lower pass count, continue 
			//std::cout<<"\t\tSkipping, reached state at lower pass count." << std::endl;
			continue;
		}
		
		if(visited.count(sgn)) continue;
		visited.insert(sgn);

		current_passes_map[sgn.second]  = sgn.first;

	
		if( Reached(st) ){
			int p = Passes(st.xfers);
			std::cout<<"Found a solution that needs " << p  <<" passes."<< std::endl;
			if ( p < best_cost ){
				best_cost = p;
				best_state = st;
			}
			successes.push_back(st);
			if( p < upper_bound_passes){
				upper_bound_passes = p;
			}
			if( p == lower_bound_passes){
				std::cout<<"Found lower bound, can't do better so break ( passes = "<< p <<" )" << std::endl;
				break;
			}
		}
		if ( Passes(st.xfers) > upper_bound_passes ) {
		
			//std::cout<<"Skipping because " << Passes(st.xfers) << " > " << upper_bound_passes << " (ub)." << std::endl;
		
			continue; // can do better no?
		
		}

		// what are the actions that can be sucessfully applied to top
		for(int idx = 0; idx < n_stitches; idx++){
			for(int ofs = -n_rack; ofs <= n_rack; ofs++){
				State top = st;
				if( okay_to_move_index_by_offset(top, idx, ofs) ){
					
					BN from = std::make_pair( top.beds[idx],  top.currents[idx]);
					//front-to-back
					if(top.beds[idx] == Front_Bed){
						top.offsets[idx] -= ofs;
						top.currents[idx] += ofs;
					}
					else{ //Back-to-front
						top.offsets[idx] += ofs;
						top.currents[idx] -= ofs;
					}
					top.beds[idx] = Opposite(top, idx);
					BN to = std::make_pair( top.beds[idx],  top.currents[idx]);
					top.xfers.push_back( std::make_pair( from, to) );
					top.penalty = Penalty(top);
					top.rack = ofs;	
					auto s = make_signature(top);
					// if state has been visited, skip it
					if(visited.count(s)) continue;
					if(!visited.count(s)&& ( !current_passes_map.count( s.second ) ||  current_passes_map[s.second] > s.first)){
						// reached here at a lower pass count, continue 
						PQ.push(top); 
					}
				}
			}
		}
	}

	std::cout << "Found " << successes.size() << " potential solutions. " << std::endl;
	for(int i = 0; i < successes.size(); i++){
		std::cout<<"Solution " << i << "\n" << Passes(successes[i].xfers, true) << std::endl;
	}

	// return a string 
	std::ofstream out(outfile);
	for(auto x : best_state.xfers){
		
		out<<Bed(x.first)<<Needle(x.first)<<" "<<Bed(x.second)<<Needle(x.second)<<"\n";

	}
	out.close();
	return true;
}



int main(int argc, char* argv[]){
	std::cout<<"argc = " << argc<<std::endl;
	if(argc == 1 + 2*n_stitches +1){
		 
		std::vector<int> offsets;
		std::vector<int8_t>firsts;
		for(int i = 1; i < 1 + n_stitches; i++){
			offsets.push_back( atoi(argv[i]) );
		}
		for(int i = 1 + n_stitches; i < 1 +2*n_stitches; i++){
			firsts.push_back( (int8_t)atoi(argv[i]) );
		}
		
		return exhaustive(offsets, firsts, argv[1+2*n_stitches]);
	}
	
	if(argc < 2){	
		
		exhaustive( {-1,-0, 1}, {0, 0, 0} );	
	}

	return 0;

}

