var heapSort = function(toSort) {

    var sink = function(k, end) {
        while (2*k <= end) {
            var j = 2*k;

            if (j < end && toSort[j] < toSort[j + 1]) {
                j++;
            }

            if(toSort[k] >= toSort[j]) {
                break;
            }

            swap(toSort, k, j);
            k=j;
        }
    }
    
    var sort = function() {
         var length = toSort.length-1;

        //Heap construction
        for (var k = parseInt(length/2); k >= 1; k--) {
            sink(k, length); //Build the heap
        }
        

        //Sortdown
        while (length >= 1) {
            swap(toSort, 1, length--);  //Put the current top of the heap to the end of the array
            sink(1, length);  //Re-heapify the remaining array
        }
    }
    
    sort();
}