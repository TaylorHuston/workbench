var mergeSort = function(toSort) {
    var sort = function(lo, hi) {
        if (hi <= lo) {
            return;
        }

        var mid = parseInt(lo + (hi - lo)/2);
        sort(lo, mid);
        sort(mid+1, hi);
        merge(lo, mid, hi);
    }

    var merge = function(lo, mid, hi) {
        var i = lo;
        var j = mid+1;

        for (var k = lo; k <= hi; k++) {
            aux[k] = toSort[k];
        }

        for (var k = lo; k <= hi; k++) {
            if (i > mid) { //If everything in the left sub array has already been merged
                toSort[k] = aux[j++];
            } else if  (j > hi) { //If everything in the right sub array has already been merged
                toSort[k] = aux[i++];
            } else if (aux[j] < aux[i]) {  //If the item in the right sub array is smaller
                toSort[k] = aux[j++];
            } else {  //If the item in the left sub array is smaller
                toSort[k] = aux[i++];
            }
        }
    }

    var aux = [toSort.length];
    sort(0, toSort.length-1);

}
