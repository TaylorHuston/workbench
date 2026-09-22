import re
from collections import Counter

sonnet = """Let me not to the marriage of true minds
Admit impediments. Love is not love
Which alters when it alteration finds,

Or bends with the remover to remove.
O no, it is an ever-fixed mark
That looks on tempests and is never shaken
It is the star to every wand'ring bark,
Whose worth's unknown, although his height be taken.
Love's not time's fool, though rosy lips and cheeks
Within his bending sickle's compass come:
Love alters not with his brief hours and weeks,
But bears it out even to the edge of doom.
   If this be error and upon me proved,
   I never writ, nor no man ever loved."""

#Holds the unique words
uniques = {}
#Split on all the individual words
words = re.findall(r'\w+', sonnet)

#Count the unique words
for word in words :
    if word in uniques:
        uniques[word] += 1
    else:
        uniques[word] = 1

print(uniques)

#Using the Counter class
print(Counter(words))


unique_words = set(re.findall(r'\w+', sonnet))