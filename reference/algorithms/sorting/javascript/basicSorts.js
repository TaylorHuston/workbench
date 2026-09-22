//Basic Sorting Algorithms
var selection = function(toSort) {
    for (var i = 0; i < toSort.length; i++) {
        var min = i;
        for (var j = i+1; j <toSort.length; j++) {
            if (toSort[j] < toSort[min]) {
                min = j;
            }
        }
        swap(toSort, i, min);
    }
}

var insertion = function(toSort) {
    for (var i = 0; i < toSort.length; i++) {
        for (j = i; j > 0; j--) {
            if (toSort[j] < toSort[j-1]) {
                swap(toSort, j, j-1);
            } else {
                break;
            }
        }
    }
}

var shell = function(toSort) {
    var h = 0;
    while (h < toSort.length/3) {
        h = h*3+1;
    }

    while (h >= 1) {
        for (var i = h; i  < toSort.length; i++) {
            for (var j = i; j >= h; j -= h) {
                if(toSort[j] < toSort[j-h]) {
                    swap(toSort, j, j-h);
                }
            }
        }
        h = parseInt(h/3);
    }
}
