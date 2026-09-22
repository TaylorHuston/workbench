var quickSort = function (toSort) {

    var partition = function (toSort, lo, hi) {
        var i = lo + 1;
        var j = hi;
        
        while (true) {
            while (toSort[i] < toSort[lo] && i < hi) {
                i++;
            }
            
            while (toSort[j] > toSort[lo] && j > lo) {
                j--;
            }
        
            if (i >= j) {
                break;
            }
            
            swap(toSort, i, j);
        }
        swap(toSort, lo, j);
        return j;
    }
    
    var sort = function (toSort, lo, hi) {
        if (hi <= lo) {
            return;
        }
        
        var mid = partition(toSort, lo, hi);
        
        sort(toSort, lo, mid-1);
        sort(toSort, mid+1, hi);
    }
    
    sort(toSort, 0, toSort.length-1);
}