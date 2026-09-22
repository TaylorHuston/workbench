package Recursive;

/*Given a sorted array of non-distinct integers, find the magic number, that is where array[i] == i*/
public class MagicInt {

    /*Like binary search, check middle, if it doesn't match, check the left and right POSSIBLE values*/
    public static int magicInt(int[] array) {
        return magicInt(array, 0, array.length);
    }

    private static int magicInt(int[] array, int start, int end) {
        if (start > end) {
            return -1;
        }

        int mid = (start + end) / 2;
        int midVal = array[mid];

        if (mid == midVal) {
            return mid;
        }

        int leftIndex = Math.min(mid - 1, midVal);
        int leftVal = magicInt(array, start, leftIndex);
        if (leftVal > -1) {
            return leftVal;
        }

        int rightIndex = Math.max(mid + 1, midVal);
        int rightVal = magicInt(array, rightIndex, end);
        if (rightVal > -1) {
            return rightVal;
        }

        return -1;
    }

    public static void main(String[] args) {
        int[] arr1 = {1, 1, 1, 2, 4, 5, 6, 7, 8};
        int[] arr2 = {-1, 0, 1, 3, 5, 6, 7, 8, 9};
        int[] arr3 = {-1, 0, 1, 2, 5, 6, 7, 8, 8};

        System.out.println(magicInt(arr1));
        System.out.println(magicInt(arr2));
        System.out.println(magicInt(arr3));
    }
}
