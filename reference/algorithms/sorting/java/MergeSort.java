/*
 Improved Merge Sort

 Sorts a passed array of any Comparable object by ascending order.
 Uses the Merge Sort method.
 Recursively breaks the array into 1/2 sized sub arrays,
 then merges them in sorted order as the stack unwinds.

 Uses Insertion sort when it gets to a certain threshold for small arrays
*/

public class MergeSort {
    static Helpers sortHelper = new Helpers();
    static BasicSorts basicSort = new BasicSorts();

    public static void sort(Comparable[] toSort) {

        //Array to use as temp storage during merge phases
        Comparable[] tempArray = new Comparable[toSort.length];
        sort(toSort, tempArray, 0, toSort.length-1);
    } //End mergeSort

    //Recursively splits the array in half and then merges in proper order
    public static void sort(Comparable[] toSort, Comparable[] tempArray, int low, int high) {

        //Cutoff to just Insertion Sort for smaller arrays
        if (high<=low + 7) {
            basicSort.insertionSort(toSort, low, high);
            return;
        }

        int mid = low + (high - low)/2;  //Create the mid point

        sort(toSort, tempArray, low, mid);  //Divide left half
        sort(toSort, tempArray, mid+1, high); //Divide right half

        //Skip merge if everything in the left is smaller
        //than everything in the right
        if(sortHelper.greater(toSort[mid], toSort[mid + 1])) {
            merge(toSort, tempArray, low, mid, high);
        }
    } //End mergeSort

    //Merges two sorted sub arrays into one larger sorted array
    public static void merge(Comparable[] toSort, Comparable[] tempArray, int low, int mid, int high){
        int i = low;
        int j = mid+1;

        //Copy values into temporary array
        for (int k = low; k <= high; k++) {
            tempArray[k] = toSort[k];
        }

        //Copy values back in sorted order
        for (int k = low; k <= high; k++) {
            //No more left items, fill in rest from right
            if (i > mid) {
                toSort[k] = tempArray[j++];
            }
            //No more right items, fill in rest from left
            else if (j > high) {
                toSort[k] = tempArray[i++];
            }
            //If the item on the right is smaller
            else if (sortHelper.less(tempArray[j], tempArray[i])) {
                toSort[k] = tempArray[j++];
            }
            //If the item on the left is smaller
            else {
                toSort[k] = tempArray[i++];
            }
        } //End for loop
    } //end mergeArrays
}
