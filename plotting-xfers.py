#!/usr/bin/env python

from matplotlib import cm
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.style
import matplotlib as mpl
import sys
mpl.style.use('seaborn-colorblind')

if(len(sys.argv) < 2):
    print("Usage: ./plotting-xfers.py name1 csv1 name2 csv2 ... x-label-name")
    print("Name is used for legend and csv is used to pull passes from")
    print("Expects csv to containt xfer_per_needle")
    print("Example python plotting-xfers.py flat flat-results.csv schoolbus schoolbus-results.csv essential-stitch-collection")
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

for frame in frames:
    frame.plot(ax=ax, y = 'xfer_per_needle')

ax.legend(legends, frameon=False);

x_axis = ax.axes.get_xaxis()
x_axis.set_ticks([])
#ax.set_ylim(0, 10)
plt.xlabel(x_label)
plt.ylabel("Transfers per needle")
plt.show()

