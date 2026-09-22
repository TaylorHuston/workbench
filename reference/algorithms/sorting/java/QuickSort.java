/*
 Improved Quick Sort

 Sorts passed array of any Comparable object by ascending order.
 Uses the Quick Sort method. Recursively places an element in index array[v],
 known as the partition, into it's proper place so that every element
 array[<v] is < array[v] and every element array[>v] is > array[v]

 Uses Insertion Sort on small sub arrays
*/
public class QuickSort {
    static Helpers sortHelper = new Helpers();
    static BasicSorts basicSort = new BasicSorts();

    public static void sort(Comparable[] toSort)  {
        //Unusued because in current implementation the array is already random
        //StdRandom.shuffle(toSort);
        sort(toSort, 0, toSort.length - 1);
    } //End quickSort

    public static void sort(Comparable[] toSort, int low, int high) {

        //Cutoff to just Insertion Sort for smaller arrays
        if (high <= low + 7) {
            basicSort.insertionSort(toSort, low, high);
            return;
        }

        int j = partition(toSort, low, high);
        sort(toSort, low, j-1);  //Sorts to the left of partition
        sort(toSort, j+1, high);  //Sorts to the right od partition
    }

    /* Places the partition item in it's proper place.
    Iterates through each element from both ends and swaps any elements on the
    right side that are < array[low] with any elements on the left side that
    are > array[low]. Returns the index, j, of the item that is now in it's
    proper place */
    private static int partition(Comparable[] toSort, int low, int high) {
        int i = low;
        int j = high+1;
        Comparable v = toSort[low];

        while (true) {
            //Scan left side until you find an item that's greater then v
            while (sortHelper.less(toSort[++i], v)) {
                if(i == high) {  //Reached end of array
                    break;
                }
            }

            //Scan right side until you find an item that's greater then v
            while (sortHelper.less(v, toSort[--j])) {
                if (j == low) {
                    break;
                }
            }
            //If the right side and left side pointers cross
            if (i>=j) {
                break;
            }
            //Swaps the two out of place elements
            sortHelper.swap(toSort, i, j);
        }

        sortHelper.swap(toSort, low, j);  //Puts partition item into proper place
        return j;  //Returns position of now correct item
    }

}
