/*
 3-Way Quick Sort

 Variation of Quick Sort that uses two pointers and groups all equal keys together.
 Improves performance with lots of duplicate keys.
*/

public class QuickThreeSort {
    static Helpers sortHelper = new Helpers();
        static BasicSorts basicSort = new BasicSorts();

    public static void sort(Comparable[] toSort) {
        sort(toSort, 0, toSort.length - 1);
        assert sortHelper.isSorted(toSort);
    }

    private static void sort(Comparable[] toSort, int lo, int hi) {
        if (hi <= lo) {
            return;
        }
        int lt = lo;
        int gt = hi;
        Comparable v = toSort[lo];
        int i = lo;

        while (i <= gt) {
            int cmp = toSort[i].compareTo(v);
            if (cmp < 0) {
                sortHelper.swap(toSort, lt++, i++);
            } else if (cmp > 0) {
                sortHelper.swap(toSort, i, gt--);
            }
            else {
                i++;
            }
        }

        sort(toSort, lo, lt - 1);
        sort(toSort, gt + 1, hi);
        assert sortHelper.isSorted(toSort, lo, hi);
    } //End sort
}
