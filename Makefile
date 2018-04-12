all: exhaustive

exhaustive: exhaustive-search.cpp
	g++ -std=c++11 -O3 -Wall -Werror exhaustive-search.cpp -o exhaustive

clean:
	rm exhaustive
