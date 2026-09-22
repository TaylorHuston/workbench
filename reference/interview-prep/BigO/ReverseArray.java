package BigO;

/*Reverse an array. O(N)*/
public class ReverseArray {

    public static void reverse(int[] a) {
        for (int i = 0; i < a.length / 2; i++) {
            int endSwap = a.length - i - 1;
            int temp = a[i];
            a[i] = a[endSwap];
            a[endSwap] = temp;
        }
    }
}
