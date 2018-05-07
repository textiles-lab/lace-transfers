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
print('plotting...')
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
big_frame = pd.DataFrame()
cols = []
for i in range(1, n, 2):
    f =  pd.DataFrame.from_csv(sys.argv[i+1], parse_dates = False)
    frames.append(f.sort_values('lower_bound'))
    if i == 1:
        big_frame['lb']=frames[-1].lower_bound
        legends.append('lb')
        cols.append(frames[-1].lower_bound)

    big_frame[sys.argv[i]]=frames[-1].passes
    legends.append(sys.argv[i]);
    cols.append(frames[-1].passes)
    cols[-1] = [max(0, min(x, 10)) for x in cols[-1]]
fig, ax = plt.subplots(len(cols),1, sharex=True, sharey=True)

#fig.set_size_inches(4, 3)

#big_frame.plot(ax=ax, kind='hist', stacked=False, alpha=0.85)
#big_frame.plot(ax=ax, kind='hist', stacked = False)
#ax.hist(cols)
plt.xticks([ 2, 4, 6,  8, 10], ['2', '4','6', '8', '>10'])
cols.reverse()
legends.reverse()
#print(big_frame)
print(legends)
i = 0
for i in range(0,len(cols)):
    ax[i].hist(cols[i], bins=[2,3,4,5,6,7,8,9,10, 11], color='#AE8BD9' if i%2 else '#36087F')
    ax[i].set_yticks([])
    #ax[i].set_yticks([0, 500, 1000])
    ax[i].set_ylabel(legends[i])
    ax[i].set_xlabel(x_label)
    ax[i].grid(False)
    ax[i].tick_params(axis=u'both', which=u'both',length=0)

    #ax[i].legend(str(legends[i]), frameon=False)
    #ax[i].set_title(legends[i])
    #y_axis = ax[i].axes.get_y_axis()
    #y_axis.set_ticks([])
    #x_axis = ax[i].axes.get_x_axis()
    #plt.xlabel(ax[i], "P")
    #frame.hist(ax=ax[0,i], column='passes')
    i = i + 1


fig.subplots_adjust(hspace=0)

for a in ax:
    a.label_outer()
#ax = big_frame.hist( column=legends,  stacked =True)
#ax.legend(legends, frameon=False);
#y_axis = ax.axes.get_yaxis()
#y_axis.set_ticks([])
#x_axis = ax.axes.get_xaxis()
#x_axis.set_ticks([])
#ax.set_ylim(0, 10)
#plt.xlabel("Passes")
#plt.ylabel(x_label)
plt.show()
fig.savefig("plot.pdf", bbox_inches='tight' )

