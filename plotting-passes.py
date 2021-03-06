#!/usr/bin/env python
from matplotlib import cm
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.style
import matplotlib as mpl
import sys
#seaborn-colorblind, ggplot, fivethirtyeight, bmh seaborn-pastel are decent
#mpl.style.use('bmh')
mpl.style.use('bmh')

if(len(sys.argv) < 2):
    print("Usage: ./plotting-passes.py name1 csv1 name2 csv2 ... x-label-name")
    print("Name is used for legend and csv is used to pull passes from")
    print("Expects csv to containt lower_bound and passes columns")
    #for example to compare passes of flat and schoolbus (lower bound is added by default)
    print("Example python plotting-passes.py flat flat-results.csv schoolbus schoolbus-results.csv essential-stitch-collection")
    #for example to compare optimal passes and lower bound
    print("Example python plotting-passes.py optimal all-laces-6.csv enum-6")
    exit(0)

frames = list()
legends = []
n = len(sys.argv)-2
x_label = sys.argv[-1]
for i in range(1, n, 2):
    f =  pd.DataFrame.from_csv(sys.argv[i+1], parse_dates = False)
    frames.append(f.sort_values('lower_bound'))
    legends.append(sys.argv[i]);


fig, ax = plt.subplots()
fig.set_size_inches(8, 2)
for frame in frames:
    frame.plot(ax=ax, y = 'passes')

frames[0].plot( ax = ax, y='lower_bound', linewidth=4)
legends.append('lb')
ax.legend(legends, frameon=False, loc='top left');

x_axis = ax.axes.get_xaxis()
x_axis.set_ticks([])
#ax.set_ylim(0, 10)
plt.xlabel(x_label)
plt.ylabel("Passes")
plt.show()
fig.savefig("plot.pdf", bbox_inches='tight' )

