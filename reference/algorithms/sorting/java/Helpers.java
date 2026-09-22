/*
 Helper functions for sorting
*/
public class Helpers {
    public static boolean less(Comparable x, Comparable y) {
        return x.compareTo(y) < 0;
    }

    public static boolean equals(Comparable x, Comparable y) {
        return x.compareTo(y) == 0;
    }

    public static boolean greater(Comparable x, Comparable y) {
        return x.compareTo(y) > 0;
    }

    public static void swap(Comparable[] items, int x, int y){
        Comparable temp = items[x];
        items[x] = items[y];
        items[y] = temp;
    }

    public static boolean isSorted(Comparable[] a) {
        return isSorted(a, 0, a.length - 1);
    }

    public static boolean isSorted(Comparable[] a, int lo, int hi) {
        for (int i = lo + 1; i <= hi; i++) {
            if (less(a[i], a[i-1])) {
                return false;
            }
        }
        return true;
    }
}
