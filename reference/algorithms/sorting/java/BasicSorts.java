/*
 Basic, simple sorting algorithms.
 For reference.
 */
public class BasicSorts {
    static Helpers sortHelper = new Helpers();

    /*Selection Sort

    Sorts a passed array of any Comparable object by ascending order.
    Uses the Selection Sort method.
    For each iteration i we place the ith smallest item in array[i]*/
    public static void selectionSort(Comparable[] toSort) {

        int N = toSort.length;
        int min; //Index of the minimal element during each run

        for (int i=0; i < N; i++) {
            min = i;
            for(int j = i+1; j < N; j++) {
                if(sortHelper.less(toSort[j], toSort[min])) {
                    min = j;
                }
            }
            sortHelper.swap(toSort, i, min);
        }
    } //End selectionSort


    /*Insertion Sort

    Sorts a passed array of any Comparable object by ascending order.
    Uses the Insertion Sort method.
    For each iterarion, i, swap array[i] with entries array[<i] that are larger.*/
    public static void insertionSort(Comparable[] toSort, int start, int end) {

        for (int i=start; i <= end; i++) {
            for(int j = i; j > start && sortHelper.less(toSort[j], toSort[j - 1]); j--) {
                sortHelper.swap(toSort, j, j - 1);
            }
        }
    } //End insertionSort


    /*Shell Sort

    Sorts a passed array of any Comparable object by ascending order.
    Uses the Shell Sort method, which is essentially a modified Insertion Short.
    Rather then decrementing by 1, we decrement by decreasing values of h,
    breaking the array into smaller and smaller already sorted sub-arrays.
    Increased performance on larger arrays,
    especially when there are very small values at the end of the array*/
    public static void shellSort(Comparable[] toSort) {

        int N = toSort.length;
        int h = 1;

        while (h < N/3) {  //Computes the max h-size array
            h = h*3 + 1;  //1,4,13,40,121.....
        }

        while (h >= 1) {
            for (int i = h; i < N; i++) {
                for (int j = i; j >= h && sortHelper.less(toSort[j], toSort[j - h]); j-=h) {
                    sortHelper.swap(toSort, j, j - h);
                }
            }
            h = h/3;  //Shrinks to the next h-size array
        }
    } //End toSort
}
