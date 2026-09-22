var threeWayQuick = function(toSort) {

    var sort = function(toSort, lo, hi) {
        if (hi <= lo) {
            return;
        }

        var lt = lo
        var gt = hi;

        var i = lo;
        while (i <= gt) {
            if (toSort[i] < toSort[lt]) {
                swap(toSort, lt, i);
                lt++;
                i++;
            }
            else if (toSort[i] > toSort[lt]) {
                swap(toSort, i, gt);
                gt--;
            }
            else {
                i++;
            }
        }

        sort(toSort, lo, lt-1);
        sort(toSort, gt+1, hi);

    }

    sort(toSort, 0, toSort.length-1);
}
