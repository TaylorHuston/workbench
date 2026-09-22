/*
 Heap Sort

 Sorts passed array of any Comparable object by ascending order. Uses the Heap Sort method.
 Starts by building a heap out of the array. It then takes each item from the top of the heap (the max item),
 places it on the end of the unsorted subarray, and re-heapifys the unsorted sub array.  Repeats until entire array is sorted.
*/

public class HeapSort {
    static Helpers sortHelper = new Helpers();

    public static void sort(Comparable[] toSort) {
        int N = toSort.length-1;

        //Heap construction
        for (int k = N/2; k >= 1; k--) {
            sink(toSort, k, N); //Build the heap
        }


        //Sortdown
        while (N >= 1) {
            sortHelper.swap(toSort, 1, N--);  //Put the current top of the heap to the end of the array
            sink(toSort, 1, N);  //Re-heapify the remaining array
        }
    }

    private static void sink(Comparable[] toSort, int k, int end) {
        while (2*k <= end) {
            int j = 2*k;

            if (j < end && sortHelper.less(toSort[j], toSort[j + 1])) {
                j++;
            }

            if(!sortHelper.less(toSort[k], toSort[j])) {
                break;
            }

            sortHelper.swap(toSort, k, j);
            k=j;
        }
    }
}
